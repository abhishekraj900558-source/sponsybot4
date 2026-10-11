# SPONSY BOT Meeting Workflow Service
"""
Meeting scheduling and management for interested sponsors.
Supports calendar links, Google Calendar integration, and meeting tracking.
"""
import logging
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.config import settings
from app.models import Meeting, MeetingStatus, Sponsor, SponsorStatus, TeamMember

logger = logging.getLogger(__name__)


@dataclass
class MeetingSlot:
    """Available meeting time slot."""
    start: datetime
    end: datetime
    label: str


class MeetingService:
    """Service for managing sponsor meetings."""
    
    def __init__(self, db_session):
        self.db = db_session
        self.default_duration = 30  # minutes
    
    def request_meeting(
        self,
        sponsor_id: int,
        team_member_id: int,
        title: str = None,
        description: str = None,
        preferred_slots: List[MeetingSlot] = None,
        meeting_link: str = None
    ) -> Meeting:
        """Create a meeting request for an interested sponsor."""
        
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
        if not sponsor:
            raise ValueError("Sponsor not found")
        
        if sponsor.status != SponsorStatus.INTERESTED:
            logger.warning(f"Requesting meeting for sponsor with status {sponsor.status}")
        
        # Create meeting request
        meeting = Meeting(
            sponsor_id=sponsor_id,
            team_member_id=team_member_id,
            title=title or f"Sponsorship Discussion: {sponsor.company_name}",
            description=description or f"Discuss sponsorship opportunities for {sponsor.company_name}",
            scheduled_at=preferred_slots[0].start if preferred_slots else datetime.utcnow() + timedelta(days=7),
            duration_minutes=self.default_duration,
            meeting_link=meeting_link,
            status=MeetingStatus.REQUESTED
        )
        
        self.db.add(meeting)
        
        # Update sponsor meeting status
        sponsor.meeting_status = MeetingStatus.REQUESTED
        
        self.db.commit()
        self.db.refresh(meeting)
        
        logger.info(f"Meeting requested for sponsor {sponsor.company_name} (ID: {meeting.id})")
        
        return meeting
    
    def schedule_meeting(
        self,
        meeting_id: int,
        scheduled_at: datetime,
        duration_minutes: int = None,
        location: str = None,
        meeting_link: str = None,
        calendar_event_id: str = None
    ) -> Meeting:
        """Confirm and schedule a meeting."""
        
        meeting = self.db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            raise ValueError("Meeting not found")
        
        meeting.scheduled_at = scheduled_at
        if duration_minutes:
            meeting.duration_minutes = duration_minutes
        if location:
            meeting.location = location
        if meeting_link:
            meeting.meeting_link = meeting_link
        if calendar_event_id:
            meeting.calendar_event_id = calendar_event_id
        
        meeting.status = MeetingStatus.SCHEDULED
        
        # Update sponsor
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == meeting.sponsor_id).first()
        if sponsor:
            sponsor.meeting_status = MeetingStatus.SCHEDULED
            sponsor.meeting_scheduled_at = scheduled_at
        
        self.db.commit()
        self.db.refresh(meeting)
        
        logger.info(f"Meeting {meeting_id} scheduled for {scheduled_at}")
        
        return meeting
    
    def complete_meeting(
        self,
        meeting_id: int,
        outcome: str = None,
        notes: str = None,
        next_steps: str = None
    ) -> Meeting:
        """Mark meeting as completed with outcome."""
        
        meeting = self.db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            raise ValueError("Meeting not found")
        
        meeting.status = MeetingStatus.COMPLETED
        if outcome:
            meeting.outcome = outcome
        if notes:
            meeting.notes = (meeting.notes or "") + f"\n\n[Completed {datetime.utcnow().isoformat()}]\n{notes}"
        if next_steps:
            meeting.notes = (meeting.notes or "") + f"\n\nNext Steps:\n{next_steps}"
        
        # Update sponsor based on outcome
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == meeting.sponsor_id).first()
        if sponsor:
            sponsor.meeting_status = MeetingStatus.COMPLETED
            if outcome and "won" in outcome.lower():
                sponsor.sponsorship_won = True
                sponsor.status = SponsorStatus.CLOSED
        
        self.db.commit()
        self.db.refresh(meeting)
        
        return meeting
    
    def cancel_meeting(self, meeting_id: int, reason: str = None) -> Meeting:
        """Cancel a meeting."""
        
        meeting = self.db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            raise ValueError("Meeting not found")
        
        meeting.status = MeetingStatus.CANCELLED
        if reason:
            meeting.notes = (meeting.notes or "") + f"\n\n[Cancelled {datetime.utcnow().isoformat()}]\nReason: {reason}"
        
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == meeting.sponsor_id).first()
        if sponsor:
            sponsor.meeting_status = MeetingStatus.CANCELLED
        
        self.db.commit()
        self.db.refresh(meeting)
        
        return meeting
    
    def get_upcoming_meetings(
        self,
        team_member_id: int = None,
        days_ahead: int = 30
    ) -> List[Meeting]:
        """Get upcoming meetings."""
        
        query = self.db.query(Meeting).filter(
            Meeting.status.in_([MeetingStatus.REQUESTED, MeetingStatus.SCHEDULED]),
            Meeting.scheduled_at >= datetime.utcnow(),
            Meeting.scheduled_at <= datetime.utcnow() + timedelta(days=days_ahead)
        )
        
        if team_member_id:
            query = query.filter(Meeting.team_member_id == team_member_id)
        
        return query.order_by(Meeting.scheduled_at).all()
    
    def get_meeting_history(self, sponsor_id: int) -> List[Meeting]:
        """Get all meetings for a sponsor."""
        return self.db.query(Meeting).filter(
            Meeting.sponsor_id == sponsor_id
        ).order_by(Meeting.scheduled_at.desc()).all()
    
    def generate_calendar_link(
        self,
        meeting: Meeting,
        provider: str = "google"
    ) -> str:
        """Generate a calendar link for the meeting."""
        
        title = meeting.title
        details = meeting.description or ""
        if meeting.meeting_link:
            details += f"\n\nMeeting link: {meeting.meeting_link}"
        if meeting.location:
            details += f"\nLocation: {meeting.location}"
        
        start = meeting.scheduled_at.strftime("%Y%m%dT%H%M%SZ")
        end = (meeting.scheduled_at + timedelta(minutes=meeting.duration_minutes)).strftime("%Y%m%dT%H%M%SZ")
        
        if provider == "google":
            params = {
                "action": "TEMPLATE",
                "text": title,
                "dates": f"{start}/{end}",
                "details": details,
            }
            if meeting.location:
                params["location"] = meeting.location
            query = "&".join(f"{k}={v}" for k, v in params.items())
            return f"https://calendar.google.com/calendar/render?{query}"
        
        elif provider == "outlook":
            params = {
                "subject": title,
                "startdt": start,
                "enddt": end,
                "body": details,
            }
            if meeting.location:
                params["location"] = meeting.location
            query = "&".join(f"{k}={v}" for k, v in params.items())
            return f"https://outlook.live.com/calendar/0/deeplink/compose?{query}"
        
        elif provider == "ical":
            # Generate iCal content
            uid = f"{meeting.id}-{uuid.uuid4()}@sponsybot"
            ical = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SponsyBot//Meeting Scheduler//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")}
DTSTART:{start}
DTEND:{end}
SUMMARY:{title}
DESCRIPTION:{details}
LOCATION:{meeting.location or ""}
STATUS:CONFIRMED
SEQUENCE:0
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR"""
            return ical
        
        return ""
    
    def suggest_meeting_times(
        self,
        team_member_id: int,
        duration_minutes: int = 30,
        days_ahead: int = 14,
        preferred_hours: tuple = (9, 17),  # 9 AM - 5 PM
        timezone_offset: int = 0  # Hours from UTC
    ) -> List[MeetingSlot]:
        """Suggest available meeting times (simplified - in production, check calendar)."""
        
        # This is a simplified version. In production, integrate with Google Calendar API
        # to check actual availability.
        
        slots = []
        now = datetime.utcnow() + timedelta(hours=timezone_offset)
        start_date = now.replace(hour=preferred_hours[0], minute=0, second=0, microsecond=0)
        if start_date < now:
            start_date += timedelta(days=1)
        
        for day in range(days_ahead):
            current_date = start_date + timedelta(days=day)
            
            # Skip weekends
            if current_date.weekday() >= 5:
                continue
            
            # Morning slots
            for hour in range(preferred_hours[0], preferred_hours[1]):
                if hour + 1 > preferred_hours[1]:
                    break
                slot_start = current_date.replace(hour=hour)
                slot_end = slot_start + timedelta(minutes=duration_minutes)
                
                # Only suggest future slots
                if slot_start > now:
                    slots.append(MeetingSlot(
                        start=slot_start - timedelta(hours=timezone_offset),
                        end=slot_end - timedelta(hours=timezone_offset),
                        label=slot_start.strftime("%a %b %d, %I:%M %p")
                    ))
        
        return slots[:10]  # Return top 10 slots
    
    def send_meeting_confirmation_email(
        self,
        meeting: Meeting,
        email_sending_service
    ) -> Dict[str, Any]:
        """Send meeting confirmation email to sponsor."""
        
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == meeting.sponsor_id).first()
        team_member = self.db.query(TeamMember).filter(TeamMember.id == meeting.team_member_id).first()
        
        if not sponsor or not team_member or not sponsor.contact_email:
            return {"success": False, "error": "Missing sponsor, team member, or contact email"}
        
        # Generate calendar links
        google_link = self.generate_calendar_link(meeting, "google")
        outlook_link = self.generate_calendar_link(meeting, "outlook")
        
        subject = f"Meeting Confirmed: {meeting.title}"
        body = f"""Hi {sponsor.contact_person or "there"},

Your meeting has been confirmed!

📅 **Meeting Details:**
• **Title:** {meeting.title}
• **Date & Time:** {meeting.scheduled_at.strftime("%A, %B %d, %Y at %I:%M %p UTC")}
• **Duration:** {meeting.duration_minutes} minutes
• **Location/Link:** {meeting.meeting_link or meeting.location or "To be confirmed"}

📝 **Agenda:**
{meeting.description or "Discuss sponsorship partnership details."}

📅 **Add to Calendar:**
• [Google Calendar]({google_link})
• [Outlook Calendar]({outlook_link})

If you need to reschedule, please reply to this email or contact {team_member.name} at {team_member.email}.

Looking forward to our conversation!

Best regards,
{team_member.name}
{team_member.role or "Sponsorship Team"}
"""
        
        # Create email log
        from app.models import EmailLog, EmailStatus
        email_log = EmailLog(
            sponsor_id=sponsor.id,
            sender_id=team_member.id,
            subject=subject,
            body=body,
            email_type="meeting_confirmation",
            status=EmailStatus.SENT,
            sent_at=datetime.utcnow()
        )
        self.db.add(email_log)
        self.db.commit()
        
        # Actually send (in demo mode this is simulated)
        result = email_sending_service.send_email(
            email_log=email_log,
            sender=team_member,
            recipient_email=sponsor.contact_email,
            recipient_name=sponsor.contact_person
        )
        
        return result


def create_meeting_service(db_session) -> MeetingService:
    """Factory function to create MeetingService."""
    return MeetingService(db_session)