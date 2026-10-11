# SPONSY BOT Dashboard Service
"""
Dashboard statistics and analytics for the sponsorship pipeline.
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
from sqlalchemy import func, and_, or_

from app.config import settings
from app.models import (
    Sponsor, EmailLog, ReplyLog, Meeting, TeamMember,
    SponsorStatus, EmailStatus, ReplyClassification, MeetingStatus
)

logger = logging.getLogger(__name__)


class DashboardService:
    """Service for generating dashboard statistics."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    def get_overview_stats(self) -> Dict[str, Any]:
        """Get overall dashboard statistics."""
        
        # Total sponsors
        total_sponsors = self.db.query(func.count(Sponsor.id)).scalar() or 0
        
        # Sponsors by status
        status_counts = {}
        for status in SponsorStatus:
            count = self.db.query(func.count(Sponsor.id)).filter(Sponsor.status == status).scalar() or 0
            status_counts[status.value] = count
        
        # Emails sent
        emails_sent = self.db.query(func.count(EmailLog.id)).filter(EmailLog.status == EmailStatus.SENT).scalar() or 0
        
        # Replies received
        replies_received = self.db.query(func.count(ReplyLog.id)).scalar() or 0
        
        # Response rate
        response_rate = 0
        if emails_sent > 0:
            response_rate = round((replies_received / emails_sent) * 100, 1)
        
        # Follow-up rate
        sponsors_contacted = self.db.query(func.count(Sponsor.id)).filter(
            Sponsor.status.in_([SponsorStatus.CONTACTED, SponsorStatus.FOLLOW_UP, SponsorStatus.INTERESTED, SponsorStatus.DECLINED, SponsorStatus.CLOSED])
        ).scalar() or 0
        
        sponsors_with_followups = self.db.query(func.count(Sponsor.id)).filter(Sponsor.follow_up_count > 0).scalar() or 0
        follow_up_rate = 0
        if sponsors_contacted > 0:
            follow_up_rate = round((sponsors_with_followups / sponsors_contacted) * 100, 1)
        
        # Money secured
        money_secured = self.db.query(func.coalesce(func.sum(Sponsor.sponsorship_amount), 0)).filter(
            Sponsor.sponsorship_won == True
        ).scalar() or 0
        
        # Benefits secured (count of sponsors with non-cash benefits)
        benefits_secured = self.db.query(func.count(Sponsor.id)).filter(
            Sponsor.sponsorship_won == True,
            Sponsor.sponsorship_benefits.isnot(None)
        ).scalar() or 0
        
        # Meetings
        meetings_scheduled = self.db.query(func.count(Meeting.id)).filter(
            Meeting.status.in_([MeetingStatus.SCHEDULED, MeetingStatus.REQUESTED])
        ).scalar() or 0
        
        meetings_completed = self.db.query(func.count(Meeting.id)).filter(
            Meeting.status == MeetingStatus.COMPLETED
        ).scalar() or 0
        
        # Sponsorships won
        sponsorships_won = self.db.query(func.count(Sponsor.id)).filter(Sponsor.sponsorship_won == True).scalar() or 0
        
        return {
            "total_sponsors": total_sponsors,
            "by_status": status_counts,
            "emails_sent": emails_sent,
            "replies_received": replies_received,
            "response_rate": response_rate,
            "follow_up_rate": follow_up_rate,
            "money_secured": money_secured,
            "benefits_secured": benefits_secured,
            "meetings_scheduled": meetings_scheduled,
            "meetings_completed": meetings_completed,
            "sponsorships_won": sponsorships_won,
        }
    
    def get_pipeline_data(self) -> Dict[str, List[Dict]]:
        """Get pipeline data grouped by status."""
        
        pipeline = {}
        for status in SponsorStatus:
            sponsors = self.db.query(Sponsor).filter(Sponsor.status == status).order_by(
                Sponsor.priority_score.desc()
            ).limit(20).all()
            
            pipeline[status.value] = [
                {
                    "id": s.id,
                    "company_name": s.company_name,
                    "contact_person": s.contact_person,
                    "contact_email": s.contact_email,
                    "priority_score": s.priority_score,
                    "priority_tier": s.priority_tier,
                    "assignee": s.assignee.name if s.assignee else None,
                    "follow_up_count": s.follow_up_count,
                    "last_contacted_at": s.last_contacted_at.isoformat() if s.last_contacted_at else None,
                    "meeting_status": s.meeting_status.value if s.meeting_status else None,
                }
                for s in sponsors
            ]
        
        return pipeline
    
    def get_team_performance(self) -> List[Dict]:
        """Get performance stats per team member."""
        
        members = self.db.query(TeamMember).filter(TeamMember.is_active == True).all()
        
        performance = []
        for member in members:
            # Sponsors assigned
            assigned = self.db.query(func.count(Sponsor.id)).filter(Sponsor.assignee_id == member.id).scalar() or 0
            
            # Emails sent
            emails_sent = self.db.query(func.count(EmailLog.id)).filter(
                EmailLog.sender_id == member.id,
                EmailLog.status == EmailStatus.SENT
            ).scalar() or 0
            
            # Replies received (on their emails)
            replies = self.db.query(func.count(ReplyLog.id)).join(EmailLog).filter(
                EmailLog.sender_id == member.id
            ).scalar() or 0
            
            # Interested sponsors
            interested = self.db.query(func.count(Sponsor.id)).filter(
                Sponsor.assignee_id == member.id,
                Sponsor.status == SponsorStatus.INTERESTED
            ).scalar() or 0
            
            # Won sponsorships
            won = self.db.query(func.count(Sponsor.id)).filter(
                Sponsor.assignee_id == member.id,
                Sponsor.sponsorship_won == True
            ).scalar() or 0
            
            # Money secured
            money = self.db.query(func.coalesce(func.sum(Sponsor.sponsorship_amount), 0)).filter(
                Sponsor.assignee_id == member.id,
                Sponsor.sponsorship_won == True
            ).scalar() or 0
            
            response_rate = 0
            if emails_sent > 0:
                response_rate = round((replies / emails_sent) * 100, 1)
            
            performance.append({
                "team_member_id": member.id,
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "assigned_sponsors": assigned,
                "emails_sent": emails_sent,
                "replies_received": replies,
                "response_rate": response_rate,
                "interested_sponsors": interested,
                "sponsorships_won": won,
                "money_secured": money
            })
        
        return performance
    
    def get_recent_activity(self, limit: int = 20) -> List[Dict]:
        """Get recent activity across the system."""
        
        activities = []
        
        # Recent emails sent
        recent_emails = self.db.query(EmailLog).filter(
            EmailLog.status == EmailStatus.SENT
        ).order_by(EmailLog.sent_at.desc()).limit(limit).all()
        
        for email in recent_emails:
            sponsor = self.db.query(Sponsor).filter(Sponsor.id == email.sponsor_id).first()
            sender = self.db.query(TeamMember).filter(TeamMember.id == email.sender_id).first()
            activities.append({
                "type": "email_sent",
                "timestamp": email.sent_at.isoformat() if email.sent_at else email.created_at.isoformat(),
                "description": f"Email sent to {sponsor.company_name if sponsor else 'Unknown'} by {sender.name if sender else 'Unknown'}",
                "sponsor_id": email.sponsor_id,
                "email_id": email.id,
                "metadata": {"subject": email.subject, "email_type": email.email_type}
            })
        
        # Recent replies
        recent_replies = self.db.query(ReplyLog).order_by(ReplyLog.received_at.desc()).limit(limit).all()
        
        for reply in recent_replies:
            sponsor = self.db.query(Sponsor).filter(Sponsor.id == reply.sponsor_id).first()
            activities.append({
                "type": "reply_received",
                "timestamp": reply.received_at.isoformat(),
                "description": f"Reply from {sponsor.company_name if sponsor else 'Unknown'} ({reply.classification.value if reply.classification else 'Unclassified'})",
                "sponsor_id": reply.sponsor_id,
                "reply_id": reply.id,
                "metadata": {"classification": reply.classification.value if reply.classification else None, "summary": reply.summary}
            })
        
        # Recent meetings
        recent_meetings = self.db.query(Meeting).order_by(Meeting.created_at.desc()).limit(limit).all()
        
        for meeting in recent_meetings:
            sponsor = self.db.query(Sponsor).filter(Sponsor.id == meeting.sponsor_id).first()
            activities.append({
                "type": "meeting",
                "timestamp": meeting.created_at.isoformat(),
                "description": f"Meeting {meeting.status.value.lower()}: {sponsor.company_name if sponsor else 'Unknown'}",
                "sponsor_id": meeting.sponsor_id,
                "meeting_id": meeting.id,
                "metadata": {"status": meeting.status.value, "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None}
            })
        
        # Sort by timestamp
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return activities[:limit]
    
    def get_conversion_funnel(self) -> Dict[str, int]:
        """Get conversion funnel data."""
        
        funnel = {
            "total_prospects": self.db.query(func.count(Sponsor.id)).scalar() or 0,
            "contacted": self.db.query(func.count(Sponsor.id)).filter(
                Sponsor.status.in_([SponsorStatus.CONTACTED, SponsorStatus.FOLLOW_UP, SponsorStatus.INTERESTED, SponsorStatus.DECLINED, SponsorStatus.CLOSED])
            ).scalar() or 0,
            "replied": self.db.query(func.count(ReplyLog.id)).scalar() or 0,
            "interested": self.db.query(func.count(Sponsor.id)).filter(Sponsor.status == SponsorStatus.INTERESTED).scalar() or 0,
            "meetings": self.db.query(func.count(Meeting.id)).filter(
                Meeting.status.in_([MeetingStatus.SCHEDULED, MeetingStatus.COMPLETED])
            ).scalar() or 0,
            "won": self.db.query(func.count(Sponsor.id)).filter(Sponsor.sponsorship_won == True).scalar() or 0,
        }
        
        return funnel
    
    def get_sponsorship_breakdown(self) -> Dict[str, Any]:
        """Get breakdown of sponsorship types secured."""
        
        won_sponsors = self.db.query(Sponsor).filter(Sponsor.sponsorship_won == True).all()
        
        type_counts = defaultdict(int)
        total_cash = 0
        benefit_types = defaultdict(int)
        
        for sponsor in won_sponsors:
            if sponsor.sponsorship_amount:
                total_cash += sponsor.sponsorship_amount
            
            if sponsor.recommended_sponsorship_types:
                for stype in sponsor.recommended_sponsorship_types:
                    type_counts[stype] += 1
            
            if sponsor.sponsorship_benefits:
                for benefit in sponsor.sponsorship_benefits:
                    if isinstance(benefit, dict):
                        btype = benefit.get("type", "Other")
                    else:
                        btype = str(benefit)
                    benefit_types[btype] += 1
        
        return {
            "by_type": dict(type_counts),
            "total_cash": total_cash,
            "benefits_breakdown": dict(benefit_types),
            "total_sponsors_won": len(won_sponsors)
        }
    
    def get_weekly_trends(self, weeks: int = 8) -> List[Dict]:
        """Get weekly trends for emails, replies, and conversions."""
        
        trends = []
        now = datetime.utcnow()
        
        for i in range(weeks):
            week_start = now - timedelta(weeks=i+1)
            week_end = now - timedelta(weeks=i)
            
            emails = self.db.query(func.count(EmailLog.id)).filter(
                EmailLog.status == EmailStatus.SENT,
                EmailLog.sent_at >= week_start,
                EmailLog.sent_at < week_end
            ).scalar() or 0
            
            replies = self.db.query(func.count(ReplyLog.id)).filter(
                ReplyLog.received_at >= week_start,
                ReplyLog.received_at < week_end
            ).scalar() or 0
            
            interested = self.db.query(func.count(Sponsor.id)).filter(
                Sponsor.status == SponsorStatus.INTERESTED,
                Sponsor.updated_at >= week_start,
                Sponsor.updated_at < week_end
            ).scalar() or 0
            
            won = self.db.query(func.count(Sponsor.id)).filter(
                Sponsor.sponsorship_won == True,
                Sponsor.updated_at >= week_start,
                Sponsor.updated_at < week_end
            ).scalar() or 0
            
            trends.append({
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "emails_sent": emails,
                "replies_received": replies,
                "interested": interested,
                "won": won,
                "response_rate": round((replies / emails * 100), 1) if emails > 0 else 0
            })
        
        return list(reversed(trends))  # Chronological order
    
    def get_top_sponsors(self, limit: int = 10) -> List[Dict]:
        """Get top sponsors by priority score."""
        
        sponsors = self.db.query(Sponsor).filter(
            Sponsor.status != SponsorStatus.CLOSED
        ).order_by(Sponsor.priority_score.desc()).limit(limit).all()
        
        return [
            {
                "id": s.id,
                "company_name": s.company_name,
                "priority_score": s.priority_score,
                "priority_tier": s.priority_tier,
                "status": s.status.value,
                "recommended_types": s.recommended_sponsorship_types,
                "assignee": s.assignee.name if s.assignee else None
            }
            for s in sponsors
        ]


def create_dashboard_service(db_session) -> DashboardService:
    """Factory function to create DashboardService."""
    return DashboardService(db_session)