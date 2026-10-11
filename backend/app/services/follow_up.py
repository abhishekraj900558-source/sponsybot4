# SPONSY BOT Follow-up Automation Service
"""
Automated follow-up scheduling with max 2 follow-ups per sponsor.
Respects human approval workflow and stops on reply/interest/decline.
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.config import settings
from app.models import (
    Sponsor, EmailLog, FollowUpSchedule, EmailStatus, SponsorStatus,
    ReplyClassification, ReplyLog
)
from app.services.email_generation import email_generation_service, EmailDraft

logger = logging.getLogger(__name__)


@dataclass
class FollowUpAction:
    """Represents a follow-up action to take."""
    sponsor_id: int
    follow_up_number: int  # 1 or 2
    scheduled_at: datetime
    draft_subject: str
    draft_body: str
    draft_body_html: Optional[str]
    reason: str


class FollowUpService:
    """Service for managing follow-up automation."""
    
    # Follow-up schedule: days after previous email
    FOLLOW_UP_INTERVALS = {
        1: 5,   # First follow-up: 5 days after initial
        2: 7,   # Second follow-up: 7 days after first follow-up
    }
    
    MAX_FOLLOW_UPS = 2
    
    def __init__(self, db_session):
        self.db = db_session
    
    def check_and_schedule_follow_ups(self) -> List[FollowUpAction]:
        """
        Check all sponsors and schedule follow-ups where appropriate.
        Called periodically (e.g., daily via scheduler).
        
        Returns list of FollowUpAction items that need draft generation.
        """
        actions = []
        
        # Get sponsors who need follow-ups
        sponsors = self.db.query(Sponsor).filter(
            Sponsor.status.in_([
                SponsorStatus.CONTACTED,
                SponsorStatus.FOLLOW_UP
            ]),
            Sponsor.follow_up_count < self.MAX_FOLLOW_UPS
        ).all()
        
        for sponsor in sponsors:
            action = self._check_sponsor_follow_up(sponsor)
            if action:
                actions.append(action)
        
        return actions
    
    def _check_sponsor_follow_up(self, sponsor: Sponsor) -> Optional[FollowUpAction]:
        """Check if a specific sponsor needs a follow-up."""
        
        # Check if sponsor has replied (interested or declined)
        latest_reply_log = self.db.query(ReplyLog).filter(
            ReplyLog.sponsor_id == sponsor.id
        ).order_by(ReplyLog.received_at.desc()).first()
        
        if latest_reply_log and latest_reply_log.classification:
            if latest_reply_log.classification == ReplyClassification.INTERESTED:
                logger.info(f"Sponsor {sponsor.company_name} is interested - stopping follow-ups")
                return None
            elif latest_reply_log.classification == ReplyClassification.DECLINED:
                logger.info(f"Sponsor {sponsor.company_name} declined - stopping follow-ups")
                return None
            # If NO_REPLY, continue with follow-ups
        
        # Check if there's already a pending follow-up scheduled
        pending_followup = self.db.query(FollowUpSchedule).filter(
            FollowUpSchedule.sponsor_id == sponsor.id,
            FollowUpSchedule.status.in_(["pending", "created"])
        ).first()
        
        if pending_followup:
            logger.debug(f"Sponsor {sponsor.company_name} already has pending follow-up")
            return None
        
        # Get the last sent email
        last_email = self.db.query(EmailLog).filter(
            EmailLog.sponsor_id == sponsor.id,
            EmailLog.status == EmailStatus.SENT
        ).order_by(EmailLog.sent_at.desc()).first()
        
        if not last_email:
            logger.warning(f"Sponsor {sponsor.company_name} has no sent emails")
            return None
        
        # Determine next follow-up number
        next_follow_up_num = sponsor.follow_up_count + 1
        
        if next_follow_up_num > self.MAX_FOLLOW_UPS:
            logger.info(f"Sponsor {sponsor.company_name} reached max follow-ups")
            return None
        
        # Calculate scheduled time
        base_time = last_email.sent_at or last_email.created_at
        interval_days = self.FOLLOW_UP_INTERVALS.get(next_follow_up_num, 7)
        scheduled_at = base_time + timedelta(days=interval_days)
        
        # Check if it's time to create the draft (create draft 1 day before sending)
        create_draft_at = scheduled_at - timedelta(days=1)
        now = datetime.utcnow()
        
        if now < create_draft_at:
            logger.debug(f"Too early for follow-up {next_follow_up_num} for {sponsor.company_name}")
            return None
        
        # Check if we already sent this follow-up number
        existing_followup_email = self.db.query(EmailLog).filter(
            EmailLog.sponsor_id == sponsor.id,
            EmailLog.follow_up_number == next_follow_up_num,
            EmailLog.status.in_([EmailStatus.SENT, EmailStatus.APPROVED, EmailStatus.PENDING_APPROVAL])
        ).first()
        
        if existing_followup_email:
            logger.debug(f"Follow-up {next_follow_up_num} already exists for {sponsor.company_name}")
            return None
        
        logger.info(f"Scheduling follow-up {next_follow_up_num} for {sponsor.company_name}")
        
        return FollowUpAction(
            sponsor_id=sponsor.id,
            follow_up_number=next_follow_up_num,
            scheduled_at=scheduled_at,
            draft_subject="",  # Will be generated
            draft_body="",
            draft_body_html=None,
            reason=f"Auto-scheduled follow-up #{next_follow_up_num}"
        )
    
    def generate_follow_up_draft(
        self,
        sponsor: Sponsor,
        follow_up_number: int,
        event_data: Dict,
        sender_data: Dict,
        assignee_data: Dict
    ) -> EmailDraft:
        """Generate a follow-up email draft."""
        
        # Get previous emails for context
        previous_emails = self.db.query(EmailLog).filter(
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
        
        # Determine email type
        email_type = f"follow_up_{follow_up_number}"
        
        # Generate draft
        draft = email_generation_service.generate_email(
            email_type=email_type,
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
        
        return draft
    
    def create_follow_up_schedule(
        self,
        sponsor_id: int,
        follow_up_number: int,
        scheduled_at: datetime,
        draft_subject: str,
        draft_body: str,
        draft_body_html: str = None
    ) -> FollowUpSchedule:
        """Create a follow-up schedule record with draft."""
        
        followup = FollowUpSchedule(
            sponsor_id=sponsor_id,
            follow_up_number=follow_up_number,
            scheduled_at=scheduled_at,
            status="created",
            draft_subject=draft_subject,
            draft_body=draft_body
        )
        
        self.db.add(followup)
        self.db.commit()
        self.db.refresh(followup)
        
        return followup
    
    def create_follow_up_email_log(
        self,
        sponsor: Sponsor,
        followup_schedule: FollowUpSchedule,
        sender_id: int,
        subject: str,
        body: str,
        body_html: str = None
    ) -> EmailLog:
        """Create an EmailLog for the follow-up (pending approval)."""
        
        email_log = EmailLog(
            sponsor_id=sponsor.id,
            sender_id=sender_id,
            subject=subject,
            body=body,
            body_html=body_html,
            email_type=f"follow_up_{followup_schedule.follow_up_number}",
            follow_up_number=followup_schedule.follow_up_number,
            status=EmailStatus.DRAFT
        )
        
        self.db.add(email_log)
        
        # Update follow-up schedule with email reference
        followup_schedule.email_id = email_log.id
        followup_schedule.status = "created"
        
        # Update sponsor
        sponsor.follow_up_count = followup_schedule.follow_up_number
        sponsor.status = SponsorStatus.FOLLOW_UP
        sponsor.next_follow_up_at = followup_schedule.scheduled_at
        
        self.db.commit()
        self.db.refresh(email_log)
        
        return email_log
    
    def process_follow_up_approval(
        self,
        email_log_id: int,
        approved: bool,
        approver_id: int,
        rejection_reason: str = None
    ) -> Dict[str, Any]:
        """Process approval/rejection of a follow-up email."""
        
        email_log = self.db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
        if not email_log:
            return {"success": False, "error": "Email not found"}
        
        if email_log.status not in [EmailStatus.DRAFT, EmailStatus.PENDING_APPROVAL]:
            return {"success": False, "error": f"Email cannot be approved (status: {email_log.status})"}
        
        if approved:
            email_log.status = EmailStatus.APPROVED
            email_log.approved_by = approver_id
            email_log.approved_at = datetime.utcnow()
            
            # Update follow-up schedule
            if email_log.follow_up_number > 0:
                followup = self.db.query(FollowUpSchedule).filter(
                    FollowUpSchedule.email_id == email_log.id
                ).first()
                if followup:
                    followup.status = "approved"
        else:
            email_log.status = EmailStatus.REJECTED
            email_log.rejected_by = approver_id
            email_log.rejected_at = datetime.utcnow()
            email_log.rejection_reason = rejection_reason
            
            # Update follow-up schedule
            if email_log.follow_up_number > 0:
                followup = self.db.query(FollowUpSchedule).filter(
                    FollowUpSchedule.email_id == email_log.id
                ).first()
                if followup:
                    followup.status = "cancelled"
            
            # Decrement sponsor follow-up count
            sponsor = self.db.query(Sponsor).filter(Sponsor.id == email_log.sponsor_id).first()
            if sponsor and sponsor.follow_up_count > 0:
                sponsor.follow_up_count -= 1
        
        self.db.commit()
        
        return {"success": True, "email_log": email_log}
    
    def send_approved_follow_up(
        self,
        email_log_id: int,
        email_sending_service
    ) -> Dict[str, Any]:
        """Send an approved follow-up email."""
        
        from app.models import TeamMember
        
        email_log = self.db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
        if not email_log:
            return {"success": False, "error": "Email not found"}
        
        if email_log.status != EmailStatus.APPROVED:
            return {"success": False, "error": f"Email not approved (status: {email_log.status})"}
        
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == email_log.sponsor_id).first()
        sender = self.db.query(TeamMember).filter(TeamMember.id == email_log.sender_id).first()
        
        if not sponsor or not sender:
            return {"success": False, "error": "Sponsor or sender not found"}
        
        if not sponsor.contact_email:
            return {"success": False, "error": "Sponsor has no contact email"}
        
        # Send email
        result = email_sending_service.send_email(
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
            if sponsor.follow_up_count < self.MAX_FOLLOW_UPS:
                next_num = sponsor.follow_up_count + 1
                interval = self.FOLLOW_UP_INTERVALS.get(next_num, 7)
                sponsor.next_follow_up_at = datetime.utcnow() + timedelta(days=interval)
            else:
                sponsor.next_follow_up_at = None
            
            # Update follow-up schedule
            followup = self.db.query(FollowUpSchedule).filter(
                FollowUpSchedule.email_id == email_log.id
            ).first()
            if followup:
                followup.status = "sent"
        else:
            email_log.status = EmailStatus.FAILED
            email_log.error_message = result["error"]
        
        self.db.commit()
        
        return result
    
    def cancel_follow_ups_for_sponsor(self, sponsor_id: int, reason: str = "Sponsor replied"):
        """Cancel all pending follow-ups for a sponsor (e.g., after reply)."""
        
        pending = self.db.query(FollowUpSchedule).filter(
            FollowUpSchedule.sponsor_id == sponsor_id,
            FollowUpSchedule.status.in_(["pending", "created", "approved"])
        ).all()
        
        for f in pending:
            f.status = "cancelled"
        
        # Also reject pending email logs
        pending_emails = self.db.query(EmailLog).filter(
            EmailLog.sponsor_id == sponsor_id,
            EmailLog.follow_up_number > 0,
            EmailLog.status.in_([EmailStatus.DRAFT, EmailStatus.PENDING_APPROVAL, EmailStatus.APPROVED])
        ).all()
        
        for e in pending_emails:
            e.status = EmailStatus.REJECTED
            e.rejection_reason = reason
        
        # Reset sponsor follow-up tracking
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
        if sponsor:
            sponsor.next_follow_up_at = None
        
        self.db.commit()
        
        logger.info(f"Cancelled follow-ups for sponsor {sponsor_id}: {reason}")


# Helper function to get follow-up stats for a sponsor
def get_follow_up_status(db_session, sponsor_id: int) -> Dict:
    """Get follow-up status for a sponsor."""
    
    sponsor = db_session.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
    if not sponsor:
        return {}
    
    followups = db_session.query(FollowUpSchedule).filter(
        FollowUpSchedule.sponsor_id == sponsor_id
    ).order_by(FollowUpSchedule.follow_up_number).all()
    
    sent_followups = db_session.query(EmailLog).filter(
        EmailLog.sponsor_id == sponsor_id,
        EmailLog.follow_up_number > 0,
        EmailLog.status == EmailStatus.SENT
    ).count()
    
    return {
        "sponsor_id": sponsor_id,
        "company_name": sponsor.company_name,
        "follow_up_count": sponsor.follow_up_count,
        "max_follow_ups": FollowUpService.MAX_FOLLOW_UPS,
        "remaining_follow_ups": max(0, FollowUpService.MAX_FOLLOW_UPS - sponsor.follow_up_count),
        "next_follow_up_at": sponsor.next_follow_up_at,
        "follow_up_schedule": [
            {
                "number": f.follow_up_number,
                "scheduled_at": f.scheduled_at,
                "status": f.status,
                "has_draft": bool(f.draft_subject)
            }
            for f in followups
        ],
        "sent_followups": sent_followups
        }
