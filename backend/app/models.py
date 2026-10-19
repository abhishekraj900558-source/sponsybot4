import re
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Enum, ForeignKey, 
    Boolean, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship, declarative_base, validates
from sqlalchemy.sql import func

Base = declarative_base()


def normalize_company_name(name: Optional[str]) -> str:
    """Normalize company name to canonical lowercase alphanumerics for DB unique constraint and concurrency safety."""
    if not name:
        return ""
    s = name.lower().strip()
    s = re.sub(r'\b(inc|incorporated|corp|corporation|llc|ltd|limited|co|company|group)\b\.?', '', s)
    cleaned = re.sub(r'[^a-z0-9]', '', s)
    return cleaned if cleaned else re.sub(r'[^a-z0-9]', '', name.lower())


class SponsorStatus(str, PyEnum):
    NOT_CONTACTED = "Not Contacted"
    CONTACTED = "Contacted"
    FOLLOW_UP = "Follow-up"
    INTERESTED = "Interested"
    DECLINED = "Declined"
    CLOSED = "Closed"


class EmailStatus(str, PyEnum):
    DRAFT = "Draft"
    PENDING_APPROVAL = "Pending Approval"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    SENT = "Sent"
    FAILED = "Failed"


class ReplyClassification(str, PyEnum):
    INTERESTED = "Interested"
    NO_REPLY = "No Reply"
    DECLINED = "Declined"


class SponsorshipType(str, PyEnum):
    CASH = "Cash Sponsorship"
    SWAG = "Swag / Goodies"
    INFRASTRUCTURE = "Infrastructure"
    CLOUD_CREDITS = "Cloud Credits"
    SOFTWARE_CREDITS = "Software Credits"
    HARDWARE = "Hardware"
    FOOD = "Food / Refreshments"
    MARKETING = "Marketing Support"
    OTHER = "Other"


class MeetingStatus(str, PyEnum):
    REQUESTED = "Meeting Requested"
    SCHEDULED = "Meeting Scheduled"
    COMPLETED = "Meeting Completed"
    CANCELLED = "Meeting Cancelled"


class TeamMember(Base):
    __tablename__ = "team_members"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    assigned_sponsors = relationship("Sponsor", back_populates="assignee")
    sent_emails = relationship("EmailLog", back_populates="sender", foreign_keys="EmailLog.sender_id")


class Sponsor(Base):
    __tablename__ = "sponsors"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    normalized_company_name = Column(String(255), nullable=True, index=True)
    company_category = Column(String(100), nullable=True)  # Tier: Platinum, Gold, Silver, etc.
    industry = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    size = Column(String(50), nullable=True)  # e.g., "1-10", "11-50", "51-200", etc.
    
    # Contact Info
    contact_person = Column(String(100), nullable=True)
    contact_email = Column(String(255), nullable=True, index=True)
    contact_role = Column(String(100), nullable=True)
    contact_linkedin = Column(String(500), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    
    # Status & Assignment
    status = Column(Enum(SponsorStatus), default=SponsorStatus.NOT_CONTACTED, nullable=False, index=True)
    assignee_id = Column(Integer, ForeignKey("team_members.id"), nullable=True, index=True)
    
    # Research Information (JSON for flexibility)
    research_data = Column(JSON, nullable=True)  # Verified research
    research_unverified = Column(JSON, nullable=True)  # Unverified research marked as UNVERIFIED
    research_last_updated = Column(DateTime(timezone=True), nullable=True)
    research_source = Column(String(100), nullable=True)  # Tavily, Apollo, Manual, etc.
    
    # AI Prioritization & Recommendation
    priority_score = Column(Integer, default=0, nullable=False)  # 0-100
    priority_tier = Column(String(20), nullable=True)  # High, Medium, Low
    recommended_sponsorship_types = Column(JSON, nullable=True)  # List of SponsorshipType
    recommendation_reasoning = Column(Text, nullable=True)
    
    # Follow-up tracking
    follow_up_count = Column(Integer, default=0, nullable=False)
    last_contacted_at = Column(DateTime(timezone=True), nullable=True)
    next_follow_up_at = Column(DateTime(timezone=True), nullable=True)
    
    # Interested workflow
    meeting_status = Column(Enum(MeetingStatus), nullable=True)
    meeting_scheduled_at = Column(DateTime(timezone=True), nullable=True)
    meeting_notes = Column(Text, nullable=True)
    
    # Results
    sponsorship_won = Column(Boolean, default=False, nullable=False)
    sponsorship_amount = Column(Integer, nullable=True)  # In smallest currency unit (e.g., paise/cents)
    sponsorship_benefits = Column(JSON, nullable=True)  # Non-cash benefits secured
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    assignee = relationship("TeamMember", back_populates="assigned_sponsors")
    emails = relationship("EmailLog", back_populates="sponsor", cascade="all, delete-orphan")
    replies = relationship("ReplyLog", back_populates="sponsor", cascade="all, delete-orphan")
    follow_ups = relationship("FollowUpSchedule", back_populates="sponsor", cascade="all, delete-orphan")
    meetings = relationship("Meeting", back_populates="sponsor", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_sponsors_company_email', 'company_name', 'contact_email'),
        UniqueConstraint('normalized_company_name', name='uq_sponsor_normalized_company_name'),
        UniqueConstraint('company_name', 'contact_email', name='uq_sponsor_company_contact'),
    )

    def __init__(self, **kwargs):
        if "company_name" in kwargs and not kwargs.get("normalized_company_name"):
            kwargs["normalized_company_name"] = normalize_company_name(kwargs["company_name"])
        super().__init__(**kwargs)

    @validates("company_name")
    def _validate_company_name(self, key, value):
        if value:
            self.normalized_company_name = normalize_company_name(value)
        return value


class EmailLog(Base):
    __tablename__ = "email_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    sponsor_id = Column(Integer, ForeignKey("sponsors.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("team_members.id"), nullable=False, index=True)
    
    # Email content
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    body_html = Column(Text, nullable=True)
    
    # Status & Type
    status = Column(Enum(EmailStatus), default=EmailStatus.DRAFT, nullable=False, index=True)
    email_type = Column(String(50), nullable=False)  # initial, follow_up_1, follow_up_2, meeting_request, etc.
    follow_up_number = Column(Integer, default=0, nullable=False)  # 0 = initial, 1 = first follow-up, 2 = second
    
    # Approval workflow
    approved_by = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_by = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Sending
    sent_at = Column(DateTime(timezone=True), nullable=True)
    message_id = Column(String(255), nullable=True)  # SMTP Message-ID
    error_message = Column(Text, nullable=True)
    
    # Attachments
    attachments = Column(JSON, nullable=True)  # List of attachment info
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sponsor = relationship("Sponsor", back_populates="emails")
    sender = relationship("TeamMember", back_populates="sent_emails", foreign_keys=[sender_id])
    approver = relationship("TeamMember", foreign_keys=[approved_by])
    rejecter = relationship("TeamMember", foreign_keys=[rejected_by])
    reply = relationship("ReplyLog", back_populates="email", uselist=False, cascade="all, delete-orphan")


class ReplyLog(Base):
    __tablename__ = "reply_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    sponsor_id = Column(Integer, ForeignKey("sponsors.id"), nullable=False, index=True)
    email_id = Column(Integer, ForeignKey("email_logs.id"), nullable=False, unique=True, index=True)
    
    # Reply content
    from_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False, index=True)
    message_id = Column(String(255), nullable=True)  # In-Reply-To or Message-ID
    
    # Classification
    classification = Column(Enum(ReplyClassification), nullable=True, index=True)
    classification_confidence = Column(Integer, nullable=True)  # 0-100
    summary = Column(Text, nullable=True)
    suggested_action = Column(Text, nullable=True)
    suggested_response = Column(Text, nullable=True)
    
    # Processing
    processed_at = Column(DateTime(timezone=True), nullable=True)
    processed_by = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    sponsor = relationship("Sponsor", back_populates="replies")
    email = relationship("EmailLog", back_populates="reply")
    processor = relationship("TeamMember", foreign_keys=[processed_by])


class FollowUpSchedule(Base):
    __tablename__ = "follow_up_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    sponsor_id = Column(Integer, ForeignKey("sponsors.id"), nullable=False, index=True)
    email_id = Column(Integer, ForeignKey("email_logs.id"), nullable=True)  # The follow-up email once created
    
    follow_up_number = Column(Integer, nullable=False)  # 1 or 2
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(50), default="pending", nullable=False)  # pending, created, sent, cancelled
    
    # Auto-generated draft
    draft_subject = Column(String(500), nullable=True)
    draft_body = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sponsor = relationship("Sponsor", back_populates="follow_ups")


class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(Integer, primary_key=True, index=True)
    sponsor_id = Column(Integer, ForeignKey("sponsors.id"), nullable=False, index=True)
    team_member_id = Column(Integer, ForeignKey("team_members.id"), nullable=False, index=True)
    
    # Meeting details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes = Column(Integer, default=30, nullable=False)
    location = Column(String(500), nullable=True)  # Physical address or video call link
    meeting_link = Column(String(500), nullable=True)  # Google Meet, Zoom, Calendly, etc.
    
    # Status
    status = Column(Enum(MeetingStatus), default=MeetingStatus.REQUESTED, nullable=False, index=True)
    
    # Calendar integration
    calendar_event_id = Column(String(255), nullable=True)
    calendar_link = Column(String(500), nullable=True)
    
    # Notes & Outcome
    notes = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sponsor = relationship("Sponsor", back_populates="meetings")
    team_member = relationship("TeamMember")


class EmailTemplate(Base):
    __tablename__ = "email_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    email_type = Column(String(50), nullable=False, index=True)  # initial, follow_up_1, follow_up_2, etc.
    
    subject_template = Column(String(500), nullable=False)
    body_template = Column(Text, nullable=False)
    body_html_template = Column(Text, nullable=True)
    
    # Variables that can be used in templates (JSON schema)
    variables = Column(JSON, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(500), nullable=True)
    expected_attendees = Column(Integer, nullable=True)
    budget_target = Column(Integer, nullable=True)  # In smallest currency unit
    
    # Sponsorship tiers for this event
    sponsorship_tiers = Column(JSON, nullable=True)  # Custom tiers per event
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InstitutionalMemory(Base):
    __tablename__ = "institutional_memory"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    
    # Historical data
    previous_sponsorships = Column(JSON, nullable=True)  # List of past sponsorships
    total_contributed = Column(Integer, default=0, nullable=False)  # Total cash amount
    preferred_sponsorship_types = Column(JSON, nullable=True)  # What they usually sponsor
    contact_history = Column(JSON, nullable=True)  # Key contacts over time
    preferences = Column(Text, nullable=True)  # Known preferences, constraints
    last_event = Column(String(255), nullable=True)
    last_contact_year = Column(Integer, nullable=True)
    outcome_notes = Column(Text, nullable=True)
    
    # Source
    source = Column(String(100), nullable=True)  # Manual entry, imported, etc.
    verified = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('company_name', name='uq_institutional_memory_company'),
    )


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    team_member_id = Column(Integer, ForeignKey("team_members.id"), nullable=False, index=True)
    sponsor_id = Column(Integer, ForeignKey("sponsors.id"), nullable=True, index=True)
    
    type = Column(String(50), nullable=False, index=True)  # reply_received, interested, follow_up_due, meeting_requested, sponsorship_won
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Action link
    action_url = Column(String(500), nullable=True)
    action_label = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    team_member = relationship("TeamMember")
    sponsor = relationship("Sponsor")


# Pydantic models for API (separate file typically, but keeping here for now)
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TeamMemberBase(BaseModel):
    name: str
    email: EmailStr
    role: Optional[str] = None


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class TeamMemberResponse(TeamMemberBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class SponsorBase(BaseModel):
    company_name: str
    company_category: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    size: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_role: Optional[str] = None
    contact_linkedin: Optional[str] = None
    contact_phone: Optional[str] = None
    assignee_id: Optional[int] = None
    notes: Optional[str] = None


class SponsorCreate(SponsorBase):
    pass


class SponsorUpdate(BaseModel):
    company_name: Optional[str] = None
    company_category: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    size: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_role: Optional[str] = None
    contact_linkedin: Optional[str] = None
    contact_phone: Optional[str] = None
    status: Optional[SponsorStatus] = None
    assignee_id: Optional[int] = None
    priority_score: Optional[int] = None
    priority_tier: Optional[str] = None
    recommended_sponsorship_types: Optional[List[str]] = None
    recommendation_reasoning: Optional[str] = None
    meeting_status: Optional[MeetingStatus] = None
    meeting_scheduled_at: Optional[datetime] = None
    meeting_notes: Optional[str] = None
    sponsorship_won: Optional[bool] = None
    sponsorship_amount: Optional[int] = None
    sponsorship_benefits: Optional[List[Dict]] = None
    notes: Optional[str] = None


class SponsorResponse(SponsorBase):
    id: int
    status: SponsorStatus
    priority_score: int
    priority_tier: Optional[str]
    recommended_sponsorship_types: Optional[List[str]]
    recommendation_reasoning: Optional[str]
    follow_up_count: int
    last_contacted_at: Optional[datetime]
    next_follow_up_at: Optional[datetime]
    meeting_status: Optional[MeetingStatus]
    meeting_scheduled_at: Optional[datetime]
    meeting_notes: Optional[str]
    sponsorship_won: bool
    sponsorship_amount: Optional[int]
    sponsorship_benefits: Optional[List[Dict]]
    research_data: Optional[Dict]
    research_unverified: Optional[Dict]
    research_last_updated: Optional[datetime]
    research_source: Optional[str]
    created_at: datetime
    updated_at: datetime
    assignee: Optional[TeamMemberResponse] = None
    
    class Config:
        from_attributes = True


class SponsorListResponse(BaseModel):
    sponsors: List[SponsorResponse]
    total: int
    page: int
    page_size: int


class EmailLogBase(BaseModel):
    sponsor_id: int
    subject: str
    body: str
    body_html: Optional[str] = None
    email_type: str
    follow_up_number: int = 0
    attachments: Optional[List[Dict]] = None


class EmailLogCreate(EmailLogBase):
    sender_id: int


class EmailLogUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    body_html: Optional[str] = None
    status: Optional[EmailStatus] = None


class EmailLogResponse(EmailLogBase):
    id: int
    sender_id: int
    status: EmailStatus
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    rejected_by: Optional[int]
    rejected_at: Optional[datetime]
    rejection_reason: Optional[str]
    sent_at: Optional[datetime]
    message_id: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    sender: Optional[TeamMemberResponse] = None
    sponsor: Optional[SponsorResponse] = None
    
    class Config:
        from_attributes = True


class ReplyLogResponse(BaseModel):
    id: int
    sponsor_id: int
    email_id: int
    from_email: str
    subject: Optional[str]
    body: Optional[str]
    received_at: datetime
    classification: Optional[ReplyClassification]
    classification_confidence: Optional[int]
    summary: Optional[str]
    suggested_action: Optional[str]
    suggested_response: Optional[str]
    processed_at: Optional[datetime]
    processed_by: Optional[int]
    
    class Config:
        from_attributes = True


class FollowUpScheduleResponse(BaseModel):
    id: int
    sponsor_id: int
    email_id: Optional[int] = None
    follow_up_number: int
    scheduled_at: datetime
    status: str
    draft_subject: Optional[str]
    draft_body: Optional[str]
    
    class Config:
        from_attributes = True


class MeetingResponse(BaseModel):
    id: int
    sponsor_id: int
    team_member_id: int
    title: str
    description: Optional[str]
    scheduled_at: datetime
    duration_minutes: int
    location: Optional[str]
    meeting_link: Optional[str]
    status: MeetingStatus
    calendar_event_id: Optional[str]
    calendar_link: Optional[str]
    notes: Optional[str]
    outcome: Optional[str]
    created_at: datetime
    sponsor: Optional[SponsorResponse] = None
    team_member: Optional[TeamMemberResponse] = None
    
    class Config:
        from_attributes = True


class MeetingCreate(BaseModel):
    sponsor_id: int
    team_member_id: int
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int = 30
    location: Optional[str] = None
    meeting_link: Optional[str] = None


class EmailTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    email_type: str
    subject_template: str
    body_template: str
    body_html_template: Optional[str]
    variables: Optional[Dict]
    is_active: bool
    is_default: bool
    
    class Config:
        from_attributes = True


class EventResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    start_date: datetime
    end_date: datetime
    location: Optional[str]
    expected_attendees: Optional[int]
    budget_target: Optional[int]
    sponsorship_tiers: Optional[Dict]
    is_active: bool
    
    class Config:
        from_attributes = True


class InstitutionalMemoryResponse(BaseModel):
    id: int
    company_name: str
    previous_sponsorships: Optional[List[Dict]]
    total_contributed: int
    preferred_sponsorship_types: Optional[List[str]]
    contact_history: Optional[List[Dict]]
    preferences: Optional[str]
    last_event: Optional[str]
    last_contact_year: Optional[int]
    outcome_notes: Optional[str]
    source: Optional[str]
    verified: bool
    
    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    team_member_id: int
    sponsor_id: Optional[int]
    type: str
    title: str
    message: str
    is_read: bool
    read_at: Optional[datetime]
    action_url: Optional[str]
    action_label: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DashboardStatsResponse(BaseModel):
    total_sponsors: int
    by_status: Dict[str, int]
    response_rate: float
    follow_up_rate: float
    money_secured: int
    benefits_secured: int
    meetings_scheduled: int
    sponsorships_won: int
    recent_activity: List[Dict]