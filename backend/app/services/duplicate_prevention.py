# SPONSY BOT Duplicate Prevention Service
"""
Prevents duplicate outreach by checking company existence, contact history,
and team member assignments before any email is sent.
"""
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from difflib import SequenceMatcher

from app.config import settings
from app.models import Sponsor, EmailLog, TeamMember, EmailStatus

logger = logging.getLogger(__name__)


@dataclass
class DuplicateCheckResult:
    """Result of duplicate prevention check."""
    is_duplicate: bool
    existing_sponsor: Optional[Sponsor]
    conflict_type: Optional[str]  # "exact_company", "similar_company", "same_contact", "assigned_to_other"
    conflict_details: str
    suggested_action: str


class DuplicatePreventionService:
    """Service for preventing duplicate sponsor outreach."""
    
    def __init__(self, db_session):
        self.db = db_session
        self.similarity_threshold = 0.85  # For fuzzy company name matching
    
    def check_before_outreach(
        self,
        company_name: str,
        contact_email: str = None,
        contact_person: str = None,
        website: str = None,
        current_user_id: int = None
    ) -> DuplicateCheckResult:
        """
        Comprehensive duplicate check before creating sponsor or sending email.
        
        Checks:
        1. Exact company name + contact email match
        2. Similar company name (fuzzy match)
        3. Same contact email at different company
        4. Same contact person at different company
        5. Company assigned to another team member
        """
        
        # 1. Exact match: company name + contact email
        if contact_email:
            exact_match = self.db.query(Sponsor).filter(
                Sponsor.company_name.ilike(company_name),
                Sponsor.contact_email.ilike(contact_email)
            ).first()
            
            if exact_match:
                return DuplicateCheckResult(
                    is_duplicate=True,
                    existing_sponsor=exact_match,
                    conflict_type="exact_company_contact",
                    conflict_details=f"Exact match: '{exact_match.company_name}' with contact '{exact_match.contact_email}' already exists",
                    suggested_action=self._get_suggested_action(exact_match, current_user_id)
                )
        
        # 2. Exact company name match (different contact)
        exact_company = self.db.query(Sponsor).filter(
            Sponsor.company_name.ilike(company_name)
        ).first()
        
        if exact_company:
            # Check if same contact email
            if contact_email and exact_company.contact_email and contact_email.lower() == exact_company.contact_email.lower():
                return DuplicateCheckResult(
                    is_duplicate=True,
                    existing_sponsor=exact_company,
                    conflict_type="exact_company_contact",
                    conflict_details=f"Same company and contact email already tracked",
                    suggested_action=self._get_suggested_action(exact_company, current_user_id)
                )
            
            # Different contact at same company - potential duplicate but maybe valid
            return DuplicateCheckResult(
                is_duplicate=True,
                existing_sponsor=exact_company,
                conflict_type="same_company_different_contact",
                conflict_details=f"Company '{exact_company.company_name}' exists with contact '{exact_company.contact_email}'. New contact: '{contact_email}'",
                suggested_action="Review if this is a different department/contact at the same company. Consider adding as additional contact to existing record."
            )
        
        # 3. Same contact email at different company
        if contact_email:
            same_email = self.db.query(Sponsor).filter(
                Sponsor.contact_email.ilike(contact_email)
            ).first()
            
            if same_email:
                return DuplicateCheckResult(
                    is_duplicate=True,
                    existing_sponsor=same_email,
                    conflict_type="same_contact_different_company",
                    conflict_details=f"Contact '{contact_email}' is associated with '{same_email.company_name}', not '{company_name}'",
                    suggested_action="Verify if contact moved companies or if this is a data entry error."
                )
        
        # 4. Fuzzy company name matching
        similar_companies = self.db.query(Sponsor).all()
        for existing in similar_companies:
            similarity = self._calculate_similarity(company_name, existing.company_name)
            if similarity >= self.similarity_threshold:
                return DuplicateCheckResult(
                    is_duplicate=True,
                    existing_sponsor=existing,
                    conflict_type="similar_company_name",
                    conflict_details=f"Company name '{company_name}' is {similarity:.0%} similar to existing '{existing.company_name}'",
                    suggested_action="Verify if this is the same company with a name variation. Merge if duplicate."
                )
        
        # 5. Website domain matching
        if website:
            domain = self._extract_domain(website)
            if domain:
                existing_by_domain = self.db.query(Sponsor).filter(
                    Sponsor.website.ilike(f"%{domain}%")
                ).first()
                
                if existing_by_domain:
                    return DuplicateCheckResult(
                        is_duplicate=True,
                        existing_sponsor=existing_by_domain,
                        conflict_type="same_domain",
                        conflict_details=f"Website domain '{domain}' matches existing sponsor '{existing_by_domain.company_name}'",
                        suggested_action="Likely the same company. Merge records."
                    )
        
        # No duplicates found
        return DuplicateCheckResult(
            is_duplicate=False,
            existing_sponsor=None,
            conflict_type=None,
            conflict_details="No duplicates found",
            suggested_action="Proceed with new sponsor entry"
        )
    
    def check_before_send(
        self,
        sponsor_id: int,
        sender_id: int
    ) -> DuplicateCheckResult:
        """
        Final check before sending an email.
        Verifies the sponsor hasn't been contacted by someone else recently.
        """
        
        sponsor = self.db.query(Sponsor).filter(Sponsor.id == sponsor_id).first()
        if not sponsor:
            return DuplicateCheckResult(
                is_duplicate=True,
                existing_sponsor=None,
                conflict_type="sponsor_not_found",
                conflict_details="Sponsor record not found",
                suggested_action="Verify sponsor ID"
            )
        
        # Check if sponsor is assigned to someone else
        if sponsor.assignee_id and sponsor.assignee_id != sender_id:
            assignee = self.db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
            return DuplicateCheckResult(
                is_duplicate=True,
                existing_sponsor=sponsor,
                conflict_type="assigned_to_other",
                conflict_details=f"Sponsor is assigned to {assignee.name if assignee else 'another team member'} (ID: {sponsor.assignee_id})",
                suggested_action="Coordinate with the assigned team member before sending."
            )
        
        # Check for recent emails from other team members
        recent_emails = self.db.query(EmailLog).filter(
            EmailLog.sponsor_id == sponsor_id,
            EmailLog.status.in_([EmailStatus.SENT, EmailStatus.APPROVED]),
            EmailLog.sender_id != sender_id
        ).order_by(EmailLog.sent_at.desc()).limit(5).all()
        
        if recent_emails:
            other_senders = set(e.sender_id for e in recent_emails)
            other_names = []
            for sender_id_other in other_senders:
                tm = self.db.query(TeamMember).filter(TeamMember.id == sender_id_other).first()
                if tm:
                    other_names.append(tm.name)
            
            return DuplicateCheckResult(
                is_duplicate=True,
                existing_sponsor=sponsor,
                conflict_type="contacted_by_other",
                conflict_details=f"Sponsor has been contacted by: {', '.join(other_names)}",
                suggested_action="Confirm with team members before sending another email."
            )
        
        # Check if sponsor already has a reply (interested/declined)
        from app.models import ReplyLog, ReplyClassification
        latest_reply = self.db.query(ReplyLog).filter(
            ReplyLog.sponsor_id == sponsor_id
        ).order_by(ReplyLog.received_at.desc()).first()
        
        if latest_reply:
            if latest_reply.classification == ReplyClassification.INTERESTED:
                return DuplicateCheckResult(
                    is_duplicate=True,
                    existing_sponsor=sponsor,
                    conflict_type="sponsor_interested",
                    conflict_details="Sponsor has already expressed interest. Further outreach may be inappropriate.",
                    suggested_action="Move to meeting/negotiation stage instead of sending more outreach."
                )
            elif latest_reply.classification == ReplyClassification.DECLINED:
                return DuplicateCheckResult(
                    is_duplicate=True,
                    existing_sponsor=sponsor,
                    conflict_type="sponsor_declined",
                    conflict_details="Sponsor has explicitly declined. Do not contact further.",
                    suggested_action="Respect the decline. Do not send follow-ups."
                )
        
        # Check follow-up count
        if sponsor.follow_up_count >= 2:
            return DuplicateCheckResult(
                is_duplicate=True,
                existing_sponsor=sponsor,
                conflict_type="max_followups_reached",
                conflict_details=f"Maximum 2 follow-ups already sent ({sponsor.follow_up_count} total)",
                suggested_action="Do not send more follow-ups. Sponsor has not responded to previous attempts."
            )
        
        return DuplicateCheckResult(
            is_duplicate=False,
            existing_sponsor=sponsor,
            conflict_type=None,
            conflict_details="Safe to send",
            suggested_action="Proceed with email sending"
        )
    
    def find_potential_duplicates(
        self,
        company_name: str = None,
        contact_email: str = None,
        website: str = None
    ) -> List[Sponsor]:
        """Find all potential duplicate sponsors for review."""
        
        potential = []
        
        if company_name:
            # Exact match
            exact = self.db.query(Sponsor).filter(
                Sponsor.company_name.ilike(company_name)
            ).all()
            potential.extend(exact)
            
            # Fuzzy match
            all_sponsors = self.db.query(Sponsor).all()
            for s in all_sponsors:
                if s not in potential:
                    similarity = self._calculate_similarity(company_name, s.company_name)
                    if similarity >= 0.7:  # Lower threshold for review
                        potential.append(s)
        
        if contact_email:
            by_email = self.db.query(Sponsor).filter(
                Sponsor.contact_email.ilike(contact_email)
            ).all()
            for s in by_email:
                if s not in potential:
                    potential.append(s)
        
        if website:
            domain = self._extract_domain(website)
            if domain:
                by_domain = self.db.query(Sponsor).filter(
                    Sponsor.website.ilike(f"%{domain}%")
                ).all()
                for s in by_domain:
                    if s not in potential:
                        potential.append(s)
        
        return potential
    
    def merge_sponsors(
        self,
        primary_sponsor_id: int,
        duplicate_sponsor_id: int,
        merged_by: int
    ) -> Sponsor:
        """Merge duplicate sponsor records into primary."""
        
        primary = self.db.query(Sponsor).filter(Sponsor.id == primary_sponsor_id).first()
        duplicate = self.db.query(Sponsor).filter(Sponsor.id == duplicate_sponsor_id).first()
        
        if not primary or not duplicate:
            raise ValueError("One or both sponsors not found")
        
        if primary.id == duplicate.id:
            raise ValueError("Cannot merge sponsor with itself")
        
        # Merge data - keep primary's data, supplement with duplicate's non-empty fields
        merge_fields = [
            "contact_person", "contact_email", "contact_role", "contact_linkedin", "contact_phone",
            "industry", "website", "size", "company_category",
            "research_data", "research_unverified", "research_source",
            "notes"
        ]
        
        for field in merge_fields:
            primary_val = getattr(primary, field)
            dup_val = getattr(duplicate, field)
            if not primary_val and dup_val:
                setattr(primary, field, dup_val)
        
        # Merge emails - reassign to primary
        dup_emails = self.db.query(EmailLog).filter(EmailLog.sponsor_id == duplicate.id).all()
        for email in dup_emails:
            email.sponsor_id = primary.id
        
        # Merge replies
        from app.models import ReplyLog
        dup_replies = self.db.query(ReplyLog).filter(ReplyLog.sponsor_id == duplicate.id).all()
        for reply in dup_replies:
            reply.sponsor_id = primary.id
        
        # Merge follow-ups
        from app.models import FollowUpSchedule
        dup_followups = self.db.query(FollowUpSchedule).filter(FollowUpSchedule.sponsor_id == duplicate.id).all()
        for fu in dup_followups:
            fu.sponsor_id = primary.id
        
        # Merge meetings
        from app.models import Meeting
        dup_meetings = self.db.query(Meeting).filter(Meeting.sponsor_id == duplicate.id).all()
        for meeting in dup_meetings:
            meeting.sponsor_id = primary.id
        
        # Add merge note
        merge_note = f"\n\n[MERGED {datetime.utcnow().isoformat()} by user {merged_by}] Merged from sponsor ID {duplicate.id} ({duplicate.company_name})"
        primary.notes = (primary.notes or "") + merge_note
        
        # Delete duplicate
        self.db.delete(duplicate)
        self.db.commit()
        
        logger.info(f"Merged sponsor {duplicate.id} into {primary.id} by user {merged_by}")
        
        return primary
    
    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """Calculate similarity between two strings."""
        # Normalize
        s1 = self._normalize_company_name(str1)
        s2 = self._normalize_company_name(str2)
        return SequenceMatcher(None, s1, s2).ratio()
    
    def _normalize_company_name(self, name: str) -> str:
        """Normalize company name for comparison."""
        # Remove common suffixes/prefixes
        suffixes = ["inc", "inc.", "llc", "llc.", "ltd", "ltd.", "corp", "corp.", "corporation", "company", "co", "co.", "gmbh", "pvt", "pvt.", "private", "limited"]
        name = name.lower().strip()
        
        # Remove punctuation
        import re
        name = re.sub(r'[^\w\s]', ' ', name)
        
        # Remove suffixes
        words = name.split()
        words = [w for w in words if w not in suffixes]
        
        return " ".join(words)
    
    def _extract_domain(self, website: str) -> Optional[str]:
        """Extract domain from website URL."""
        import re
        # Remove protocol
        domain = re.sub(r'^https?://', '', website)
        # Remove www
        domain = re.sub(r'^www\.', '', domain)
        # Get domain part
        domain = domain.split('/')[0].split(':')[0]
        return domain if domain else None
    
    def _get_suggested_action(self, existing: Sponsor, current_user_id: int) -> str:
        """Get suggested action based on assignment."""
        if existing.assignee_id == current_user_id:
            return "You already own this sponsor. Continue with existing record."
        elif existing.assignee_id:
            assignee = self.db.query(TeamMember).filter(TeamMember.id == existing.assignee_id).first()
            return f"Contact {assignee.name if assignee else 'the assigned team member'} to coordinate."
        else:
            return "Sponsor is unassigned. You can take ownership."


# Convenience function for API use
def check_duplicate_sponsor(
    db_session,
    company_name: str,
    contact_email: str = None,
    contact_person: str = None,
    website: str = None,
    current_user_id: int = None
) -> DuplicateCheckResult:
    """Convenience function to check for duplicates."""
    service = DuplicatePreventionService(db_session)
    return service.check_before_outreach(company_name, contact_email, contact_person, website, current_user_id)


def check_duplicate_before_send(
    db_session,
    sponsor_id: int,
    sender_id: int
) -> DuplicateCheckResult:
    """Convenience function to check before sending."""
    service = DuplicatePreventionService(db_session)
    return service.check_before_send(sponsor_id, sender_id)