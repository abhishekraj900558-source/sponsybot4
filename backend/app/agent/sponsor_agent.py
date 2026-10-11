"""
SponsyBot - LangGraph-based Sponsorship Outreach Agent
=======================================================
An autonomous agent that runs the complete sponsorship workflow:
Research -> Prioritize -> Generate Emails -> Human Approval -> Send -> Track Replies -> Follow-up -> Meetings

This is the core "bot" implementation per Track 5 requirements.
"""
import logging
import time
from typing import Dict, List, Optional, Any, Literal
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import json

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import settings
from app.database import get_db_context
from app.models import (
    Sponsor, TeamMember, EmailLog, ReplyLog, FollowUpSchedule,
    Meeting, Event, InstitutionalMemory, Notification,
    SponsorStatus, EmailStatus, ReplyClassification, MeetingStatus
)
from app.services.research import research_service, ResearchResult
from app.services.ai_prioritization import ai_prioritization_service, PrioritizationResult
from app.services.email_generation import email_generation_service, EmailDraft
from app.services.email_sending import email_sending_service
from app.services.reply_tracking import reply_tracking_service, ReplyAnalysis
from app.services.follow_up import FollowUpService
from app.services.meeting import MeetingService
from app.services.notification import NotificationService

logger = logging.getLogger(__name__)


# ============================================================
# Agent State Definition
# ============================================================

class WorkflowStage(str, Enum):
    """Stages of the sponsorship workflow."""
    INIT = "init"
    RESEARCH = "research"
    PRIORITIZE = "prioritize"
    GENERATE_EMAILS = "generate_emails"
    PENDING_APPROVAL = "pending_approval"
    SENDING = "sending"
    MONITORING = "monitoring"
    WAITING_FOR_REPLY = "waiting_for_reply"
    FOLLOW_UP = "follow_up"
    MEETING = "meeting"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class SponsorWorkflowState:
    """State for a single sponsor's workflow."""
    sponsor_id: int
    company_name: str
    stage: WorkflowStage = WorkflowStage.INIT
    
    # Research data
    research_result: Optional[ResearchResult] = None
    
    # Prioritization data
    prioritization_result: Optional[PrioritizationResult] = None
    
    # Email data
    email_drafts: List[Dict] = field(default_factory=list)
    current_email_id: Optional[int] = None
    email_type: str = "initial"
    follow_up_number: int = 0
    
    # Approval
    approval_status: Optional[str] = None  # pending, approved, rejected
    approver_id: Optional[int] = None
    
    # Sending
    sent_at: Optional[datetime] = None
    message_id: Optional[str] = None
    send_error: Optional[str] = None
    
    # Reply tracking
    reply_received: bool = False
    reply_classification: Optional[ReplyClassification] = None
    reply_summary: Optional[str] = None
    reply_suggested_action: Optional[str] = None
    reply_suggested_response: Optional[str] = None
    
    # Follow-up
    follow_ups_sent: int = 0
    next_follow_up_at: Optional[datetime] = None
    follow_up_scheduled: bool = False
    
    # Meeting
    meeting_id: Optional[int] = None
    meeting_status: Optional[MeetingStatus] = None
    meeting_scheduled_at: Optional[datetime] = None
    
    # Results
    sponsorship_won: bool = False
    sponsorship_amount: Optional[int] = None
    sponsorship_benefits: Optional[List[Dict]] = None
    
    # Error tracking
    error: Optional[str] = None
    retry_count: int = 0
    
    # Context
    event_id: Optional[int] = None
    assignee_id: Optional[int] = None
    
    def to_dict(self) -> Dict:
        return {
            "sponsor_id": self.sponsor_id,
            "company_name": self.company_name,
            "stage": self.stage.value,
            "email_type": self.email_type,
            "follow_up_number": self.follow_up_number,
            "approval_status": self.approval_status,
            "reply_received": self.reply_received,
            "reply_classification": self.reply_classification.value if self.reply_classification else None,
            "follow_ups_sent": self.follow_ups_sent,
            "sponsorship_won": self.sponsorship_won,
            "error": self.error,
        }


@dataclass
class AgentState:
    """Global agent state for the sponsorship campaign."""
    event_id: Optional[int] = None
    event_name: str = ""
    campaign_name: str = ""
    
    # Sponsor workflows
    sponsor_workflows: Dict[str, SponsorWorkflowState] = field(default_factory=dict)
    
    # Campaign settings
    max_follow_ups: int = 2
    follow_up_intervals: Dict[int, int] = field(default_factory=lambda: {1: 5, 2: 7})
    
    # Control
    running: bool = True
    paused_sponsors: List[int] = field(default_factory=list)
    
    # Statistics
    stats: Dict[str, int] = field(default_factory=lambda: {
        "total": 0,
        "researched": 0,
        "prioritized": 0,
        "emails_generated": 0,
        "emails_sent": 0,
        "replies_received": 0,
        "interested": 0,
        "declined": 0,
        "meetings_scheduled": 0,
        "sponsorships_won": 0,
    })


# ============================================================
# Tools for LangGraph
# ============================================================

@tool
def research_company_tool(company_name: str, website: str = "", industry: str = "") -> Dict:
    """Research a company using Tavily API (or demo mode)."""
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(research_service.research_company(company_name, website, industry))
        return {
            "verified": result.verified,
            "unverified": result.unverified,
            "sources": result.sources,
            "source": result.source
        }
    finally:
        loop.close()


@tool
def prioritize_sponsor_tool(
    company_name: str,
    industry: str,
    company_category: str,
    research_verified: Dict,
    research_unverified: Dict,
    event_context: Dict = None,
    institutional_memory: Dict = None
) -> Dict:
    """Prioritize a sponsor using AI (Gemini or demo)."""
    result = ai_prioritization_service.analyze_sponsor(
        company_name=company_name,
        industry=industry,
        company_category=company_category,
        research_verified=research_verified,
        research_unverified=research_unverified,
        event_context=event_context,
        institutional_memory=institutional_memory
    )
    return {
        "priority_score": result.priority_score,
        "priority_tier": result.priority_tier,
        "recommended_types": result.recommended_types,
        "reasoning": result.reasoning,
        "confidence": result.confidence
    }


@tool
def generate_email_tool(
    email_type: str,
    sponsor_data: Dict,
    event_data: Dict,
    sender_data: Dict,
    recommended_types: List[str],
    reasoning: str,
    research_verified: Dict,
    research_unverified: Dict,
    previous_emails: List[Dict] = None,
    reply_context: Dict = None
) -> Dict:
    """Generate a personalized email draft."""
    draft = email_generation_service.generate_email(
        email_type=email_type,
        sponsor_data=sponsor_data,
        event_data=event_data,
        sender_data=sender_data,
        recommended_types=recommended_types,
        reasoning=reasoning,
        research_verified=research_verified,
        research_unverified=research_unverified,
        previous_emails=previous_emails or [],
        reply_context=reply_context
    )
    return {
        "subject": draft.subject,
        "body": draft.body,
        "body_html": draft.body_html,
        "variables_used": draft.variables_used
    }


@tool
def send_email_tool(
    sponsor_id: int,
    sender_id: int,
    subject: str,
    body: str,
    body_html: str,
    recipient_email: str,
    recipient_name: str,
    email_type: str,
    follow_up_number: int
) -> Dict:
    """Send an email via SMTP (or demo mode)."""
    import asyncio
    from app.database import SessionLocal
    from app.models import EmailLog, EmailStatus, TeamMember, Sponsor
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    db = SessionLocal()
    try:
        # Create email log
        email_log = EmailLog(
            sponsor_id=sponsor_id,
            sender_id=sender_id,
            subject=subject,
            body=body,
            body_html=body_html,
            email_type=email_type,
            follow_up_number=follow_up_number,
            status=EmailStatus.APPROVED  # Already approved
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        
        # Get sender and sponsor
        sender = db.query(TeamMember).filter(TeamMember.id == sender_id).first()
        sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
        
        if not sender or not sponsor:
            return {"success": False, "error": "Sender or sponsor not found"}
        
        # Send
        result = loop.run_until_complete(email_sending_service.send_email(
            email_log=email_log,
            sender=sender,
            recipient_email=recipient_email,
            recipient_name=recipient_name
        ))
        
        if result["success"]:
            email_log.status = EmailStatus.SENT
            email_log.sent_at = datetime.utcnow()
            email_log.message_id = result["message_id"]
            
            sponsor.last_contacted_at = datetime.utcnow()
            if sponsor.status == SponsorStatus.NOT_CONTACTED:
                sponsor.status = SponsorStatus.CONTACTED
            elif sponsor.status == SponsorStatus.FOLLOW_UP:
                sponsor.status = SponsorStatus.FOLLOW_UP
        else:
            email_log.status = EmailStatus.FAILED
            email_log.error_message = result["error"]
        
        db.commit()
        return {"success": result["success"], "message_id": result.get("message_id"), "error": result.get("error")}
    finally:
        db.close()
        loop.close()


@tool
def check_replies_tool(sponsor_id: int) -> Dict:
    """Check for new replies from a sponsor (simulated - in production would check email inbox)."""
    return {"has_new_reply": False}


@tool
def process_reply_tool(
    sponsor_id: int,
    from_email: str,
    subject: str,
    body: str,
    message_id: str = "",
    in_reply_to: str = ""
) -> Dict:
    """Process a sponsor reply and classify it."""
    from app.database import SessionLocal
    from app.models import EmailLog, EmailStatus, ReplyLog, ReplyClassification, Sponsor, SponsorStatus, MeetingStatus
    
    db = SessionLocal()
    try:
        sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
        if not sponsor:
            return {"error": "Sponsor not found"}
        
        original_email = None
        if in_reply_to:
            original_email = db.query(EmailLog).filter(EmailLog.message_id == in_reply_to).first()
        if not original_email:
            original_email = db.query(EmailLog).filter(
                EmailLog.sponsor_id == sponsor_id,
                EmailLog.status == EmailStatus.SENT
            ).order_by(EmailLog.sent_at.desc()).first()
        
        if not original_email:
            return {"error": "No original email found"}
        
        analysis = reply_tracking_service.analyze_reply(
            reply_body=body,
            reply_subject=subject,
            original_email_subject=original_email.subject,
            original_email_body=original_email.body,
            sponsor_context={"company_name": sponsor.company_name, "industry": sponsor.industry},
            event_context={"name": "Tech Event"}
        )
        
        reply_log = ReplyLog(
            sponsor_id=sponsor_id,
            email_id=original_email.id,
            from_email=from_email,
            subject=subject,
            body=body,
            received_at=datetime.utcnow(),
            message_id=message_id,
            classification=analysis.classification,
            classification_confidence=analysis.confidence,
            summary=analysis.summary,
            suggested_action=analysis.suggested_action,
            suggested_response=analysis.suggested_response,
            processed_at=datetime.utcnow()
        )
        db.add(reply_log)
        
        if analysis.classification == ReplyClassification.INTERESTED:
            sponsor.status = SponsorStatus.INTERESTED
            sponsor.meeting_status = MeetingStatus.REQUESTED
            FollowUpService(db).cancel_follow_ups_for_sponsor(sponsor_id, "Sponsor expressed interest")
        elif analysis.classification == ReplyClassification.DECLINED:
            sponsor.status = SponsorStatus.DECLINED
            FollowUpService(db).cancel_follow_ups_for_sponsor(sponsor_id, "Sponsor declined")
        
        db.commit()
        
        return {
            "classification": analysis.classification.value,
            "confidence": analysis.confidence,
            "summary": analysis.summary,
            "suggested_action": analysis.suggested_action,
            "suggested_response": analysis.suggested_response
        }
    finally:
        db.close()


@tool
def schedule_follow_up_tool(
    sponsor_id: int,
    follow_up_number: int,
    event_data: Dict,
    sender_data: Dict,
    sponsor_data: Dict
) -> Dict:
    """Generate and schedule a follow-up email draft."""
    from app.database import SessionLocal
    from app.models import EmailLog, EmailStatus, Sponsor, SponsorStatus
    from app.services.follow_up import FollowUpService
    from datetime import timedelta
    
    db = SessionLocal()
    try:
        sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
        if not sponsor:
            return {"error": "Sponsor not found"}
        
        followup_service = FollowUpService(db)
        draft = followup_service.generate_follow_up_draft(
            sponsor, follow_up_number,
            event_data, sender_data, {"name": sender_data.get("name", ""), "email": sender_data.get("email", "")}
        )
        
        scheduled_at = datetime.utcnow() + timedelta(days=1)
        followup = followup_service.create_follow_up_schedule(
            sponsor_id, follow_up_number, scheduled_at,
            draft.subject, draft.body, draft.body_html
        )
        
        email_log = EmailLog(
            sponsor_id=sponsor_id,
            sender_id=sender_data.get("id", 1),
            subject=draft.subject,
            body=draft.body,
            body_html=draft.body_html,
            email_type=f"follow_up_{follow_up_number}",
            follow_up_number=follow_up_number,
            status=EmailStatus.DRAFT
        )
        db.add(email_log)
        db.flush()
        
        followup.email_id = email_log.id
        followup.status = "created"
        
        sponsor.follow_up_count = follow_up_number
        sponsor.status = SponsorStatus.FOLLOW_UP
        sponsor.next_follow_up_at = scheduled_at
        
        db.commit()
        
        return {"email_id": email_log.id, "scheduled_at": scheduled_at.isoformat()}
    finally:
        db.close()


@tool
def create_meeting_tool(
    sponsor_id: int,
    team_member_id: int,
    title: str,
    description: str,
    scheduled_at: str,
    meeting_link: str = ""
) -> Dict:
    """Create a meeting with a sponsor."""
    from app.database import SessionLocal
    from app.models import Meeting, MeetingStatus, Sponsor, SponsorStatus
    from app.services.meeting import MeetingService
    
    db = SessionLocal()
    try:
        sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
        if not sponsor:
            return {"error": "Sponsor not found"}
        
        meeting_service = MeetingService(db)
        meeting = meeting_service.request_meeting(
            sponsor_id=sponsor_id,
            team_member_id=team_member_id,
            title=title,
            description=description,
            meeting_link=meeting_link
        )
        
        meeting = meeting_service.schedule_meeting(
            meeting.id,
            datetime.fromisoformat(scheduled_at),
            meeting_link=meeting_link
        )
        
        return {"meeting_id": meeting.id, "calendar_links": {
            "google": meeting_service.generate_calendar_link(meeting, "google"),
            "outlook": meeting_service.generate_calendar_link(meeting, "outlook"),
            "ical": meeting_service.generate_calendar_link(meeting, "ical")
        }}
    finally:
        db.close()


@tool
def update_institutional_memory_tool(
    company_name: str,
    sponsorship_amount: int,
    sponsorship_benefits: List[Dict],
    event_name: str,
    assignee_name: str,
    recommended_types: List[str]
) -> Dict:
    """Auto-capture institutional memory when sponsorship is won."""
    from app.database import SessionLocal
    from app.models import InstitutionalMemory
    
    db = SessionLocal()
    try:
        memory = db.query(InstitutionalMemory).filter(
            InstitutionalMemory.company_name.ilike(company_name)
        ).first()
        
        sponsorship_record = {
            "event": event_name,
            "amount": sponsorship_amount,
            "benefits": sponsorship_benefits,
            "date": datetime.utcnow().isoformat(),
            "assignee": assignee_name
        }
        
        if memory:
            prev = memory.previous_sponsorships or []
            prev.append(sponsorship_record)
            memory.previous_sponsorships = prev
            memory.total_contributed = (memory.total_contributed or 0) + sponsorship_amount
            if recommended_types:
                preferred = memory.preferred_sponsorship_types or []
                for st in recommended_types:
                    if st not in preferred:
                        preferred.append(st)
                memory.preferred_sponsorship_types = preferred
            memory.last_event = event_name
            memory.last_contact_year = datetime.utcnow().year
            memory.outcome_notes = f"Sponsorship won: {sponsorship_record}"
            memory.verified = True
        else:
            memory = InstitutionalMemory(
                company_name=company_name,
                previous_sponsorships=[sponsorship_record],
                total_contributed=sponsorship_amount,
                preferred_sponsorship_types=recommended_types,
                last_event=event_name,
                last_contact_year=datetime.utcnow().year,
                outcome_notes=f"Sponsorship won: {sponsorship_record}",
                source="auto-captured",
                verified=True
            )
            db.add(memory)
        
        db.commit()
        return {"success": True, "memory_id": memory.id}
    finally:
        db.close()


# ============================================================
# LangGraph Node Functions
# ============================================================

def research_node(state: AgentState) -> AgentState:
    """Research all sponsors that need it."""
    logger.info("??? Research node: researching sponsors...")
    
    # Get sponsor IDs from workflow state
    sponsor_ids = [int(sid) for sid in state.sponsor_workflows.keys()]
    
    with get_db_context() as db:
        sponsors = db.query(Sponsor).filter(
            Sponsor.id.in_(sponsor_ids),
            Sponsor.research_data.is_(None),
            Sponsor.status.in_([SponsorStatus.NOT_CONTACTED, SponsorStatus.CONTACTED])
        ).all()
        
        for sponsor in sponsors:
            if sponsor.id in state.paused_sponsors:
                continue
            
            try:
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(research_service.research_company(
                    sponsor.company_name, sponsor.website, sponsor.industry
                ))
                loop.close()
                
                sponsor.research_data = result.verified
                sponsor.research_unverified = result.unverified
                sponsor.research_last_updated = result.researched_at
                sponsor.research_source = result.source
                db.commit()
                
                sid = str(sponsor.id)
                if sid not in state.sponsor_workflows:
                    state.sponsor_workflows[sid] = SponsorWorkflowState(
                        sponsor_id=sponsor.id,
                        company_name=sponsor.company_name,
                        event_id=state.event_id,
                        assignee_id=sponsor.assignee_id
                    )
                
                wf = state.sponsor_workflows[sid]
                wf.research_result = result
                wf.stage = WorkflowStage.RESEARCH
                state.stats["researched"] += 1
                
                logger.info(f"  ??? Researched {sponsor.company_name}")
            except Exception as e:
                logger.error(f"  ??? Research failed for {sponsor.company_name}: {e}")
    
    return state


def prioritize_node(state: AgentState) -> AgentState:
    """Prioritize all researched sponsors."""
    logger.info("???? Prioritize node: scoring sponsors...")
    
    with get_db_context() as db:
        event_context = None
        if state.event_id:
            event = db.query(Event).filter(Event.id == state.event_id).first()
            if event:
                event_context = {
                    "name": event.name,
                    "type": "Hackathon/Tech Event",
                    "expected_attendees": event.expected_attendees,
                    "budget_target": event.budget_target,
                    "sponsorship_needs": "Cash, Swag, Cloud Credits, Infrastructure"
                }
        
        sponsor_ids = [int(sid) for sid in state.sponsor_workflows.keys()]
        
        sponsors = db.query(Sponsor).filter(
            Sponsor.id.in_(sponsor_ids),
            Sponsor.research_data.isnot(None),
            Sponsor.priority_score == 0
        ).all()
        
        for sponsor in sponsors:
            if sponsor.id in state.paused_sponsors:
                continue
            
            try:
                memory = db.query(InstitutionalMemory).filter(
                    InstitutionalMemory.company_name.ilike(sponsor.company_name)
                ).first()
                
                institutional_memory = None
                if memory:
                    institutional_memory = {
                        "previous_sponsorships": memory.previous_sponsorships,
                        "total_contributed": memory.total_contributed,
                        "preferred_sponsorship_types": memory.preferred_sponsorship_types,
                        "outcome_notes": memory.outcome_notes
                    }
                
                result = ai_prioritization_service.analyze_sponsor(
                    company_name=sponsor.company_name,
                    industry=sponsor.industry,
                    company_category=sponsor.company_category,
                    research_verified=sponsor.research_data or {},
                    research_unverified=sponsor.research_unverified or {},
                    event_context=event_context,
                    institutional_memory=institutional_memory
                )
                
                sponsor.priority_score = result.priority_score
                sponsor.priority_tier = result.priority_tier
                sponsor.recommended_sponsorship_types = result.recommended_types
                sponsor.recommendation_reasoning = result.reasoning
                db.commit()
                
                sid = str(sponsor.id)
                if sid not in state.sponsor_workflows:
                    state.sponsor_workflows[sid] = SponsorWorkflowState(
                        sponsor_id=sponsor.id,
                        company_name=sponsor.company_name,
                        event_id=state.event_id,
                        assignee_id=sponsor.assignee_id
                    )
                
                wf = state.sponsor_workflows[sid]
                wf.prioritization_result = result
                wf.stage = WorkflowStage.PRIORITIZE
                state.stats["prioritized"] += 1
                
                logger.info(f"  ??? Prioritized {sponsor.company_name}: {result.priority_score} ({result.priority_tier})")
            except Exception as e:
                logger.error(f"  ??? Prioritization failed for {sponsor.company_name}: {e}")
    
    return state


def generate_emails_node(state: AgentState) -> AgentState:
    """Generate initial email drafts for prioritized sponsors."""
    logger.info("?????? Generate emails node: creating drafts...")
    
    sponsor_ids = [int(sid) for sid in state.sponsor_workflows.keys()]
    
    with get_db_context() as db:
        event = db.query(Event).filter(Event.is_active == True).first()
        event_data = {
            "name": event.name if event else "Tech Event",
            "description": event.description if event else "A student technology event",
            "date": event.start_date.strftime("%B %d, %Y") if event and event.start_date else "Upcoming",
            "expected_attendees": event.expected_attendees if event else 100,
            "location": event.location if event else "TBD"
        }
        
        # Find sponsors that need initial emails - NOT_CONTACTED and no existing draft/pending email
        sponsors = db.query(Sponsor).filter(
            Sponsor.id.in_(sponsor_ids),
            Sponsor.priority_score > 0,
            Sponsor.status == SponsorStatus.NOT_CONTACTED
        ).all()
        
        # Filter out sponsors that already have an initial email (draft, pending, approved, or sent)
        filtered_sponsors = []
        for sponsor in sponsors:
            existing_email = db.query(EmailLog).filter(
                EmailLog.sponsor_id == sponsor.id,
                EmailLog.email_type == "initial",
                EmailLog.status.in_([
                    EmailStatus.DRAFT,
                    EmailStatus.PENDING_APPROVAL,
                    EmailStatus.APPROVED,
                    EmailStatus.SENT
                ])
            ).first()
            if not existing_email:
                filtered_sponsors.append(sponsor)
        sponsors = filtered_sponsors
        
        for sponsor in sponsors:
            if sponsor.id in state.paused_sponsors:
                continue
            
            try:
                sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
                if not sender:
                    sender = db.query(TeamMember).filter(TeamMember.is_active == True).first()
                
                if not sender:
                    logger.warning(f"  ??? No sender for {sponsor.company_name}")
                    continue
                
                sender_data = {
                    "name": sender.name,
                    "role": sender.role,
                    "club_name": "Student Tech Club",
                    "club_description": "A student-run technology club",
                    "email": sender.email
                }
                
                previous_emails = db.query(EmailLog).filter(
                    EmailLog.sponsor_id == sponsor.id,
                    EmailLog.status == EmailStatus.SENT
                ).order_by(EmailLog.sent_at).all()
                
                prev_emails_data = [
                    {"email_type": e.email_type, "subject": e.subject, "sent_at": e.sent_at.isoformat() if e.sent_at else None}
                    for e in previous_emails
                ]
                
                draft = email_generation_service.generate_email(
                    email_type="initial",
                    sponsor_data={
                        "company_name": sponsor.company_name,
                        "contact_person": sponsor.contact_person,
                        "contact_role": sponsor.contact_role,
                        "industry": sponsor.industry,
                        "company_category": sponsor.company_category,
                    },
                    event_data=event_data,
                    sender_data=sender_data,
                    recommended_types=sponsor.recommended_sponsorship_types or [],
                    reasoning=sponsor.recommendation_reasoning or "",
                    research_verified=sponsor.research_data or {},
                    research_unverified=sponsor.research_unverified or {},
                    previous_emails=prev_emails_data
                )
                
                email_log = EmailLog(
                    sponsor_id=sponsor.id,
                    sender_id=sender.id,
                    subject=draft.subject,
                    body=draft.body,
                    body_html=draft.body_html,
                    email_type="initial",
                    follow_up_number=0,
                    status=EmailStatus.DRAFT
                )
                db.add(email_log)
                db.commit()
                db.refresh(email_log)
                
                sid = str(sponsor.id)
                if sid not in state.sponsor_workflows:
                    state.sponsor_workflows[sid] = SponsorWorkflowState(
                        sponsor_id=sponsor.id,
                        company_name=sponsor.company_name,
                        event_id=state.event_id,
                        assignee_id=sponsor.assignee_id
                    )
                
                wf = state.sponsor_workflows[sid]
                wf.email_drafts.append({
                    "email_id": email_log.id,
                    "email_type": "initial",
                    "subject": draft.subject,
                    "status": "draft"
                })
                wf.current_email_id = email_log.id
                wf.email_type = "initial"
                wf.stage = WorkflowStage.GENERATE_EMAILS
                state.stats["emails_generated"] += 1
                
                logger.info(f"  ??? Generated initial email for {sponsor.company_name}")
            except Exception as e:
                logger.error(f"  ??? Email generation failed for {sponsor.company_name}: {e}")
    
    return state


def approval_node(state: AgentState) -> AgentState:
    """Check for approved emails and send them."""
    logger.info("??? Approval node: checking for approved emails...")
    
    sponsor_ids = [int(sid) for sid in state.sponsor_workflows.keys()]
    
    with get_db_context() as db:
        approved_emails = db.query(EmailLog).filter(
            EmailLog.sponsor_id.in_(sponsor_ids),
            EmailLog.status == EmailStatus.APPROVED
        ).all()
        
        for email in approved_emails:
            wf = state.sponsor_workflows.get(email.sponsor_id)
            if wf and email.sponsor_id in state.paused_sponsors:
                continue
            
            try:
                sponsor = db.query(Sponsor).filter(Sponsor.id == email.sponsor_id).first()
                sender = db.query(TeamMember).filter(TeamMember.id == email.sender_id).first()
                
                if not sponsor or not sponsor.contact_email:
                    logger.warning(f"  ??? No contact email for sponsor {email.sponsor_id}")
                    continue
                
                if not sender:
                    continue
                
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(email_sending_service.send_email(
                    email_log=email,
                    sender=sender,
                    recipient_email=sponsor.contact_email,
                    recipient_name=sponsor.contact_person
                ))
                loop.close()
                
                if result["success"]:
                    email.status = EmailStatus.SENT
                    email.sent_at = datetime.utcnow()
                    email.message_id = result["message_id"]
                    
                    sponsor.last_contacted_at = datetime.utcnow()
                    if sponsor.status == SponsorStatus.NOT_CONTACTED:
                        sponsor.status = SponsorStatus.CONTACTED
                    elif sponsor.status == SponsorStatus.FOLLOW_UP:
                        sponsor.status = SponsorStatus.FOLLOW_UP
                    
                    if email.follow_up_number == 0:
                        followup_service = FollowUpService(db)
                        actions = followup_service.check_and_schedule_follow_ups()
                        for action in actions:
                            if action.sponsor_id == sponsor.id:
                                sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
                                if sender:
                                    draft = followup_service.generate_follow_up_draft(
                                        sponsor, action.follow_up_number,
                                        event_data={"name": "Tech Event", "date": "Upcoming", "expected_attendees": 100},
                                        sender_data={"name": sender.name, "role": sender.role, "club_name": "Student Tech Club", "email": sender.email},
                                        assignee_data={"name": sender.name, "email": sender.email}
                                    )
                                    followup_service.create_follow_up_schedule(
                                        sponsor.id, action.follow_up_number, action.scheduled_at,
                                        draft.subject, draft.body, draft.body_html
                                    )
                                    break
                    
                    state.stats["emails_sent"] += 1
                    # Update workflow state
                    wf = state.sponsor_workflows.get(str(sponsor.id))
                    if wf:
                        wf.stage = WorkflowStage.WAITING_FOR_REPLY
                    logger.info(f"  Sent email to {sponsor.company_name}")
                else:
                    email.status = EmailStatus.FAILED
                    email.error_message = result["error"]
                    logger.error(f"  Failed to send to {sponsor.company_name}: {result['error']}")
                
                db.commit()
            except Exception as e:
                logger.error(f"  Send failed for email {email.id}: {e}")
    
    return state


def monitor_replies_node(state: AgentState) -> AgentState:
    """Monitor for sponsor replies (checks webhook-processed replies)."""
    logger.info("???? Monitor replies node: checking for new replies...")
    
    with get_db_context() as db:
        sponsors_with_replies = db.query(Sponsor).join(ReplyLog).filter(
            ReplyLog.processed_at.isnot(None)
        ).distinct().all()
        
        for sponsor in sponsors_with_replies:
            if sponsor.id in state.paused_sponsors:
                continue
            
            wf = state.sponsor_workflows.get(sponsor.id)
            if not wf:
                continue
            
            latest_reply = db.query(ReplyLog).filter(
                ReplyLog.sponsor_id == sponsor.id
            ).order_by(ReplyLog.received_at.desc()).first()
            
            if latest_reply and latest_reply.classification and not wf.reply_received:
                wf.reply_received = True
                wf.reply_classification = latest_reply.classification
                wf.reply_summary = latest_reply.summary
                wf.reply_suggested_action = latest_reply.suggested_action
                wf.reply_suggested_response = latest_reply.suggested_response
                
                state.stats["replies_received"] += 1
                
                if latest_reply.classification == ReplyClassification.INTERESTED:
                    state.stats["interested"] += 1
                    wf.stage = WorkflowStage.MEETING
                    logger.info(f"  ???? {sponsor.company_name} is INTERESTED!")
                elif latest_reply.classification == ReplyClassification.DECLINED:
                    state.stats["declined"] += 1
                    wf.stage = WorkflowStage.COMPLETED
                    logger.info(f"  ???? {sponsor.company_name} DECLINED")
                else:
                    logger.info(f"  ???? {sponsor.company_name} - no clear reply")
    
    return state


def follow_up_node(state: AgentState) -> AgentState:
    """Check and process follow-ups."""
    logger.info("???? Follow-up node: checking for due follow-ups...")
    
    with get_db_context() as db:
        followup_service = FollowUpService(db)
        actions = followup_service.check_and_schedule_follow_ups()
        
        for action in actions:
            if action.sponsor_id in state.paused_sponsors:
                continue
            
            sponsor = db.query(Sponsor).filter(Sponsor.id == action.sponsor_id).first()
            if not sponsor:
                continue
            
            latest_reply = db.query(ReplyLog).filter(
                ReplyLog.sponsor_id == sponsor.id
            ).order_by(ReplyLog.received_at.desc()).first()
            
            if latest_reply and latest_reply.classification in [ReplyClassification.INTERESTED, ReplyClassification.DECLINED]:
                logger.info(f"  ??? Skipping follow-up for {sponsor.company_name} - already replied")
                continue
            
            sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
            if not sender:
                sender = db.query(TeamMember).filter(TeamMember.is_active == True).first()
            
            if not sender:
                continue
            
            event_data = {
                "name": "Tech Event",
                "date": "Upcoming",
                "expected_attendees": 100
            }
            sender_data = {"name": sender.name, "role": sender.role, "club_name": "Student Tech Club", "email": sender.email}
            
            draft = followup_service.generate_follow_up_draft(
                sponsor, action.follow_up_number, event_data, sender_data, sender_data
            )
            
            followup = followup_service.create_follow_up_schedule(
                action.sponsor_id, action.follow_up_number, action.scheduled_at,
                draft.subject, draft.body, draft.body_html
            )
            
            email_log = EmailLog(
                sponsor_id=sponsor.id,
                sender_id=sender.id,
                subject=draft.subject,
                body=draft.body,
                body_html=draft.body_html,
                email_type=f"follow_up_{action.follow_up_number}",
                follow_up_number=action.follow_up_number,
                status=EmailStatus.DRAFT
            )
            db.add(email_log)
            db.flush()
            
            followup.email_id = email_log.id
            followup.status = "created"
            
            sponsor.follow_up_count = action.follow_up_number
            sponsor.status = SponsorStatus.FOLLOW_UP
            sponsor.next_follow_up_at = action.scheduled_at
            
            NotificationService(db).notify_follow_up_due(sponsor)
            
            db.commit()
            
            logger.info(f"  ??? Created follow-up #{action.follow_up_number} draft for {sponsor.company_name}")
    
    return state


def meeting_node(state: AgentState) -> AgentState:
    """Process interested sponsors for meetings."""
    logger.info("???? Meeting node: processing interested sponsors...")
    
    with get_db_context() as db:
        interested_sponsors = db.query(Sponsor).filter(
            Sponsor.status == SponsorStatus.INTERESTED,
            Sponsor.meeting_status == MeetingStatus.REQUESTED
        ).all()
        
        for sponsor in interested_sponsors:
            if sponsor.id in state.paused_sponsors:
                continue
            
            # Check if meeting already exists in database
            existing_meeting = db.query(Meeting).filter(
                Meeting.sponsor_id == sponsor.id,
                Meeting.status.in_([MeetingStatus.REQUESTED, MeetingStatus.SCHEDULED])
            ).first()
            if existing_meeting:
                # Update workflow state
                wf = state.sponsor_workflows.get(str(sponsor.id))
                if wf:
                    wf.meeting_id = existing_meeting.id
                    wf.meeting_status = existing_meeting.status
                continue
            
            wf = state.sponsor_workflows.get(str(sponsor.id))
            if not wf:
                continue
            
            try:
                sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
                if not sender:
                    sender = db.query(TeamMember).filter(TeamMember.is_active == True).first()
                
                if not sender:
                    continue
                
                meeting_service = MeetingService(db)
                meeting = meeting_service.request_meeting(
                    sponsor_id=sponsor.id,
                    team_member_id=sender.id,
                    title=f"Sponsorship Discussion: {sponsor.company_name}",
                    description=f"Discuss sponsorship options for {sponsor.company_name}"
                )
                
                wf.meeting_id = meeting.id
                wf.meeting_status = MeetingStatus.REQUESTED
                state.stats["meetings_scheduled"] += 1
                
                logger.info(f"  ??? Created meeting request for {sponsor.company_name}")
            except Exception as e:
                logger.error(f"  ??? Meeting creation failed for {sponsor.company_name}: {e}")
    
    return state


def human_approval_check_node(state: AgentState) -> AgentState:
    """Check for human-approved emails and send them. Does NOT auto-approve."""
    logger.info("Human approval check: checking for approved emails...")
    
    sponsor_ids = [int(sid) for sid in state.sponsor_workflows.keys()]
    
    with get_db_context() as db:
        approved_emails = db.query(EmailLog).filter(
            EmailLog.sponsor_id.in_(sponsor_ids),
            EmailLog.status == EmailStatus.APPROVED
        ).all()
        
        for email in approved_emails:
            wf = state.sponsor_workflows.get(str(email.sponsor_id))
            if wf and email.sponsor_id in state.paused_sponsors:
                continue
            
            # Duplicate check
            from app.services.duplicate_prevention import check_duplicate_before_send
            dup_check = check_duplicate_before_send(db, email.sponsor_id, email.sender_id)
            if dup_check.is_duplicate:
                logger.warning(f"  Warning: Duplicate check failed for {email.sponsor_id}")
                continue
            
            # Send the approved email
            logger.info(f"  Sending approved email for sponsor {email.sponsor_id}")
            
            # This will be handled by the approval_node
            pass
        
    return state


def check_completion_node(state: AgentState) -> AgentState:
    """Check if there's more work to do."""
    has_work = False
    
    with get_db_context() as db:
        # Check for approved emails waiting to be sent
        sponsor_ids = [int(sid) for sid in state.sponsor_workflows.keys()]
        approved_count = db.query(EmailLog).filter(
            EmailLog.sponsor_id.in_(sponsor_ids),
            EmailLog.status == EmailStatus.APPROVED
        ).count()
        if approved_count > 0:
            has_work = True
            logger.info(f"Found {approved_count} approved emails waiting to be sent")
        
        for wf in state.sponsor_workflows.values():
            if wf.sponsor_id in state.paused_sponsors:
                continue
            
            # Get current sponsor from DB
            sponsor = db.query(Sponsor).filter(Sponsor.id == wf.sponsor_id).first()
            if not sponsor:
                continue
            
            # Check if workflow is truly done
            is_done = False
            
            if wf.stage in [WorkflowStage.COMPLETED, WorkflowStage.ERROR]:
                is_done = True
            elif sponsor.status == SponsorStatus.INTERESTED:
                # Interested sponsors move to meeting stage
                wf.stage = WorkflowStage.MEETING
                has_work = True
            elif sponsor.status == SponsorStatus.DECLINED:
                # Declined sponsors are done
                wf.stage = WorkflowStage.COMPLETED
                is_done = True
            elif sponsor.follow_up_count >= 2 and sponsor.status != SponsorStatus.INTERESTED:
                # Max follow-ups reached, no reply
                wf.stage = WorkflowStage.COMPLETED
                is_done = True
            elif wf.stage == WorkflowStage.WAITING_FOR_REPLY:
                # Still waiting for reply - keep working
                has_work = True
            elif wf.stage in [WorkflowStage.GENERATE_EMAILS, WorkflowStage.PENDING_APPROVAL, WorkflowStage.SENDING]:
                # Still in email sending pipeline
                has_work = True
            elif wf.stage == WorkflowStage.MEETING:
                # Meeting scheduled or in progress
                has_work = True
            
            if not is_done:
                has_work = True
    
    if not has_work and state.sponsor_workflows:
        logger.info("No more work for current sponsors")
        state.running = False
    
    return state


# ============================================================
# LangGraph Workflow Definition
# ============================================================

def create_sponsorship_agent() -> StateGraph:
    """Create the LangGraph workflow for sponsorship automation."""
    
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("research", research_node)
    workflow.add_node("prioritize", prioritize_node)
    workflow.add_node("generate_emails", generate_emails_node)
    workflow.add_node("human_approval_check", human_approval_check_node)
    workflow.add_node("approval", approval_node)
    workflow.add_node("monitor_replies", monitor_replies_node)
    workflow.add_node("follow_up", follow_up_node)
    workflow.add_node("meeting", meeting_node)
    workflow.add_node("check_completion", check_completion_node)
    
    # Define edges - linear workflow
    workflow.set_entry_point("research")
    
    workflow.add_edge("research", "prioritize")
    workflow.add_edge("prioritize", "generate_emails")
    workflow.add_edge("generate_emails", "human_approval_check")
    workflow.add_edge("human_approval_check", "approval")
    workflow.add_edge("approval", "monitor_replies")
    workflow.add_edge("monitor_replies", "follow_up")
    workflow.add_edge("follow_up", "meeting")
    workflow.add_edge("meeting", "check_completion")
    workflow.add_edge("check_completion", END)
    
    # Compile without checkpointer - state is managed manually by SponsyBotAgent
    return workflow.compile()


# ============================================================
# Agent Runner
# ============================================================

class SponsyBotAgent:
    """Main agent runner for SponsyBot."""
    
    def __init__(self, event_id: Optional[int] = None, campaign_name: str = "Sponsorship Campaign"):
        self.event_id = event_id
        self.campaign_name = campaign_name
        self.agent = create_sponsorship_agent()
        self.config = {"configurable": {"thread_id": f"campaign_{event_id or 'default'}"}}
        self.state = AgentState(event_id=event_id, campaign_name=campaign_name)
    
    def load_sponsors(self, sponsor_ids: List[int] = None):
        """Load sponsors into workflow state."""
        with get_db_context() as db:
            query = db.query(Sponsor)
            if sponsor_ids:
                query = query.filter(Sponsor.id.in_(sponsor_ids))
            else:
                query = query.filter(Sponsor.status != SponsorStatus.CLOSED)
            
            sponsors = query.all()
            self.state.stats["total"] = len(sponsors)
            
            for sponsor in sponsors:
                sid = str(sponsor.id)
                self.state.sponsor_workflows[sid] = SponsorWorkflowState(
                    sponsor_id=sponsor.id,
                    company_name=sponsor.company_name,
                    event_id=self.event_id,
                    assignee_id=sponsor.assignee_id
                )
    
    def run_step(self) -> AgentState:
        """Run one step of the workflow."""
        result = self.agent.invoke(self.state, config=self.config)
        # Merge returned state back into our dataclass
        if isinstance(result, dict):
            self.state.running = result.get('running', self.state.running)
            self.state.paused_sponsors = result.get('paused_sponsors', self.state.paused_sponsors)
            self.state.stats = result.get('stats', self.state.stats)
            # sponsor_workflows needs special handling - they are SponsorWorkflowState objects
            if 'sponsor_workflows' in result:
                for sid, wf_obj in result['sponsor_workflows'].items():
                    if sid in self.state.sponsor_workflows:
                        wf = self.state.sponsor_workflows[sid]
                        # wf_obj is a SponsorWorkflowState object, not a dict
                        if hasattr(wf_obj, 'stage'):
                            wf.stage = wf_obj.stage
                        if hasattr(wf_obj, 'current_email_id'):
                            wf.current_email_id = wf_obj.current_email_id
                        if hasattr(wf_obj, 'email_type'):
                            wf.email_type = wf_obj.email_type
                        if hasattr(wf_obj, 'follow_up_number'):
                            wf.follow_up_number = wf_obj.follow_up_number
                        if hasattr(wf_obj, 'approval_status'):
                            wf.approval_status = wf_obj.approval_status
                        if hasattr(wf_obj, 'approver_id'):
                            wf.approver_id = wf_obj.approver_id
                        if hasattr(wf_obj, 'reply_received'):
                            wf.reply_received = wf_obj.reply_received
                        if hasattr(wf_obj, 'reply_classification'):
                            wf.reply_classification = wf_obj.reply_classification
                        if hasattr(wf_obj, 'reply_summary'):
                            wf.reply_summary = wf_obj.reply_summary
                        if hasattr(wf_obj, 'reply_suggested_action'):
                            wf.reply_suggested_action = wf_obj.reply_suggested_action
                        if hasattr(wf_obj, 'reply_suggested_response'):
                            wf.reply_suggested_response = wf_obj.reply_suggested_response
                        if hasattr(wf_obj, 'follow_ups_sent'):
                            wf.follow_ups_sent = wf_obj.follow_ups_sent
                        if hasattr(wf_obj, 'meeting_id'):
                            wf.meeting_id = wf_obj.meeting_id
                        if hasattr(wf_obj, 'meeting_status'):
                            wf.meeting_status = wf_obj.meeting_status
                        if hasattr(wf_obj, 'sponsorship_won'):
                            wf.sponsorship_won = wf_obj.sponsorship_won
                        if hasattr(wf_obj, 'error'):
                            wf.error = wf_obj.error
        return self.state
    
    def run_continuous(self, max_iterations: int = 100, interval_seconds: int = 300):
        """Run the agent continuously."""
        print(f"[PRINT] run_continuous called: running={self.state.running}, max_iterations={max_iterations}", flush=True)
        print(f"[PRINT] run_continuous ENTRY: running={self.state.running}, max_iterations={max_iterations}", flush=True)
        logger.info(f"???? Starting SponsyBot Agent for campaign: {self.campaign_name}")
        
        iteration = 0
        while self.state.running and iteration < max_iterations:
            iteration += 1
            print(f"[PRINT] Starting iteration {iteration}", flush=True)
            logger.info("
--- Iteration {iteration} ---".format(iteration=iteration))
            
            try:
                self.run_step()
                
                print(f"[PRINT] After run_step: running={self.state.running}, stats={self.state.stats}", flush=True)
                logger.info(f"Stats: {self.state.stats}")
                
                if self.state.running:
                    print(f"[PRINT] Sleeping {interval_seconds}s", flush=True)
                    logger.info(f"??? Waiting {interval_seconds}s before next cycle...")
                    time.sleep(interval_seconds)
            except Exception as e:
                print(f"[PRINT] Exception in iteration: {e}", flush=True)
                logger.error(f"Agent error: {e}")
                time.sleep(60)
        
        print(f"[PRINT] run_continuous exiting: running={self.state.running}, iteration={iteration}", flush=True)
        logger.info("???? SponsyBot Agent stopped")
        return self.state


    def get_sponsor_status(self, sponsor_id: int) -> Optional[Dict]:
        """Get workflow status for a sponsor."""
        wf = self.state.sponsor_workflows.get(sponsor_id)
        if wf:
            return wf.to_dict()
        return None
    
    def pause_sponsor(self, sponsor_id: int):
        """Pause workflow for a sponsor."""
        if sponsor_id not in self.state.paused_sponsors:
            self.state.paused_sponsors.append(sponsor_id)
    
    def resume_sponsor(self, sponsor_id: int):
        """Resume workflow for a sponsor."""
        if sponsor_id in self.state.paused_sponsors:
            self.state.paused_sponsors.remove(sponsor_id)
    
    def approve_email(self, sponsor_id: int, approver_id: int) -> bool:
        """Approve an email for a sponsor (called from webhook/UI)."""
        with get_db_context() as db:
            # First try to find a pending approval email
            email = db.query(EmailLog).filter(
                EmailLog.sponsor_id == sponsor_id,
                EmailLog.status == EmailStatus.PENDING_APPROVAL
            ).order_by(EmailLog.created_at.desc()).first()
            
            # If no pending approval, check for draft (auto-submit for approval)
            if not email:
                email = db.query(EmailLog).filter(
                    EmailLog.sponsor_id == sponsor_id,
                    EmailLog.status == EmailStatus.DRAFT
                ).order_by(EmailLog.created_at.desc()).first()
            
            if not email:
                return False
            
            from app.services.duplicate_prevention import check_duplicate_before_send
            dup_check = check_duplicate_before_send(db, email.sponsor_id, email.sender_id)
            if dup_check.is_duplicate:
                return False
            
            email.status = EmailStatus.APPROVED
            email.approved_by = approver_id
            email.approved_at = datetime.utcnow()
            db.commit()
            return True
    
    def reject_email(self, sponsor_id: int, rejecter_id: int, reason: str) -> bool:
        """Reject an email for a sponsor."""
        with get_db_context() as db:
            email = db.query(EmailLog).filter(
                EmailLog.sponsor_id == sponsor_id,
                EmailLog.status.in_([EmailStatus.DRAFT, EmailStatus.PENDING_APPROVAL, EmailStatus.APPROVED])
            ).order_by(EmailLog.created_at.desc()).first()
            
            if not email:
                return False
            
            email.status = EmailStatus.REJECTED
            email.rejected_by = rejecter_id
            email.rejected_at = datetime.utcnow()
            email.rejection_reason = reason
            
            if email.follow_up_number > 0:
                followup = db.query(FollowUpSchedule).filter(
                    FollowUpSchedule.email_id == email.id
                ).first()
                if followup:
                    followup.status = "cancelled"
                
                sponsor = db.query(Sponsor).filter(Sponsor.id == email.sponsor_id).first()
                if sponsor and sponsor.follow_up_count > 0:
                    sponsor.follow_up_count -= 1
            
            db.commit()
            return True
    
    def process_webhook_reply(self, payload: Dict) -> Dict:
        """Process a reply from email webhook."""
        from_email = payload.get("from_email") or payload.get("from")
        subject = payload.get("subject", "")
        body = payload.get("body") or payload.get("text") or payload.get("body-text", "")
        message_id = payload.get("message_id") or payload.get("Message-ID")
        in_reply_to = payload.get("in_reply_to") or payload.get("In-Reply-To")
        to_email = payload.get("to_email") or payload.get("to")
        
        if not from_email or not body:
            return {"error": "Missing required fields"}
        
        with get_db_context() as db:
            original_email = None
            if in_reply_to:
                original_email = db.query(EmailLog).filter(EmailLog.message_id == in_reply_to).first()
            
            if not original_email and to_email:
                original_email = db.query(EmailLog).filter(
                    EmailLog.status == EmailStatus.SENT
                ).join(Sponsor).filter(Sponsor.contact_email.ilike(to_email)).first()
            
            if not original_email:
                original_email = db.query(EmailLog).filter(
                    EmailLog.status == EmailStatus.SENT
                ).join(Sponsor).filter(Sponsor.contact_email.ilike(from_email)).first()
            
            if not original_email:
                return {"status": "received", "message": "No matching outreach found"}
            
            sponsor_id = original_email.sponsor_id
            
            result = process_reply_tool.invoke({
                "sponsor_id": sponsor_id,
                "from_email": from_email,
                "subject": subject,
                "body": body,
                "message_id": message_id,
                "in_reply_to": in_reply_to
            })
            
            wf = self.state.sponsor_workflows.get(sponsor_id)
            if wf:
                wf.reply_received = True
                wf.reply_classification = ReplyClassification(result.get("classification", "No Reply"))
                wf.reply_summary = result.get("summary")
                wf.reply_suggested_action = result.get("suggested_action")
                wf.reply_suggested_response = result.get("suggested_response")
                
                if result.get("classification") == "Interested":
                    wf.stage = WorkflowStage.MEETING
                elif result.get("classification") == "Declined":
                    wf.stage = WorkflowStage.COMPLETED
            
            return {"status": "processed", "sponsor_id": sponsor_id, "result": result}


# ============================================================
# CLI Entry Point
# ============================================================

def run_agent_cli(event_id: int = None, campaign_name: str = "Sponsorship Campaign", 
                  max_iterations: int = 100, interval: int = 300):
    """Run the agent from command line."""
    agent = SponsyBotAgent(event_id=event_id, campaign_name=campaign_name)
    agent.load_sponsors()
    return agent.run_continuous(max_iterations=max_iterations, interval_seconds=interval)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "run-agent":
        event_id = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else None
        run_agent_cli(event_id=event_id)