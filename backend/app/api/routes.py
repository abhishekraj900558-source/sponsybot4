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

router = APIRouter()


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
    event_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """AI-powered sponsor prioritization and recommendation."""
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    # Get event context if provided
    event_context = None
    if event_id:
        event = db.query(Event).filter(Event.id == event_id).first()
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
    event_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Research and prioritize a sponsor in one call."""
    
    # First research
    research_result = await research_sponsor(sponsor_id, db)
    
    # Then prioritize
    prioritize_result = prioritize_sponsor(sponsor_id, event_id, db)
    
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
    email_type: str = "initial",  # initial, follow_up_1, follow_up_2, meeting_request, thank_you, interested_response
    event_id: Optional[int] = None,
    sender_id: int = None,
    db: Session = Depends(get_db)
):
    """Generate a personalized email draft for a sponsor."""
    
    sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    if not sender_id:
        sender_id = sponsor.assignee_id
    
    sender = db.query(TeamMember).filter(TeamMember.id == sender_id).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")
    
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
    
    meeting_service = MeetingService(db)
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if status == MeetingStatus.SCHEDULED and scheduled_at:
        return meeting_service.schedule_meeting(
            meeting_id, scheduled_at, duration_minutes, location, meeting_link
        )
    elif status == MeetingStatus.COMPLETED:
        return meeting_service.complete_meeting(meeting_id, outcome, notes)
    elif status == MeetingStatus.CANCELLED:
        return meeting_service.cancel_meeting(meeting_id, notes)
    else:
        # General update
        if scheduled_at:
            meeting.scheduled_at = scheduled_at
        if duration_minutes:
            meeting.duration_minutes = duration_minutes
        if location:
            meeting.location = location
        if meeting_link:
            meeting.meeting_link = meeting_link
        if notes:
            meeting.notes = notes
        if status:
            meeting.status = status
        
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
def mark_notification_read(notification_id: int, team_member_id: int, db: Session = Depends(get_db)):
    """Mark a notification as read."""
    
    notification_service = NotificationService(db)
    success = notification_service.mark_as_read(notification_id, team_member_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
def mark_all_notifications_read(team_member_id: int, db: Session = Depends(get_db)):
    """Mark all notifications as read."""
    
    notification_service = NotificationService(db)
    count = notification_service.mark_all_as_read(team_member_id)
    
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
    name: str,
    email_type: str,
    subject_template: str,
    body_template: str,
    body_html_template: str = None,
    variables: Dict = None,
    description: str = None,
    is_default: bool = False,
    db: Session = Depends(get_db)
):
    """Create an email template."""
    
    template = EmailTemplate(
        name=name,
        email_type=email_type,
        subject_template=subject_template,
        body_template=body_template,
        body_html_template=body_html_template,
        variables=variables,
        description=description,
        is_default=is_default
    )
    
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
    name: str,
    start_date: datetime,
    end_date: datetime,
    description: str = None,
    location: str = None,
    expected_attendees: int = None,
    budget_target: int = None,
    sponsorship_tiers: Dict = None,
    db: Session = Depends(get_db)
):
    """Create an event."""
    
    event = Event(
        name=name,
        start_date=start_date,
        end_date=end_date,
        description=description,
        location=location,
        expected_attendees=expected_attendees,
        budget_target=budget_target,
        sponsorship_tiers=sponsorship_tiers
    )
    
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
    company_name: str,
    previous_sponsorships: List[Dict] = None,
    total_contributed: int = 0,
    preferred_sponsorship_types: List[str] = None,
    contact_history: List[Dict] = None,
    preferences: str = None,
    last_event: str = None,
    last_contact_year: int = None,
    outcome_notes: str = None,
    source: str = "manual",
    verified: bool = False,
    db: Session = Depends(get_db)
):
    """Create or update institutional memory for a company."""
    
    existing = db.query(InstitutionalMemory).filter(
        InstitutionalMemory.company_name.ilike(company_name)
    ).first()
    
    if existing:
        # Update
        if previous_sponsorships:
            existing.previous_sponsorships = previous_sponsorships
        if total_contributed:
            existing.total_contributed = total_contributed
        if preferred_sponsorship_types:
            existing.preferred_sponsorship_types = preferred_sponsorship_types
        if contact_history:
            existing.contact_history = contact_history
        if preferences:
            existing.preferences = preferences
        if last_event:
            existing.last_event = last_event
        if last_contact_year:
            existing.last_contact_year = last_contact_year
        if outcome_notes:
            existing.outcome_notes = outcome_notes
        if source:
            existing.source = source
        if verified:
            existing.verified = verified
        
        db.commit()
        db.refresh(existing)
        return existing
    
    memory = InstitutionalMemory(
        company_name=company_name,
        previous_sponsorships=previous_sponsorships,
        total_contributed=total_contributed,
        preferred_sponsorship_types=preferred_sponsorship_types,
        contact_history=contact_history,
        preferences=preferences,
        last_event=last_event,
        last_contact_year=last_contact_year,
        outcome_notes=outcome_notes,
        source=source,
        verified=verified
    )
    
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


# ============================================================
# DUPLICATE PREVENTION
# ============================================================

@router.post("/duplicates/check")
def check_duplicates(
    company_name: str,
    contact_email: str = None,
    contact_person: str = None,
    website: str = None,
    current_user_id: int = None,
    db: Session = Depends(get_db)
):
    """Check for potential duplicate sponsors."""
    
    service = DuplicatePreventionService(db)
    result = service.check_before_outreach(company_name, contact_email, contact_person, website, current_user_id)
    
    return {
        "is_duplicate": result.is_duplicate,
        "conflict_type": result.conflict_type,
        "details": result.conflict_details,
        "existing_sponsor_id": result.existing_sponsor.id if result.existing_sponsor else None,
        "suggested_action": result.suggested_action
    }


@router.post("/duplicates/merge")
def merge_sponsors(
    primary_sponsor_id: int,
    duplicate_sponsor_id: int,
    merged_by: int,
    db: Session = Depends(get_db)
):
    """Merge duplicate sponsor records."""
    
    service = DuplicatePreventionService(db)
    try:
        merged = service.merge_sponsors(primary_sponsor_id, duplicate_sponsor_id, merged_by)
        return {"message": "Sponsors merged successfully", "merged_sponsor_id": merged.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))