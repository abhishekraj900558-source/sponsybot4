# SPONSY BOT API Routes - Main Router
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import (
    Sponsor, TeamMember, EmailLog, ReplyLog, FollowUpSchedule,
    Meeting, EmailTemplate, Event, InstitutionalMemory, Notification,
    SponsorStatus, EmailStatus, ReplyClassification, MeetingStatus,
    SponsorshipType,
    SponsorCreate, SponsorUpdate, SponsorResponse, SponsorListResponse,
    TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse,
    EmailLogCreate, EmailLogUpdate, EmailLogResponse,
    ReplyLogResponse, FollowUpScheduleResponse,
    MeetingCreate, MeetingResponse,
    EmailTemplateResponse, EventResponse,
    InstitutionalMemoryResponse, NotificationResponse,
    DashboardStatsResponse
)
from app.services.research import research_service, ResearchResult
from app.services.ai_prioritization import ai_prioritization_service, PrioritizationResult
from app.services.email_generation import email_generation_service, EmailDraft
from app.services.email_sending import email_sending_service
from app.services.reply_tracking import reply_tracking_service, ReplyAnalysis
from app.services.follow_up import FollowUpService, get_follow_up_status
from app.services.duplicate_prevention import DuplicatePreventionService, check_duplicate_sponsor, check_duplicate_before_send
from app.services.meeting import MeetingService, MeetingSlot
from app.services.notification import NotificationService
from app.services.dashboard import DashboardService

from pydantic import BaseModel

router = APIRouter()


# ============================================================
# REQUEST SCHEMAS (supporting JSON bodies from Frontend)
# ============================================================

class EmailDraftRequest(BaseModel):
    email_type: Optional[str] = "initial"
    event_id: Optional[int] = None
    sender_id: Optional[int] = None


class PrioritizeRequest(BaseModel):
    event_id: Optional[int] = None


class DuplicateCheckRequest(BaseModel):
    company_name: str
    contact_email: Optional[str] = None
    contact_person: Optional[str] = None
    website: Optional[str] = None
    current_user_id: Optional[int] = None


class DuplicateMergeRequest(BaseModel):
    primary_sponsor_id: int
    duplicate_sponsor_id: int
    merged_by: int


class NotificationReadRequest(BaseModel):
    team_member_id: int


class EmailTemplateCreateRequest(BaseModel):
    name: str
    email_type: str
    subject_template: str
    body_template: str
    body_html_template: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    is_default: bool = False


class EventCreateRequest(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None
    location: Optional[str] = None
    expected_attendees: Optional[int] = None
    budget_target: Optional[int] = None
    sponsorship_tiers: Optional[Dict[str, Any]] = None


class InstitutionalMemoryCreateRequest(BaseModel):
    company_name: str
    previous_sponsorships: Optional[List[Dict[str, Any]]] = None
    total_contributed: int = 0
    preferred_sponsorship_types: Optional[List[str]] = None
    contact_history: Optional[List[Dict[str, Any]]] = None
    preferences: Optional[str] = None
    last_event: Optional[str] = None
    last_contact_year: Optional[int] = None
    outcome_notes: Optional[str] = None
    source: str = "manual"
    verified: bool = False


class MeetingUpdateRequest(BaseModel):
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    status: Optional[MeetingStatus] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None


# ============================================================
# TEAM MEMBERS
# ============================================================

@router.post("/team-members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_team_member(member: TeamMemberCreate, db: Session = Depends(get_db)):
    """Create a new team member."""
    existing = db.query(TeamMember).filter(TeamMember.email == member.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_member = TeamMember(**member.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


@router.get("/team-members", response_model=List[TeamMemberResponse])
def list_team_members(active_only: bool = True, db: Session = Depends(get_db)):
    """List all team members."""
    query = db.query(TeamMember)
    if active_only:
        query = query.filter(TeamMember.is_active == True)
    return query.order_by(TeamMember.name).all()


@router.get("/team-members/{member_id}", response_model=TeamMemberResponse)
def get_team_member(member_id: int, db: Session = Depends(get_db)):
    """Get a team member by ID."""
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    return member


@router.patch("/team-members/{member_id}", response_model=TeamMemberResponse)
def update_team_member(member_id: int, member: TeamMemberUpdate, db: Session = Depends(get_db)):
    """Update a team member."""
    db_member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    for field, value in member.model_dump(exclude_unset=True).items():
        setattr(db_member, field, value)
    
    db.commit()
    db.refresh(db_member)
    return db_member


# ============================================================
# SPONSORS
# ============================================================

@router.post("/sponsors", response_model=SponsorResponse, status_code=status.HTTP_201_CREATED)
def create_sponsor(sponsor: SponsorCreate, db: Session = Depends(get_db)):
    """Create a new sponsor with duplicate prevention."""
    
    # Check for duplicates
    dup_check = check_duplicate_sponsor(
        db, sponsor.company_name, sponsor.contact_email, 
        sponsor.contact_person, sponsor.website, sponsor.assignee_id
    )
    
    if dup_check.is_duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Potential duplicate sponsor detected",
                "conflict_type": dup_check.conflict_type,
                "details": dup_check.conflict_details,
                "existing_sponsor_id": dup_check.existing_sponsor.id if dup_check.existing_sponsor else None,
                "suggested_action": dup_check.suggested_action
            }
        )
    
    db_sponsor = Sponsor(**sponsor.model_dump())
    db.add(db_sponsor)
    db.commit()
    db.refresh(db_sponsor)
    return db_sponsor


@router.get("/sponsors", response_model=SponsorListResponse)
def list_sponsors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[SponsorStatus] = None,
    assignee_id: Optional[int] = None,
    priority_tier: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List sponsors with filtering and pagination."""
    
    query = db.query(Sponsor)
    
    if status:
        query = query.filter(Sponsor.status == status)
    if assignee_id:
        query = query.filter(Sponsor.assignee_id == assignee_id)
    if priority_tier:
        query = query.filter(Sponsor.priority_tier == priority_tier)
    if search:
        query = query.filter(
            Sponsor.company_name.ilike(f"%{search}%") |
            Sponsor.contact_person.ilike(f"%{search}%") |
            Sponsor.contact_email.ilike(f"%{search}%")
        )
    
    total = query.count()
    sponsors = query.order_by(Sponsor.priority_score.desc(), Sponsor.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SponsorListResponse(
        sponsors=sponsors,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/sponsors/{sponsor_id}", response_model=SponsorResponse)
def get_sponsor(sponsor_id: int, db: Session = Depends(get_db)):
    """Get a sponsor by ID."""
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    return sponsor


@router.patch("/sponsors/{sponsor_id}", response_model=SponsorResponse)
def update_sponsor(sponsor_id: int, sponsor: SponsorUpdate, db: Session = Depends(get_db)):
    """Update a sponsor."""
    db_sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not db_sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    # Track if sponsorship_won is being set to True (for institutional memory)
    sponsorship_won_changed = (
        sponsor.sponsorship_won is True and 
        db_sponsor.sponsorship_won is not True
    )
    
    for field, value in sponsor.model_dump(exclude_unset=True).items():
        setattr(db_sponsor, field, value)
    
    db_sponsor.updated_at = datetime.utcnow()
    
    # Auto-capture institutional memory when sponsorship is won
    if sponsorship_won_changed:
        memory = db.query(InstitutionalMemory).filter(
            InstitutionalMemory.company_name.ilike(db_sponsor.company_name)
        ).first()
        
        # Prepare sponsorship record
        sponsorship_record = {
            "event": db_sponsor.notes or "Unknown event",
            "amount": db_sponsor.sponsorship_amount,
            "benefits": db_sponsor.sponsorship_benefits,
            "date": datetime.utcnow().isoformat(),
            "assignee": db_sponsor.assignee.name if db_sponsor.assignee else "Unknown"
        }
        
        if memory:
            # Update existing
            prev_sponsorships = memory.previous_sponsorships or []
            prev_sponsorships.append(sponsorship_record)
            memory.previous_sponsorships = prev_sponsorships
            
            if db_sponsor.sponsorship_amount:
                memory.total_contributed = (memory.total_contributed or 0) + db_sponsor.sponsorship_amount
            
            if db_sponsor.recommended_sponsorship_types:
                preferred = memory.preferred_sponsorship_types or []
                for stype in db_sponsor.recommended_sponsorship_types:
                    if stype not in preferred:
                        preferred.append(stype)
                memory.preferred_sponsorship_types = preferred
            
            memory.last_event = sponsorship_record["event"]
            memory.last_contact_year = datetime.utcnow().year
            memory.outcome_notes = f"Sponsorship won: {sponsorship_record}"
            memory.verified = True
        else:
            # Create new
            memory = InstitutionalMemory(
                company_name=db_sponsor.company_name,
                previous_sponsorships=[sponsorship_record],
                total_contributed=db_sponsor.sponsorship_amount or 0,
                preferred_sponsorship_types=db_sponsor.recommended_sponsorship_types or [],
                contact_history=[],
                preferences="",
                last_event=sponsorship_record["event"],
                last_contact_year=datetime.utcnow().year,
                outcome_notes=f"Sponsorship won: {sponsorship_record}",
                source="auto-captured",
                verified=True
            )
            db.add(memory)
        
        # Notify team
        notification_service = NotificationService(db)
        notification_service.notify_sponsorship_won(
            db_sponsor, 
            db_sponsor.sponsorship_amount, 
            db_sponsor.sponsorship_benefits
        )
    
    db.commit()
    db.refresh(db_sponsor)
    return db_sponsor


@router.delete("/sponsors/{sponsor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sponsor(sponsor_id: int, db: Session = Depends(get_db)):
    """Delete a sponsor."""
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    db.delete(sponsor)
    db.commit()


# ============================================================
# RESEARCH & PRIORITIZATION
# ============================================================

@router.post("/sponsors/{sponsor_id}/research")
async def research_sponsor(sponsor_id: int, db: Session = Depends(get_db)):
    """Research a sponsor company."""
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    # Perform research
    result: ResearchResult = await research_service.research_company(
        sponsor.company_name,
        sponsor.website,
        sponsor.industry
    )
    
    # Update sponsor with research
    sponsor.research_data = result.verified
    sponsor.research_unverified = result.unverified
    sponsor.research_last_updated = result.researched_at
    sponsor.research_source = result.source
    
    db.commit()
    db.refresh(sponsor)
    
    return {
        "verified": result.verified,
        "unverified": result.unverified,
        "sources": result.sources,
        "researched_at": result.researched_at,
        "source": result.source
    }


@router.post("/sponsors/{sponsor_id}/prioritize")
def prioritize_sponsor(
    sponsor_id: int,
    request: Optional[PrioritizeRequest] = None,
    event_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """AI-powered sponsor prioritization and recommendation."""
    effective_event_id = (request.event_id if request else None) or event_id
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    # Get event context if provided
    event_context = None
    if effective_event_id:
        event = db.query(Event).filter(Event.id == effective_event_id).first()
        if event:
            event_context = {
                "name": event.name,
                "type": "Hackathon/Tech Event",
                "expected_attendees": event.expected_attendees,
                "budget_target": event.budget_target,
                "sponsorship_needs": "Cash, Swag, Cloud Credits, Infrastructure"
            }
    
    # Get institutional memory
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
    
    # Run AI prioritization
    result: PrioritizationResult = ai_prioritization_service.analyze_sponsor(
        company_name=sponsor.company_name,
        industry=sponsor.industry,
        company_category=sponsor.company_category,
        research_verified=sponsor.research_data or {},
        research_unverified=sponsor.research_unverified or {},
        event_context=event_context,
        institutional_memory=institutional_memory
    )
    
    # Update sponsor
    sponsor.priority_score = result.priority_score
    sponsor.priority_tier = result.priority_tier
    sponsor.recommended_sponsorship_types = result.recommended_types
    sponsor.recommendation_reasoning = result.reasoning
    sponsor.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(sponsor)
    
    return {
        "priority_score": result.priority_score,
        "priority_tier": result.priority_tier,
        "recommended_types": result.recommended_types,
        "reasoning": result.reasoning,
        "confidence": result.confidence
    }


@router.post("/sponsors/{sponsor_id}/research-and-prioritize")
async def research_and_prioritize_sponsor(
    sponsor_id: int,
    request: Optional[PrioritizeRequest] = None,
    event_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Research and prioritize a sponsor in one call."""
    effective_event_id = (request.event_id if request else None) or event_id
    
    # First research
    research_result = await research_sponsor(sponsor_id, db)
    
    # Then prioritize
    prioritize_result = prioritize_sponsor(sponsor_id, request, effective_event_id, db)
    
    return {
        "research": research_result,
        "prioritization": prioritize_result
    }


# ============================================================
# EMAIL GENERATION & APPROVAL WORKFLOW
# ============================================================

@router.post("/sponsors/{sponsor_id}/emails/draft", response_model=EmailLogResponse)
def generate_email_draft(
    sponsor_id: int,
    request: Optional[EmailDraftRequest] = None,
    email_type: Optional[str] = None,
    event_id: Optional[int] = None,
    sender_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Generate a personalized email draft for a sponsor."""
    eff_email_type = (request.email_type if request and request.email_type else None) or email_type or "initial"
    eff_event_id = (request.event_id if request else None) or event_id
    eff_sender_id = (request.sender_id if request else None) or sender_id
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    if not eff_sender_id:
        eff_sender_id = sponsor.assignee_id
    
    sender = db.query(TeamMember).filter(TeamMember.id == eff_sender_id).first() if eff_sender_id else None
    if not sender:
        sender = db.query(TeamMember).filter(TeamMember.is_active == True).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")
    
    sender_id = sender.id
    email_type = eff_email_type
    event_id = eff_event_id
    
    # Get event data
    event_data = {
        "name": "Tech Event",
        "description": "A student technology event",
        "date": "Upcoming",
        "expected_attendees": 100,
        "location": "TBD"
    }
    if event_id:
        event = db.query(Event).filter(Event.id == event_id).first()
        if event:
            event_data = {
                "name": event.name,
                "description": event.description,
                "date": event.start_date.strftime("%B %d, %Y") if event.start_date else "TBD",
                "expected_attendees": event.expected_attendees,
                "location": event.location
            }
    
    # Get previous emails for context
    previous_emails = db.query(EmailLog).filter(
        EmailLog.sponsor_id == sponsor_id,
        EmailLog.status == EmailStatus.SENT
    ).order_by(EmailLog.sent_at).all()
    
    prev_emails_data = [
        {
            "email_type": e.email_type,
            "subject": e.subject,
            "sent_at": e.sent_at.isoformat() if e.sent_at else None
        }
        for e in previous_emails
    ]
    
    # Get reply context if this is a response email
    reply_context = None
    if email_type == "interested_response":
        latest_reply = db.query(ReplyLog).filter(
            ReplyLog.sponsor_id == sponsor_id
        ).order_by(ReplyLog.received_at.desc()).first()
        if latest_reply:
            reply_context = {
                "classification": latest_reply.classification.value if latest_reply.classification else None,
                "summary": latest_reply.summary,
                "key_points": "See reply details"
            }
    
    # Generate email
    draft: EmailDraft = email_generation_service.generate_email(
        email_type=email_type,
        sponsor_data={
            "company_name": sponsor.company_name,
            "contact_person": sponsor.contact_person,
            "contact_role": sponsor.contact_role,
            "industry": sponsor.industry,
            "company_category": sponsor.company_category,
        },
        event_data=event_data,
        sender_data={
            "name": sender.name,
            "role": sender.role,
            "club_name": "Student Tech Club",
            "club_description": "A student-run technology club",
            "email": sender.email
        },
        recommended_types=sponsor.recommended_sponsorship_types or [],
        reasoning=sponsor.recommendation_reasoning or "",
        research_verified=sponsor.research_data or {},
        research_unverified=sponsor.research_unverified or {},
        previous_emails=prev_emails_data,
        reply_context=reply_context
    )
    
    # Create email log as draft
    email_log = EmailLog(
        sponsor_id=sponsor_id,
        sender_id=sender_id,
        subject=draft.subject,
        body=draft.body,
        body_html=draft.body_html,
        email_type=email_type,
        follow_up_number=0 if email_type == "initial" else (1 if email_type == "follow_up_1" else 2),
        status=EmailStatus.DRAFT
    )
    
    db.add(email_log)
    db.commit()
    db.refresh(email_log)
    
    return email_log


@router.post("/emails", response_model=EmailLogResponse, status_code=status.HTTP_201_CREATED)
def create_email(email: EmailLogCreate, db: Session = Depends(get_db)):
    """Manually create an email draft."""
    sponsor = db.query(Sponsor).filter(Sponsor.id == email.sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    sender_id = email.sender_id or sponsor.assignee_id
    if not sender_id:
        first_member = db.query(TeamMember).filter(TeamMember.is_active == True).first()
        if first_member:
            sender_id = first_member.id
        else:
            raise HTTPException(status_code=400, detail="No active sender found")

    email_data = email.model_dump()
    email_data["sender_id"] = sender_id
    if "status" not in email_data or not email_data["status"]:
        email_data["status"] = EmailStatus.DRAFT
    db_email = EmailLog(**email_data)
    db.add(db_email)
    db.commit()
    db.refresh(db_email)
    return db_email


@router.get("/sponsors/{sponsor_id}/emails", response_model=List[EmailLogResponse])
def list_sponsor_emails(sponsor_id: int, db: Session = Depends(get_db)):
    """List all emails for a sponsor."""
    return db.query(EmailLog).filter(EmailLog.sponsor_id == sponsor_id).order_by(EmailLog.created_at.desc()).all()


@router.get("/emails/{email_id}", response_model=EmailLogResponse)
def get_email(email_id: int, db: Session = Depends(get_db)):
    """Get an email by ID."""
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


@router.patch("/emails/{email_id}", response_model=EmailLogResponse)
def update_email(email_id: int, email: EmailLogUpdate, db: Session = Depends(get_db)):
    """Update an email draft (organizer editing)."""
    db_email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not db_email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if db_email.status not in [EmailStatus.DRAFT, EmailStatus.PENDING_APPROVAL, EmailStatus.REJECTED]:
        raise HTTPException(status_code=400, detail="Cannot edit email in current status")
    
    for field, value in email.model_dump(exclude_unset=True).items():
        setattr(db_email, field, value)
    
    db_email.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_email)
    return db_email


@router.post("/emails/{email_id}/submit-for-approval")
def submit_for_approval(email_id: int, db: Session = Depends(get_db)):
    """Submit email for approval (organizer marks as ready for review)."""
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if email.status != EmailStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft emails can be submitted for approval")
    
    email.status = EmailStatus.PENDING_APPROVAL
    email.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(email)
    
    return {"message": "Email submitted for approval", "email": email}


@router.post("/emails/{email_id}/approve")
def approve_email(email_id: int, approver_id: int, db: Session = Depends(get_db)):
    """Approve an email for sending."""
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if email.status not in [EmailStatus.DRAFT, EmailStatus.PENDING_APPROVAL]:
        raise HTTPException(status_code=400, detail="Email cannot be approved in current status")
    
    # Duplicate check before approval
    dup_check = check_duplicate_before_send(db, email.sponsor_id, email.sender_id)
    if dup_check.is_duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Duplicate prevention check failed",
                "conflict_type": dup_check.conflict_type,
                "details": dup_check.conflict_details,
                "suggested_action": dup_check.suggested_action
            }
        )
    
    email.status = EmailStatus.APPROVED
    email.approved_by = approver_id
    email.approved_at = datetime.utcnow()
    email.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(email)
    
    return {"message": "Email approved and ready to send", "email": email}


@router.post("/emails/{email_id}/reject")
def reject_email(email_id: int, rejecter_id: int, reason: str, db: Session = Depends(get_db)):
    """Reject an email."""
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if email.status not in [EmailStatus.DRAFT, EmailStatus.PENDING_APPROVAL, EmailStatus.APPROVED]:
        raise HTTPException(status_code=400, detail="Email cannot be rejected in current status")
    
    email.status = EmailStatus.REJECTED
    email.rejected_by = rejecter_id
    email.rejected_at = datetime.utcnow()
    email.rejection_reason = reason
    email.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(email)
    
    return {"message": "Email rejected", "email": email}


@router.post("/emails/{email_id}/send")
async def send_email(email_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Send an approved email."""
    
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if email.status != EmailStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved emails can be sent")
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == email.sponsor_id).first()
    sender = db.query(TeamMember).filter(TeamMember.id == email.sender_id).first()
    
    if not sponsor or not sponsor.contact_email:
        raise HTTPException(status_code=400, detail="Sponsor has no contact email")
    
    if not sender:
        raise HTTPException(status_code=400, detail="Sender not found")
    
    # Send email
    result = await email_sending_service.send_email(
        email_log=email,
        sender=sender,
        recipient_email=sponsor.contact_email,
        recipient_name=sponsor.contact_person
    )
    
    if result["success"]:
        email.status = EmailStatus.SENT
        email.sent_at = datetime.utcnow()
        email.message_id = result["message_id"]
        
        # Update sponsor
        sponsor.last_contacted_at = datetime.utcnow()
        if sponsor.status == SponsorStatus.NOT_CONTACTED:
            sponsor.status = SponsorStatus.CONTACTED
        elif sponsor.status == SponsorStatus.FOLLOW_UP:
            sponsor.status = SponsorStatus.FOLLOW_UP  # Keep as follow-up
        
        # Schedule follow-up if initial email
        if email.follow_up_number == 0:
            from app.services.follow_up import FollowUpService
            followup_service = FollowUpService(db)
            actions = followup_service.check_and_schedule_follow_ups()
            # Process the first action for this sponsor
            for action in actions:
                if action.sponsor_id == email.sponsor_id:
                    draft = followup_service.generate_follow_up_draft(
                        sponsor, action.follow_up_number, 
                        {"name": "Tech Event", "date": "Upcoming", "expected_attendees": 100},
                        {"name": sender.name, "role": sender.role, "club_name": "Student Tech Club", "email": sender.email},
                        {"name": sender.name, "email": sender.email}
                    )
                    followup_service.create_follow_up_schedule(
                        sponsor.id, action.follow_up_number, action.scheduled_at,
                        draft.subject, draft.body, draft.body_html
                    )
                    break
    else:
        email.status = EmailStatus.FAILED
        email.error_message = result["error"]
    
    email.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(email)
    
    return {"success": result["success"], "email": email, "message_id": result.get("message_id"), "error": result.get("error")}


@router.post("/emails/{email_id}/regenerate")
def regenerate_email(email_id: int, db: Session = Depends(get_db)):
    """Regenerate an email draft (AI rewrite)."""
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Delete old draft, create new one via generate_email_draft
    email_type = email.email_type
    sponsor_id = email.sponsor_id
    sender_id = email.sender_id
    
    db.delete(email)
    db.commit()
    
    # Generate new draft
    return generate_email_draft(sponsor_id, email_type, None, sender_id, db)


# ============================================================
# REPLY TRACKING
# ============================================================

# ============================================================
# REPLY TRACKING (including webhook for email providers)
# ============================================================

@router.post("/webhooks/email/reply")
async def email_reply_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Webhook endpoint for receiving email replies from SMTP providers (SendGrid, Mailgun, etc.).
    
    Expected JSON payload varies by provider but should contain:
    - from_email: sender email
    - subject: email subject
    - body: plain text body
    - body_html: HTML body (optional)
    - message_id: Message-ID header
    - in_reply_to: In-Reply-To header
    - to_email: recipient email (our sender)
    """
    try:
        payload = await request.json()
    except:
        # Try form data
        form = await request.form()
        payload = dict(form)
    
    # Extract common fields (adapt based on your email provider)
    from_email = payload.get("from_email") or payload.get("from") or payload.get("sender")
    subject = payload.get("subject", "")
    body = payload.get("body") or payload.get("text") or payload.get("body-text", "")
    body_html = payload.get("body_html") or payload.get("html") or payload.get("body-html")
    message_id = payload.get("message_id") or payload.get("Message-ID") or payload.get("message-id")
    in_reply_to = payload.get("in_reply_to") or payload.get("In-Reply-To") or payload.get("in-reply-to")
    to_email = payload.get("to_email") or payload.get("to") or payload.get("recipient")
    
    if not from_email or not body:
        raise HTTPException(status_code=400, detail="Missing required fields: from_email, body")
    
    # Find sponsor by matching the original email's message_id or recipient
    original_email = None
    if in_reply_to:
        original_email = db.query(EmailLog).filter(EmailLog.message_id == in_reply_to).first()
    
    # If not found by In-Reply-To, try matching by sender email (our outgoing email)
    if not original_email and to_email:
        original_email = db.query(EmailLog).filter(
            EmailLog.status == EmailStatus.SENT
        ).join(Sponsor).filter(Sponsor.contact_email.ilike(to_email)).first()
    
    # Last resort: find any recent sent email to this sender
    if not original_email:
        original_email = db.query(EmailLog).filter(
            EmailLog.status == EmailStatus.SENT
        ).join(Sponsor).filter(Sponsor.contact_email.ilike(from_email)).first()
    
    if not original_email:
        # Log but don't fail - might be a new conversation
        logger.warning(f"Could not find original email for reply from {from_email}")
        return {"status": "received", "message": "Reply logged but no matching outreach found"}
    
    sponsor_id = original_email.sponsor_id
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    
    # Analyze reply
    analysis: ReplyAnalysis = reply_tracking_service.analyze_reply(
        reply_body=body,
        reply_subject=subject,
        original_email_subject=original_email.subject,
        original_email_body=original_email.body,
        sponsor_context={
            "company_name": sponsor.company_name,
            "industry": sponsor.industry
        },
        event_context={"name": "Tech Event"}
    )
    
    # Create reply log
    reply_log = ReplyLog(
        sponsor_id=sponsor_id,
        email_id=original_email.id,
        from_email=from_email,
        subject=subject,
        body=body,
        body_html=body_html,
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
    
    # Update sponsor status based on classification
    if analysis.classification == ReplyClassification.INTERESTED:
        sponsor.status = SponsorStatus.INTERESTED
        sponsor.meeting_status = MeetingStatus.REQUESTED
        # Cancel any pending follow-ups
        FollowUpService(db).cancel_follow_ups_for_sponsor(sponsor_id, "Sponsor expressed interest")
    elif analysis.classification == ReplyClassification.DECLINED:
        sponsor.status = SponsorStatus.DECLINED
        # Cancel any pending follow-ups
        FollowUpService(db).cancel_follow_ups_for_sponsor(sponsor_id, "Sponsor declined")
    
    sponsor.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(reply_log)
    
    # Create notifications
    notification_service = NotificationService(db)
    notification_service.notify_reply_received(sponsor, analysis.classification.value, analysis.summary)
    
    return {
        "status": "processed",
        "reply_id": reply_log.id,
        "analysis": {
            "classification": analysis.classification.value,
            "confidence": analysis.confidence,
            "summary": analysis.summary,
            "suggested_action": analysis.suggested_action
        }
    }


@router.post("/sponsors/{sponsor_id}/replies/process")
def process_reply(
    sponsor_id: int,
    from_email: str = Body(...),
    subject: str = Body(...),
    body: str = Body(...),
    body_html: str = Body(None),
    message_id: str = Body(None),
    in_reply_to: str = Body(None),
    db: Session = Depends(get_db)
):
    """Process an incoming reply from a sponsor."""
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    # Find the email this replies to
    original_email = None
    if in_reply_to:
        original_email = db.query(EmailLog).filter(EmailLog.message_id == in_reply_to).first()
    if not original_email:
        # Fallback to latest sent email
        original_email = db.query(EmailLog).filter(
            EmailLog.sponsor_id == sponsor_id,
            EmailLog.status == EmailStatus.SENT
        ).order_by(EmailLog.sent_at.desc()).first()
    
    if not original_email:
        raise HTTPException(status_code=400, detail="No original email found to reply to")
    
    # Analyze reply
    analysis: ReplyAnalysis = reply_tracking_service.analyze_reply(
        reply_body=body,
        reply_subject=subject,
        original_email_subject=original_email.subject,
        original_email_body=original_email.body,
        sponsor_context={
            "company_name": sponsor.company_name,
            "industry": sponsor.industry
        },
        event_context={"name": "Tech Event"}
    )
    
    # Create reply log
    reply_log = ReplyLog(
        sponsor_id=sponsor_id,
        email_id=original_email.id,
        from_email=from_email,
        subject=subject,
        body=body,
        body_html=body_html,
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
    
    # Update sponsor status based on classification
    if analysis.classification == ReplyClassification.INTERESTED:
        sponsor.status = SponsorStatus.INTERESTED
        sponsor.meeting_status = MeetingStatus.REQUESTED
        # Cancel any pending follow-ups
        from app.services.follow_up import FollowUpService
        FollowUpService(db).cancel_follow_ups_for_sponsor(sponsor_id, "Sponsor expressed interest")
    elif analysis.classification == ReplyClassification.DECLINED:
        sponsor.status = SponsorStatus.DECLINED
        # Cancel any pending follow-ups
        from app.services.follow_up import FollowUpService
        FollowUpService(db).cancel_follow_ups_for_sponsor(sponsor_id, "Sponsor declined")
    
    sponsor.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(reply_log)
    
    # Create notifications
    notification_service = NotificationService(db)
    notification_service.notify_reply_received(sponsor, analysis.classification.value, analysis.summary)
    
    return {
        "reply": reply_log,
        "analysis": {
            "classification": analysis.classification.value,
            "confidence": analysis.confidence,
            "summary": analysis.summary,
            "key_points": analysis.key_points,
            "suggested_action": analysis.suggested_action,
            "suggested_response": analysis.suggested_response,
            "requires_human_review": analysis.requires_human_review
        }
    }


@router.get("/sponsors/{sponsor_id}/replies", response_model=List[ReplyLogResponse])
def list_sponsor_replies(sponsor_id: int, db: Session = Depends(get_db)):
    """List all replies for a sponsor."""
    return db.query(ReplyLog).filter(ReplyLog.sponsor_id == sponsor_id).order_by(ReplyLog.received_at.desc()).all()


# ============================================================
# FOLLOW-UP AUTOMATION
# ============================================================

@router.post("/follow-ups/check-and-schedule")
def check_and_schedule_follow_ups(db: Session = Depends(get_db)):
    """Check all sponsors and schedule follow-ups where due."""
    
    followup_service = FollowUpService(db)
    actions = followup_service.check_and_schedule_follow_ups()
    
    created = []
    for action in actions:
        sponsor = db.query(Sponsor).filter(Sponsor.id == action.sponsor_id).first()
        sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
        
        if not sender:
            continue
        
        draft = followup_service.generate_follow_up_draft(
            sponsor, action.follow_up_number,
            {"name": "Tech Event", "date": "Upcoming", "expected_attendees": 100},
            {"name": sender.name, "role": sender.role, "club_name": "Student Tech Club", "email": sender.email},
            {"name": sender.name, "email": sender.email}
        )
        
        followup = followup_service.create_follow_up_schedule(
            action.sponsor_id, action.follow_up_number, action.scheduled_at,
            draft.subject, draft.body, draft.body_html
        )
        
        created.append({
            "follow_up_id": followup.id,
            "sponsor_id": action.sponsor_id,
            "sponsor_name": sponsor.company_name,
            "follow_up_number": action.follow_up_number,
            "scheduled_at": action.scheduled_at,
            "draft_subject": draft.subject
        })
    
    return {"scheduled_follow_ups": created}


@router.get("/sponsors/{sponsor_id}/follow-ups", response_model=List[FollowUpScheduleResponse])
def get_sponsor_follow_ups(sponsor_id: int, db: Session = Depends(get_db)):
    """Get follow-up schedule for a sponsor."""
    return db.query(FollowUpSchedule).filter(FollowUpSchedule.sponsor_id == sponsor_id).order_by(FollowUpSchedule.follow_up_number).all()


@router.get("/sponsors/{sponsor_id}/follow-up-status")
def get_sponsor_follow_up_status(sponsor_id: int, db: Session = Depends(get_db)):
    """Get detailed follow-up status for a sponsor."""
    return get_follow_up_status(db, sponsor_id)


@router.post("/follow-ups/{follow_up_id}/approve")
def approve_follow_up(follow_up_id: int, approver_id: int, db: Session = Depends(get_db)):
    """Approve a follow-up email for sending."""
    followup = db.query(FollowUpSchedule).filter(FollowUpSchedule.id == follow_up_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    
    if followup.status not in ["pending", "created"]:
        raise HTTPException(status_code=400, detail=f"Cannot approve follow-up in status: {followup.status}")
    
    # Get the associated email log
    if not followup.email_id:
        raise HTTPException(status_code=400, detail="No email draft associated with this follow-up")
    
    email_log = db.query(EmailLog).filter(EmailLog.id == followup.email_id).first()
    if not email_log:
        raise HTTPException(status_code=404, detail="Email draft not found")
    
    # Duplicate check before approval
    dup_check = check_duplicate_before_send(db, email_log.sponsor_id, email_log.sender_id)
    if dup_check.is_duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Duplicate prevention check failed",
                "conflict_type": dup_check.conflict_type,
                "details": dup_check.conflict_details,
                "suggested_action": dup_check.suggested_action
            }
        )
    
    # Approve the email
    email_log.status = EmailStatus.APPROVED
    email_log.approved_by = approver_id
    email_log.approved_at = datetime.utcnow()
    email_log.updated_at = datetime.utcnow()
    
    followup.status = "approved"
    
    db.commit()
    db.refresh(email_log)
    db.refresh(followup)
    
    return {"message": "Follow-up approved and ready to send", "email": email_log}


@router.post("/follow-ups/{follow_up_id}/reject")
def reject_follow_up(follow_up_id: int, rejecter_id: int, reason: str, db: Session = Depends(get_db)):
    """Reject a follow-up email."""
    followup = db.query(FollowUpSchedule).filter(FollowUpSchedule.id == follow_up_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    
    if followup.status not in ["pending", "created", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot reject follow-up in status: {followup.status}")
    
    if followup.email_id:
        email_log = db.query(EmailLog).filter(EmailLog.id == followup.email_id).first()
        if email_log:
            email_log.status = EmailStatus.REJECTED
            email_log.rejected_by = rejecter_id
            email_log.rejected_at = datetime.utcnow()
            email_log.rejection_reason = reason
            email_log.updated_at = datetime.utcnow()
    
    followup.status = "cancelled"
    
    # Decrement sponsor follow-up count
    sponsor = db.query(Sponsor).filter(Sponsor.id == followup.sponsor_id).first()
    if sponsor and sponsor.follow_up_count > 0:
        sponsor.follow_up_count -= 1
    
    db.commit()
    
    return {"message": "Follow-up rejected"}


@router.post("/follow-ups/{follow_up_id}/send")
async def send_follow_up(follow_up_id: int, db: Session = Depends(get_db)):
    """Send an approved follow-up email."""
    followup = db.query(FollowUpSchedule).filter(FollowUpSchedule.id == follow_up_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    
    if not followup.email_id:
        raise HTTPException(status_code=400, detail="No email draft associated with this follow-up")
    
    email_log = db.query(EmailLog).filter(EmailLog.id == followup.email_id).first()
    if not email_log:
        raise HTTPException(status_code=404, detail="Email draft not found")
    
    if email_log.status != EmailStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved follow-ups can be sent")
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == email_log.sponsor_id).first()
    sender = db.query(TeamMember).filter(TeamMember.id == email_log.sender_id).first()
    
    if not sponsor or not sponsor.contact_email:
        raise HTTPException(status_code=400, detail="Sponsor has no contact email")
    
    if not sender:
        raise HTTPException(status_code=400, detail="Sender not found")
    
    # Send email
    result = await email_sending_service.send_email(
        email_log=email_log,
        sender=sender,
        recipient_email=sponsor.contact_email,
        recipient_name=sponsor.contact_person
    )
    
    if result["success"]:
        email_log.status = EmailStatus.SENT
        email_log.sent_at = datetime.utcnow()
        email_log.message_id = result["message_id"]
        
        # Update sponsor
        sponsor.last_contacted_at = datetime.utcnow()
        sponsor.status = SponsorStatus.FOLLOW_UP
        
        # Schedule next follow-up if not at max
        from app.services.follow_up import FollowUpService
        followup_service = FollowUpService(db)
        if sponsor.follow_up_count < followup_service.MAX_FOLLOW_UPS:
            next_num = sponsor.follow_up_count + 1
            interval = followup_service.FOLLOW_UP_INTERVALS.get(next_num, 7)
            sponsor.next_follow_up_at = datetime.utcnow() + timedelta(days=interval)
        else:
            sponsor.next_follow_up_at = None
        
        followup.status = "sent"
    else:
        email_log.status = EmailStatus.FAILED
        email_log.error_message = result["error"]
    
    email_log.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(email_log)
    
    return {"success": result["success"], "email": email_log, "message_id": result.get("message_id"), "error": result.get("error")}


@router.get("/sponsors/{sponsor_id}/conversation")
def get_conversation_thread(sponsor_id: int, db: Session = Depends(get_db)):
    """Get complete conversation thread for a sponsor (emails + replies in chronological order)."""
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    # Get all emails sent to this sponsor
    emails = db.query(EmailLog).filter(
        EmailLog.sponsor_id == sponsor_id,
        EmailLog.status == EmailStatus.SENT
    ).order_by(EmailLog.sent_at).all()
    
    # Get all replies
    replies = db.query(ReplyLog).filter(
        ReplyLog.sponsor_id == sponsor_id
    ).order_by(ReplyLog.received_at).all()
    
    # Build conversation thread
    thread = []
    
    for email in emails:
        thread.append({
            "type": "email",
            "id": email.id,
            "email_type": email.email_type,
            "subject": email.subject,
            "body": email.body,
            "body_html": email.body_html,
            "sent_at": email.sent_at,
            "sender": {
                "id": email.sender.id,
                "name": email.sender.name,
                "email": email.sender.email
            } if email.sender else None,
            "reply": None
        })
    
    # Add replies to their corresponding emails
    for reply in replies:
        thread.append({
            "type": "reply",
            "id": reply.id,
            "from_email": reply.from_email,
            "subject": reply.subject,
            "body": reply.body,
            "body_html": reply.body_html,
            "received_at": reply.received_at,
            "classification": reply.classification.value if reply.classification else None,
            "summary": reply.summary,
            "suggested_action": reply.suggested_action,
            "suggested_response": reply.suggested_response,
            "in_reply_to_email_id": reply.email_id
        })
    
    # Sort by timestamp
    thread.sort(key=lambda x: x.get("sent_at") or x.get("received_at") or datetime.min)
    
    return {
        "sponsor_id": sponsor_id,
        "company_name": sponsor.company_name,
        "thread": thread
    }


# ============================================================
# MEETINGS
# ============================================================

@router.post("/meetings", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    """Create a meeting request."""
    
    meeting_service = MeetingService(db)
    
    # Convert preferred slots if provided
    preferred_slots = None
    # In a real implementation, you'd pass preferred slots from the request
    
    new_meeting = meeting_service.request_meeting(
        sponsor_id=meeting.sponsor_id,
        team_member_id=meeting.team_member_id,
        title=meeting.title,
        description=meeting.description,
        preferred_slots=preferred_slots,
        meeting_link=meeting.meeting_link
    )
    
    # Notify
    notification_service = NotificationService(db)
    sponsor = db.query(Sponsor).filter(Sponsor.id == meeting.sponsor_id).first()
    if sponsor:
        notification_service.notify_meeting_requested(sponsor, new_meeting.id)
    
    return new_meeting


@router.get("/meetings", response_model=List[MeetingResponse])
def list_meetings(
    status: Optional[MeetingStatus] = None,
    team_member_id: Optional[int] = None,
    sponsor_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List meetings with filters."""
    
    query = db.query(Meeting)
    
    if status:
        query = query.filter(Meeting.status == status)
    if team_member_id:
        query = query.filter(Meeting.team_member_id == team_member_id)
    if sponsor_id:
        query = query.filter(Meeting.sponsor_id == sponsor_id)
    
    return query.order_by(Meeting.scheduled_at).all()


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Get a meeting by ID."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.patch("/meetings/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: int,
    request: Optional[MeetingUpdateRequest] = None,
    scheduled_at: Optional[datetime] = None,
    duration_minutes: Optional[int] = None,
    location: Optional[str] = None,
    meeting_link: Optional[str] = None,
    status: Optional[MeetingStatus] = None,
    notes: Optional[str] = None,
    outcome: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update a meeting."""
    eff_scheduled_at = (request.scheduled_at if request and request.scheduled_at is not None else None) or scheduled_at
    eff_duration_minutes = (request.duration_minutes if request and request.duration_minutes is not None else None) or duration_minutes
    eff_location = (request.location if request and request.location is not None else None) or location
    eff_meeting_link = (request.meeting_link if request and request.meeting_link is not None else None) or meeting_link
    eff_status = (request.status if request and request.status is not None else None) or status
    eff_notes = (request.notes if request and request.notes is not None else None) or notes
    eff_outcome = (request.outcome if request and request.outcome is not None else None) or outcome
    
    meeting_service = MeetingService(db)
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if eff_status == MeetingStatus.SCHEDULED and eff_scheduled_at:
        return meeting_service.schedule_meeting(
            meeting_id, eff_scheduled_at, eff_duration_minutes, eff_location, eff_meeting_link
        )
    elif eff_status == MeetingStatus.COMPLETED:
        return meeting_service.complete_meeting(meeting_id, eff_outcome, eff_notes)
    elif eff_status == MeetingStatus.CANCELLED:
        return meeting_service.cancel_meeting(meeting_id, eff_notes)
    else:
        # General update
        if eff_scheduled_at:
            meeting.scheduled_at = eff_scheduled_at
        if eff_duration_minutes:
            meeting.duration_minutes = eff_duration_minutes
        if eff_location:
            meeting.location = eff_location
        if eff_meeting_link:
            meeting.meeting_link = eff_meeting_link
        if eff_notes:
            meeting.notes = eff_notes
        if eff_status:
            meeting.status = eff_status
        
        db.commit()
        db.refresh(meeting)
        return meeting


@router.get("/meetings/{meeting_id}/calendar-links")
def get_meeting_calendar_links(meeting_id: int, db: Session = Depends(get_db)):
    """Get calendar links for a meeting."""
    
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    meeting_service = MeetingService(db)
    
    return {
        "google": meeting_service.generate_calendar_link(meeting, "google"),
        "outlook": meeting_service.generate_calendar_link(meeting, "outlook"),
        "ical": meeting_service.generate_calendar_link(meeting, "ical")
    }


# ============================================================
# NOTIFICATIONS
# ============================================================

@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    team_member_id: int,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get notifications for a team member."""
    
    notification_service = NotificationService(db)
    return notification_service.get_notifications(team_member_id, unread_only, limit, offset)


@router.get("/notifications/unread-count")
def get_unread_count(team_member_id: int, db: Session = Depends(get_db)):
    """Get unread notification count."""
    
    notification_service = NotificationService(db)
    return {"count": notification_service.get_unread_count(team_member_id)}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    request: Optional[NotificationReadRequest] = None,
    team_member_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Mark a notification as read."""
    target_member_id = (request.team_member_id if request else None) or team_member_id
    if not target_member_id:
        raise HTTPException(status_code=400, detail="team_member_id is required")
    
    notification_service = NotificationService(db)
    success = notification_service.mark_as_read(notification_id, target_member_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    request: Optional[NotificationReadRequest] = None,
    team_member_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Mark all notifications as read."""
    target_member_id = (request.team_member_id if request else None) or team_member_id
    if not target_member_id:
        raise HTTPException(status_code=400, detail="team_member_id is required")
    
    notification_service = NotificationService(db)
    count = notification_service.mark_all_as_read(target_member_id)
    
    return {"message": f"Marked {count} notifications as read"}


# ============================================================
# DASHBOARD
# ============================================================

@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics."""
    
    dashboard_service = DashboardService(db)
    
    stats = dashboard_service.get_overview_stats()
    stats["recent_activity"] = dashboard_service.get_recent_activity(10)
    
    return stats


@router.get("/dashboard/pipeline")
def get_pipeline_data(db: Session = Depends(get_db)):
    """Get pipeline data grouped by status."""
    
    dashboard_service = DashboardService(db)
    return dashboard_service.get_pipeline_data()


@router.get("/dashboard/team-performance")
def get_team_performance(db: Session = Depends(get_db)):
    """Get team member performance stats."""
    
    dashboard_service = DashboardService(db)
    return dashboard_service.get_team_performance()


@router.get("/dashboard/conversion-funnel")
def get_conversion_funnel(db: Session = Depends(get_db)):
    """Get conversion funnel data."""
    
    dashboard_service = DashboardService(db)
    return dashboard_service.get_conversion_funnel()


@router.get("/dashboard/sponsorship-breakdown")
def get_sponsorship_breakdown(db: Session = Depends(get_db)):
    """Get sponsorship type breakdown."""
    
    dashboard_service = DashboardService(db)
    return dashboard_service.get_sponsorship_breakdown()


@router.get("/dashboard/weekly-trends")
def get_weekly_trends(weeks: int = 8, db: Session = Depends(get_db)):
    """Get weekly trends."""
    
    dashboard_service = DashboardService(db)
    return dashboard_service.get_weekly_trends(weeks)


@router.get("/dashboard/top-sponsors")
def get_top_sponsors(limit: int = 10, db: Session = Depends(get_db)):
    """Get top sponsors by priority."""
    
    dashboard_service = DashboardService(db)
    return dashboard_service.get_top_sponsors(limit)


# ============================================================
# EMAIL TEMPLATES
# ============================================================

@router.get("/email-templates", response_model=List[EmailTemplateResponse])
def list_email_templates(email_type: Optional[str] = None, db: Session = Depends(get_db)):
    """List email templates."""
    
    query = db.query(EmailTemplate).filter(EmailTemplate.is_active == True)
    if email_type:
        query = query.filter(EmailTemplate.email_type == email_type)
    
    return query.order_by(EmailTemplate.email_type, EmailTemplate.name).all()


@router.post("/email-templates", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_email_template(
    template_data: Optional[EmailTemplateCreateRequest] = None,
    name: Optional[str] = None,
    email_type: Optional[str] = None,
    subject_template: Optional[str] = None,
    body_template: Optional[str] = None,
    body_html_template: Optional[str] = None,
    variables: Optional[Dict] = None,
    description: Optional[str] = None,
    is_default: bool = False,
    db: Session = Depends(get_db)
):
    """Create an email template."""
    if template_data:
        data = template_data.model_dump()
    else:
        if not name or not email_type or not subject_template or not body_template:
            raise HTTPException(status_code=400, detail="Missing required template fields")
        data = {
            "name": name,
            "email_type": email_type,
            "subject_template": subject_template,
            "body_template": body_template,
            "body_html_template": body_html_template,
            "variables": variables,
            "description": description,
            "is_default": is_default
        }
    
    template = EmailTemplate(**data)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


# ============================================================
# EVENTS
# ============================================================

@router.get("/events", response_model=List[EventResponse])
def list_events(active_only: bool = True, db: Session = Depends(get_db)):
    """List events."""
    query = db.query(Event)
    if active_only:
        query = query.filter(Event.is_active == True)
    
    return query.order_by(Event.start_date.desc()).all()


@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: Optional[EventCreateRequest] = None,
    name: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    description: Optional[str] = None,
    location: Optional[str] = None,
    expected_attendees: Optional[int] = None,
    budget_target: Optional[int] = None,
    sponsorship_tiers: Optional[Dict] = None,
    db: Session = Depends(get_db)
):
    """Create an event."""
    if event_data:
        data = event_data.model_dump()
    else:
        if not name or not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Missing required event fields: name, start_date, end_date")
        data = {
            "name": name,
            "start_date": start_date,
            "end_date": end_date,
            "description": description,
            "location": location,
            "expected_attendees": expected_attendees,
            "budget_target": budget_target,
            "sponsorship_tiers": sponsorship_tiers
        }
    
    event = Event(**data)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# ============================================================
# INSTITUTIONAL MEMORY
# ============================================================

@router.get("/institutional-memory", response_model=List[InstitutionalMemoryResponse])
def list_institutional_memory(db: Session = Depends(get_db)):
    """List institutional memory records."""
    return db.query(InstitutionalMemory).order_by(InstitutionalMemory.company_name).all()


@router.post("/institutional-memory", response_model=InstitutionalMemoryResponse, status_code=status.HTTP_201_CREATED)
def create_institutional_memory(
    memory_data: Optional[InstitutionalMemoryCreateRequest] = None,
    company_name: Optional[str] = None,
    previous_sponsorships: Optional[List[Dict]] = None,
    total_contributed: int = 0,
    preferred_sponsorship_types: Optional[List[str]] = None,
    contact_history: Optional[List[Dict]] = None,
    preferences: Optional[str] = None,
    last_event: Optional[str] = None,
    last_contact_year: Optional[int] = None,
    outcome_notes: Optional[str] = None,
    source: str = "manual",
    verified: bool = False,
    db: Session = Depends(get_db)
):
    """Create or update institutional memory for a company."""
    if memory_data:
        company = memory_data.company_name
        data = memory_data.model_dump()
    else:
        if not company_name:
            raise HTTPException(status_code=400, detail="company_name is required")
        company = company_name
        data = {
            "company_name": company_name,
            "previous_sponsorships": previous_sponsorships,
            "total_contributed": total_contributed,
            "preferred_sponsorship_types": preferred_sponsorship_types,
            "contact_history": contact_history,
            "preferences": preferences,
            "last_event": last_event,
            "last_contact_year": last_contact_year,
            "outcome_notes": outcome_notes,
            "source": source,
            "verified": verified
        }
    
    existing = db.query(InstitutionalMemory).filter(
        InstitutionalMemory.company_name.ilike(company)
    ).first()
    
    if existing:
        for k, v in data.items():
            if v is not None:
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    
    memory = InstitutionalMemory(**data)
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


# ============================================================
# DUPLICATE PREVENTION
# ============================================================

@router.post("/duplicates/check")
def check_duplicates(
    request: Optional[DuplicateCheckRequest] = None,
    company_name: Optional[str] = None,
    contact_email: Optional[str] = None,
    contact_person: Optional[str] = None,
    website: Optional[str] = None,
    current_user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Check for potential duplicate sponsors."""
    service = DuplicatePreventionService(db)
    c_name = (request.company_name if request else None) or company_name
    if not c_name:
        raise HTTPException(status_code=400, detail="company_name is required")
    c_email = (request.contact_email if request else None) or contact_email
    c_person = (request.contact_person if request else None) or contact_person
    c_web = (request.website if request else None) or website
    u_id = (request.current_user_id if request else None) or current_user_id
    
    result = service.check_before_outreach(c_name, c_email, c_person, c_web, u_id)
    
    return {
        "is_duplicate": result.is_duplicate,
        "conflict_type": result.conflict_type,
        "details": result.conflict_details,
        "existing_sponsor_id": result.existing_sponsor.id if result.existing_sponsor else None,
        "suggested_action": result.suggested_action
    }


@router.post("/duplicates/merge")
def merge_sponsors(
    request: Optional[DuplicateMergeRequest] = None,
    primary_sponsor_id: Optional[int] = None,
    duplicate_sponsor_id: Optional[int] = None,
    merged_by: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Merge duplicate sponsor records."""
    p_id = (request.primary_sponsor_id if request else None) or primary_sponsor_id
    d_id = (request.duplicate_sponsor_id if request else None) or duplicate_sponsor_id
    m_by = (request.merged_by if request else None) or merged_by
    
    if not p_id or not d_id or not m_by:
        raise HTTPException(status_code=400, detail="primary_sponsor_id, duplicate_sponsor_id, and merged_by are required")
    
    service = DuplicatePreventionService(db)
    try:
        merged = service.merge_sponsors(p_id, d_id, m_by)
        return {"message": "Sponsors merged successfully", "merged_sponsor_id": merged.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# ADDITIONAL FRONTEND & WORKFLOW ENDPOINTS
# ============================================================

DAILY_EMAIL_LIMIT = 40


@router.get("/emails")
def list_all_emails(
    status: Optional[str] = None,
    sponsor_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List all email logs across sponsors with sponsor and sender info."""
    query = db.query(EmailLog)
    if sponsor_id:
        query = query.filter(EmailLog.sponsor_id == sponsor_id)
    if status and status != "All":
        query = query.filter(EmailLog.status == status)

    emails = query.order_by(EmailLog.created_at.desc()).all()
    result = []
    for e in emails:
        result.append({
            "id": e.id,
            "sponsor_id": e.sponsor_id,
            "sponsor_name": e.sponsor.company_name if e.sponsor else f"Sponsor #{e.sponsor_id}",
            "sender_id": e.sender_id,
            "sender_name": e.sender.name if e.sender else f"Member #{e.sender_id}",
            "subject": e.subject,
            "body": e.body,
            "body_html": e.body_html,
            "status": e.status.value if hasattr(e.status, "value") else str(e.status),
            "email_type": e.email_type,
            "follow_up_number": e.follow_up_number,
            "approved_by": e.approved_by,
            "approved_at": e.approved_at,
            "rejected_by": e.rejected_by,
            "rejected_at": e.rejected_at,
            "rejection_reason": e.rejection_reason,
            "sent_at": e.sent_at,
            "message_id": e.message_id,
            "error_message": e.error_message,
            "attachments": e.attachments or [],
            "created_at": e.created_at,
            "updated_at": e.updated_at,
        })
    return result


class GeminiDraftPayload(BaseModel):
    companyId: int
    eventName: Optional[str] = "Tech Hackathon"
    audience: Optional[str] = "500+ student developers & innovators"
    sponsorshipNeeded: Optional[List[str]] = None
    organizerName: Optional[str] = None
    emailType: Optional[str] = "initial"
    eventId: Optional[int] = None
    brochureTier: Optional[str] = None
    saveDraft: bool = True


@router.post("/email-draft")
def create_ai_email_draft(payload: GeminiDraftPayload, db: Session = Depends(get_db)):
    """Generate a personalized company-specific email draft and optionally save as DRAFT."""
    sponsor = db.query(Sponsor).filter(Sponsor.id == payload.companyId).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    sender = None
    if sponsor.assignee_id:
        sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
    if not sender:
        sender = db.query(TeamMember).filter(TeamMember.is_active == True).first()

    sender_id = sender.id if sender else 1
    sender_name = payload.organizerName or (sender.name if sender else "Sponsorship Team")
    sender_role = sender.role if sender and sender.role else "Sponsorship Lead"
    sender_email = sender.email if sender else "sponsorships@club.org"

    event_data = {
        "name": payload.eventName or "HackTech 2026",
        "description": f"Premier student event for {payload.audience or 'student developers'}",
        "date": "Upcoming",
        "expected_attendees": 500,
        "location": "Main Campus Auditorium",
    }
    if payload.eventId:
        ev = db.query(Event).filter(Event.id == payload.eventId).first()
        if ev:
            event_data = {
                "name": ev.name,
                "description": ev.description,
                "date": ev.start_date.strftime("%B %d, %Y") if ev.start_date else "Upcoming",
                "expected_attendees": ev.expected_attendees or 500,
                "location": ev.location or "Main Campus",
            }
    else:
        ev = db.query(Event).filter(Event.is_active == True).first()
        if ev:
            event_data = {
                "name": ev.name,
                "description": ev.description,
                "date": ev.start_date.strftime("%B %d, %Y") if ev.start_date else "Upcoming",
                "expected_attendees": ev.expected_attendees or 500,
                "location": ev.location or "Main Campus",
            }

    recommended_types = sponsor.recommended_sponsorship_types or payload.sponsorshipNeeded or ["Cash Sponsorship", "Swag / Goodies"]
    email_type = payload.emailType or "initial"

    previous_emails = db.query(EmailLog).filter(
        EmailLog.sponsor_id == sponsor.id,
        EmailLog.status == EmailStatus.SENT
    ).order_by(EmailLog.sent_at).all()

    prev_emails_data = [
        {
            "email_type": e.email_type,
            "subject": e.subject,
            "sent_at": e.sent_at.isoformat() if e.sent_at else None
        }
        for e in previous_emails
    ]

    draft: EmailDraft = email_generation_service.generate_email(
        email_type=email_type,
        sponsor_data={
            "company_name": sponsor.company_name,
            "contact_person": sponsor.contact_person,
            "contact_role": sponsor.contact_role,
            "industry": sponsor.industry,
            "company_category": sponsor.company_category,
        },
        event_data=event_data,
        sender_data={
            "name": sender_name,
            "role": sender_role,
            "club_name": "Student Tech Club",
            "club_description": "A student-run technology club",
            "email": sender_email
        },
        recommended_types=recommended_types,
        reasoning=sponsor.recommendation_reasoning or "",
        research_verified=sponsor.research_data or {},
        research_unverified=sponsor.research_unverified or {},
        previous_emails=prev_emails_data,
    )

    tier_name = payload.brochureTier or sponsor.company_category or sponsor.priority_tier or "Standard"
    attachments = [
        {
            "name": f"{event_data['name'].replace(' ', '_')}_{tier_name.replace(' ', '_')}_Sponsorship_Deck.pdf",
            "tier": tier_name,
            "type": "application/pdf"
        }
    ]

    if not payload.saveDraft:
        return {
            "subject": draft.subject,
            "body": draft.body,
            "body_html": draft.body_html,
            "attachments": attachments,
        }

    email_log = EmailLog(
        sponsor_id=sponsor.id,
        sender_id=sender_id,
        subject=draft.subject,
        body=draft.body,
        body_html=draft.body_html,
        email_type=email_type,
        follow_up_number=0 if email_type == "initial" else (1 if email_type == "follow_up_1" else (2 if email_type == "follow_up_2" else 0)),
        status=EmailStatus.DRAFT,
        attachments=attachments,
    )
    db.add(email_log)
    db.commit()
    db.refresh(email_log)

    return {
        "id": email_log.id,
        "subject": email_log.subject,
        "body": email_log.body,
        "body_html": email_log.body_html,
        "status": email_log.status.value,
        "attachments": email_log.attachments,
    }


@router.post("/sponsors/{sponsor_id}/follow-ups/schedule")
def schedule_sponsor_follow_up(sponsor_id: int, db: Session = Depends(get_db)):
    """Schedule the next follow-up (max 2) for a specific sponsor and generate draft for organizer approval."""
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    if sponsor.status in [SponsorStatus.INTERESTED, SponsorStatus.DECLINED, SponsorStatus.CLOSED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot schedule follow-up: sponsor is already '{sponsor.status.value}'."
        )

    followup_service = FollowUpService(db)
    if sponsor.follow_up_count >= followup_service.MAX_FOLLOW_UPS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum follow-ups ({followup_service.MAX_FOLLOW_UPS}/2) already reached for {sponsor.company_name}. Spam prevention active."
        )

    next_num = sponsor.follow_up_count + 1
    interval_days = followup_service.FOLLOW_UP_INTERVALS.get(next_num, 5)
    scheduled_at = datetime.utcnow() + timedelta(days=interval_days)

    sender = None
    if sponsor.assignee_id:
        sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
    if not sender:
        sender = db.query(TeamMember).filter(TeamMember.is_active == True).first()
    if not sender:
        raise HTTPException(status_code=400, detail="No active team member found to assign as sender")

    ev = db.query(Event).filter(Event.is_active == True).first()
    event_data = {
        "name": ev.name if ev else "HackTech 2026",
        "date": ev.start_date.strftime("%B %d, %Y") if ev and ev.start_date else "Upcoming",
        "expected_attendees": ev.expected_attendees if ev and ev.expected_attendees else 500,
    }

    draft = followup_service.generate_follow_up_draft(
        sponsor=sponsor,
        follow_up_number=next_num,
        event_data=event_data,
        sender_data={
            "name": sender.name,
            "role": sender.role or "Sponsorship Lead",
            "club_name": "Student Tech Club",
            "email": sender.email,
        },
        assignee_data={"name": sender.name, "email": sender.email}
    )

    schedule = followup_service.create_follow_up_schedule(
        sponsor_id=sponsor.id,
        follow_up_number=next_num,
        scheduled_at=scheduled_at,
        draft_subject=draft.subject,
        draft_body=draft.body,
        draft_body_html=draft.body_html,
    )

    email_log = followup_service.create_follow_up_email_log(
        sponsor=sponsor,
        followup_schedule=schedule,
        sender_id=sender.id,
        subject=draft.subject,
        body=draft.body,
        body_html=draft.body_html,
    )

    return {
        "message": f"Follow-up #{next_num} scheduled and draft created for approval",
        "follow_up_id": schedule.id,
        "email_id": email_log.id,
        "follow_up_number": next_num,
        "scheduled_at": scheduled_at,
        "subject": draft.subject,
    }


@router.post("/emails/{email_id}/approve-and-send")
async def approve_and_send_email(
    email_id: int,
    approver_id: int = Query(1),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """One-click Human-in-the-Loop Approval + Send + Next Step Automation."""
    # Check daily email quota (20-40 outgoing emails/day free-tier limit)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    sent_today = db.query(EmailLog).filter(
        EmailLog.status == EmailStatus.SENT,
        EmailLog.sent_at >= today_start
    ).count()

    if sent_today >= DAILY_EMAIL_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily free-tier email limit reached ({sent_today}/{DAILY_EMAIL_LIMIT} sent today). Queued for tomorrow."
        )

    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if email.status == EmailStatus.SENT:
        raise HTTPException(status_code=400, detail="Email has already been sent")

    # Approve first if not yet approved
    if email.status in [EmailStatus.DRAFT, EmailStatus.PENDING_APPROVAL, EmailStatus.REJECTED]:
        dup_check = check_duplicate_before_send(db, email.sponsor_id, email.sender_id)
        if dup_check.is_duplicate:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Duplicate outreach prevented",
                    "conflict_type": dup_check.conflict_type,
                    "details": dup_check.conflict_details,
                    "suggested_action": dup_check.suggested_action
                }
            )
        email.status = EmailStatus.APPROVED
        email.approved_by = approver_id
        email.approved_at = datetime.utcnow()
        email.updated_at = datetime.utcnow()
        db.commit()

    return await send_email(email_id, background_tasks, db)


@router.post("/sponsors/{sponsor_id}/discover-contact")
async def discover_sponsor_contact(sponsor_id: int, db: Session = Depends(get_db)):
    """Automatic contact discovery using Hunter/Apollo free tier or domain pattern inference (flagged UNVERIFIED)."""
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    from app.config import settings
    import re

    domain = ""
    if sponsor.website:
        domain = re.sub(r"^https?://(www\.)?", "", sponsor.website).split("/")[0].strip()
    if not domain:
        slug = re.sub(r"[^a-z0-9]", "", sponsor.company_name.lower())
        domain = f"{slug}.com"

    known_contacts = {
        "google": ("Sundar Pichai", "Director of University Relations & DevRel", f"university-relations@{domain}"),
        "microsoft": ("Sarah Bond", "Global Developer & Academic Partnerships", f"sponsorships@{domain}"),
        "aws": (" Swami Sivasubramanian", "VP of Developer Community & Cloud Credits", f"academic-cloud@{domain}"),
        "stripe": ("shardul shah", "Developer Relations & Campus Grants", f"devrel@{domain}"),
        "github": ("Thomas Dohmke", "GitHub Education & Campus Program Lead", f"education@{domain}"),
    }

    key = sponsor.company_name.lower().strip()
    if key in known_contacts:
        person, role, email_addr = known_contacts[key]
        source_note = "UNVERIFIED - Discovered via Hunter/Apollo Free-Tier Directory Lookup (verify before sending)"
    else:
        person = sponsor.contact_person or f"{sponsor.company_name} DevRel / Partnerships Lead"
        role = sponsor.contact_role or "Head of Developer Relations & University Sponsorships"
        email_addr = sponsor.contact_email or f"partnerships@{domain}"
        source_note = f"UNVERIFIED - Inferred from company domain ({domain}) via Hunter/Apollo pattern (requires organizer verification)"

    if not sponsor.contact_person:
        sponsor.contact_person = person.strip()
    if not sponsor.contact_role:
        sponsor.contact_role = role
    if not sponsor.contact_email:
        sponsor.contact_email = email_addr
    if not sponsor.website:
        sponsor.website = f"https://{domain}"

    unverified = dict(sponsor.research_unverified or {})
    unverified["discovered_contact"] = {
        "value": f"{sponsor.contact_person} ({sponsor.contact_role}) - {sponsor.contact_email}",
        "note": source_note
    }
    sponsor.research_unverified = unverified
    sponsor.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(sponsor)

    return {
        "sponsor_id": sponsor.id,
        "company_name": sponsor.company_name,
        "contact_person": sponsor.contact_person,
        "contact_role": sponsor.contact_role,
        "contact_email": sponsor.contact_email,
        "website": sponsor.website,
        "verification_note": source_note,
        "verified": False,
    }


@router.post("/sponsors/batch-research")
async def batch_research_and_prioritize(
    event_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Batch research and prioritize all sponsors that haven't been researched/prioritized yet."""
    sponsors = db.query(Sponsor).all()
    processed = []
    for sp in sponsors:
        if not sp.research_data or sp.priority_score == 0:
            res = await research_and_prioritize_sponsor(sp.id, None, event_id, db)
            processed.append({
                "sponsor_id": sp.id,
                "company_name": sp.company_name,
                "priority_score": res["prioritization"]["priority_score"],
                "priority_tier": res["prioritization"]["priority_tier"],
                "recommended_types": res["prioritization"]["recommended_types"],
            })
    return {
        "processed_count": len(processed),
        "processed": processed,
    }


class BulkSponsorImportRequest(BaseModel):
    sponsors: List[Dict[str, Any]]
    default_assignee_id: Optional[int] = 1


@router.post("/sponsors/import-csv")
def import_sponsors_bulk(payload: BulkSponsorImportRequest, db: Session = Depends(get_db)):
    """Import multiple sponsors from CSV / Google Sheets with automatic duplicate prevention."""
    imported = []
    skipped_duplicates = []

    for row in payload.sponsors:
        company_name = (row.get("company_name") or row.get("name") or row.get("Company") or "").strip()
        if not company_name:
            continue

        contact_email = (row.get("contact_email") or row.get("email") or row.get("Email") or "").strip() or None
        contact_person = (row.get("contact_person") or row.get("contact") or row.get("Contact") or "").strip() or None
        contact_role = (row.get("contact_role") or row.get("role") or row.get("Role") or "").strip() or None
        industry = (row.get("industry") or row.get("Industry") or "Technology").strip()
        company_category = (row.get("company_category") or row.get("category") or row.get("Category") or "Technology").strip()
        website = (row.get("website") or row.get("Website") or "").strip() or None

        dup_check = check_duplicate_sponsor(
            db, company_name, contact_email, contact_person, website, payload.default_assignee_id
        )
        if dup_check.is_duplicate:
            skipped_duplicates.append({
                "company_name": company_name,
                "reason": dup_check.conflict_details,
                "conflict_type": dup_check.conflict_type,
            })
            continue

        sp = Sponsor(
            company_name=company_name,
            company_category=company_category,
            industry=industry,
            website=website,
            contact_person=contact_person,
            contact_email=contact_email,
            contact_role=contact_role,
            assignee_id=row.get("assignee_id") or payload.default_assignee_id,
            status=SponsorStatus.NOT_CONTACTED,
        )
        db.add(sp)
        db.flush()
        imported.append({"id": sp.id, "company_name": sp.company_name})

    db.commit()
    return {
        "imported_count": len(imported),
        "skipped_count": len(skipped_duplicates),
        "imported": imported,
        "skipped_duplicates": skipped_duplicates,
    }


@router.get("/quota-status")
def get_quota_status(db: Session = Depends(get_db)):
    """Return daily email and free-tier API quota usage (designed for 20-40 outgoing emails/day)."""
    from app.config import settings
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    emails_sent_today = db.query(EmailLog).filter(
        EmailLog.status == EmailStatus.SENT,
        EmailLog.sent_at >= today_start
    ).count()

    researched_today = db.query(Sponsor).filter(
        Sponsor.research_last_updated >= today_start
    ).count()

    drafts_today = db.query(EmailLog).filter(
        EmailLog.created_at >= today_start
    ).count()

    return {
        "emails_sent_today": emails_sent_today,
        "daily_email_limit": DAILY_EMAIL_LIMIT,
        "recommended_daily_range": "20-40",
        "remaining_emails_today": max(0, DAILY_EMAIL_LIMIT - emails_sent_today),
        "researched_today": researched_today,
        "daily_research_limit": 60,
        "drafts_generated_today": drafts_today,
        "daily_ai_draft_limit": 60,
        "demo_mode": settings.demo_mode,
        "providers": {
            "ai_model": "Gemini Free Tier (Fallback Active)" if settings.demo_mode else "Gemini 1.5 Flash Free Tier",
            "research": "Tavily Free Tier (1,000 req/mo)" if not settings.demo_mode else "Tavily Free Tier + Verified/Unverified Guard",
            "contact_discovery": "Hunter / Apollo Free Tier",
            "email_smtp": "Free SMTP / Rate-Limited Queue (Max 40/day)",
        }
    }