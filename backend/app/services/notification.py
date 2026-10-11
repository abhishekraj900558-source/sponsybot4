# SPONSY BOT Notification Service
"""
In-app notifications for organizers.
Tracks important events: replies, interest, follow-ups due, meetings, sponsorships won.
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from app.config import settings
from app.models import Notification, TeamMember, Sponsor

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing in-app notifications."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    def create_notification(
        self,
        team_member_id: int,
        notification_type: str,
        title: str,
        message: str,
        sponsor_id: int = None,
        action_url: str = None,
        action_label: str = None
    ) -> Notification:
        """Create a new notification."""
        
        notification = Notification(
            team_member_id=team_member_id,
            sponsor_id=sponsor_id,
            type=notification_type,
            title=title,
            message=message,
            action_url=action_url,
            action_label=action_label
        )
        
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        
        logger.info(f"Notification created for user {team_member_id}: {title}")
        
        return notification
    
    def notify_reply_received(self, sponsor: Sponsor, classification: str, summary: str):
        """Notify when a sponsor replies."""
        
        # Notify assignee
        if sponsor.assignee_id:
            self.create_notification(
                team_member_id=sponsor.assignee_id,
                notification_type="reply_received",
                title=f"New reply from {sponsor.company_name}",
                message=f"{sponsor.company_name} replied: {summary}",
                sponsor_id=sponsor.id,
                action_url=f"/sponsors/{sponsor.id}",
                action_label="View Reply"
            )
        
        # Also notify all active team members for INTERESTED/DECLINED
        if classification in ["Interested", "Declined"]:
            members = self.db.query(TeamMember).filter(TeamMember.is_active == True).all()
            for member in members:
                if member.id != sponsor.assignee_id:  # Avoid duplicate for assignee
                    self.create_notification(
                        team_member_id=member.id,
                        notification_type=f"sponsor_{classification.lower()}",
                        title=f"Sponsor {classification}: {sponsor.company_name}",
                        message=f"{sponsor.company_name} has {classification.lower()}. {summary}",
                        sponsor_id=sponsor.id,
                        action_url=f"/sponsors/{sponsor.id}",
                        action_label="View Details"
                    )
    
    def notify_follow_up_due(self, sponsor: Sponsor):
        """Notify when a follow-up is due."""
        
        if sponsor.assignee_id:
            self.create_notification(
                team_member_id=sponsor.assignee_id,
                notification_type="follow_up_due",
                title=f"Follow-up due: {sponsor.company_name}",
                message=f"Follow-up #{sponsor.follow_up_count + 1} is due for {sponsor.company_name}",
                sponsor_id=sponsor.id,
                action_url=f"/sponsors/{sponsor.id}/follow-up",
                action_label="Create Follow-up"
            )
    
    def notify_meeting_requested(self, sponsor: Sponsor, meeting_id: int):
        """Notify when a meeting is requested."""
        
        if sponsor.assignee_id:
            self.create_notification(
                team_member_id=sponsor.assignee_id,
                notification_type="meeting_requested",
                title=f"Meeting requested: {sponsor.company_name}",
                message=f"A meeting has been requested with {sponsor.company_name}",
                sponsor_id=sponsor.id,
                action_url=f"/meetings/{meeting_id}",
                action_label="View Meeting"
            )
    
    def notify_meeting_scheduled(self, sponsor: Sponsor, meeting_id: int, scheduled_at: datetime):
        """Notify when a meeting is scheduled."""
        
        if sponsor.assignee_id:
            self.create_notification(
                team_member_id=sponsor.assignee_id,
                notification_type="meeting_scheduled",
                title=f"Meeting scheduled: {sponsor.company_name}",
                message=f"Meeting with {sponsor.company_name} scheduled for {scheduled_at.strftime('%b %d, %Y at %I:%M %p')}",
                sponsor_id=sponsor.id,
                action_url=f"/meetings/{meeting_id}",
                action_label="View Meeting"
            )
    
    def notify_sponsorship_won(self, sponsor: Sponsor, amount: int = None, benefits: List = None):
        """Notify when a sponsorship is secured."""
        
        # Notify all active team members
        members = self.db.query(TeamMember).filter(TeamMember.is_active == True).all()
        
        details = ""
        if amount:
            details += f" Amount: {amount/100:,.0f}."
        if benefits:
            details += f" Benefits: {', '.join(str(b) for b in benefits)}."
        
        for member in members:
            self.create_notification(
                team_member_id=member.id,
                notification_type="sponsorship_won",
                title=f"🎉 Sponsorship Won: {sponsor.company_name}",
                message=f"Successfully secured sponsorship from {sponsor.company_name}!{details}",
                sponsor_id=sponsor.id,
                action_url=f"/sponsors/{sponsor.id}",
                action_label="View Details"
            )
    
    def notify_email_approval_needed(self, sponsor: Sponsor, email_id: int, email_type: str):
        """Notify when an email needs approval (if not auto-approved)."""
        
        # In this system, the sender creates the draft and approves it themselves
        # But we could notify a manager/lead for oversight
        pass
    
    def get_notifications(
        self,
        team_member_id: int,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> List[Notification]:
        """Get notifications for a team member."""
        
        query = self.db.query(Notification).filter(
            Notification.team_member_id == team_member_id
        )
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        return query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    def mark_as_read(self, notification_id: int, team_member_id: int) -> bool:
        """Mark a notification as read."""
        
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.team_member_id == team_member_id
        ).first()
        
        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            self.db.commit()
            return True
        
        return False
    
    def mark_all_as_read(self, team_member_id: int) -> int:
        """Mark all notifications as read for a team member."""
        
        count = self.db.query(Notification).filter(
            Notification.team_member_id == team_member_id,
            Notification.is_read == False
        ).update({
            "is_read": True,
            "read_at": datetime.utcnow()
        })
        
        self.db.commit()
        return count
    
    def get_unread_count(self, team_member_id: int) -> int:
        """Get count of unread notifications."""
        
        return self.db.query(Notification).filter(
            Notification.team_member_id == team_member_id,
            Notification.is_read == False
        ).count()
    
    def delete_notification(self, notification_id: int, team_member_id: int) -> bool:
        """Delete a notification."""
        
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.team_member_id == team_member_id
        ).first()
        
        if notification:
            self.db.delete(notification)
            self.db.commit()
            return True
        
        return False


def create_notification_service(db_session) -> NotificationService:
    """Factory function to create NotificationService."""
    return NotificationService(db_session)