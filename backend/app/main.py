# SPONSY BOT Main Application
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
import threading

from app.config import settings
from app.database import init_db, get_db
from app.api.routes import router as api_router

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()


def create_default_templates(db):
    """Create default email templates if they don't exist."""
    from app.models import EmailTemplate

    templates = [
        {
            "name": "Initial Outreach - Default",
            "email_type": "initial",
            "subject_template": "Sponsorship Opportunity: {event_name} \u00d7 {company_name}",
            "body_template": """Hi {contact_person},

I'm {sender_name}, {sender_role} at {club_name}. We're organizing {event_name} on {event_date}, expecting {expected_attendees}+ student developers, designers, and tech enthusiasts.

Given {company_name}'s focus on {industry}, we believe there's a strong alignment with our event's mission. We'd love to explore a partnership where you can engage with top student talent.

We're looking for partners to support:
{sponsorship_ask}

In return, we offer brand visibility to {expected_attendees}+ students, speaking opportunities, direct access to talent, and recognition across our channels.

Would you be open to a brief 15-minute call to discuss? I'm flexible with timing and can work around your schedule.

Best regards,
{sender_name}
{sender_role} | {club_name}
{sender_email}""",
            "variables": {
                "contact_person": "Contact person name",
                "sender_name": "Sender name",
                "sender_role": "Sender role",
                "club_name": "Club name",
                "event_name": "Event name",
                "event_date": "Event date",
                "expected_attendees": "Number of attendees",
                "company_name": "Company name",
                "industry": "Company industry",
                "sponsorship_ask": "Formatted sponsorship request",
                "sender_email": "Sender email"
            },
            "is_default": True
        },
        {
            "name": "Follow-up 1 - Default",
            "email_type": "follow_up_1",
            "subject_template": "Following up: {event_name} sponsorship opportunity",
            "body_template": """Hi {contact_person},

Following up on my previous email about {event_name} ({event_date}). I know you're busy, so I'll keep this brief.

We're finalizing our sponsorship lineup this week and {company_name} would be an ideal partner given your work in {industry}.

We have flexible options ranging from cloud credits to swag to cash sponsorship - happy to tailor a package that fits your goals and budget.

Even a quick "not right now" helps us plan. But if there's interest, I'd love to hop on a 10-minute call this week.

Best,
{sender_name}
{club_name}""",
            "variables": {
                "contact_person": "Contact person name",
                "event_name": "Event name",
                "event_date": "Event date",
                "company_name": "Company name",
                "industry": "Company industry",
                "sender_name": "Sender name",
                "club_name": "Club name"
            },
            "is_default": True
        },
        {
            "name": "Follow-up 2 (Final) - Default",
            "email_type": "follow_up_2",
            "subject_template": "Final follow-up: {event_name} partnership",
            "body_template": """Hi {contact_person},

This will be my last note on {event_name} - I want to respect your time.

We're locking in sponsors by [deadline] and I'd hate for {company_name} to miss out on connecting with {expected_attendees}+ student developers. If the timing isn't right, no worries at all - happy to reach out for future events.

If there's someone else on your team who handles sponsorships/community, I'd appreciate a forward.

Either way, thank you for considering it. I admire {company_name}'s work and would love to collaborate someday.

All the best,
{sender_name}
{club_name}""",
            "variables": {
                "contact_person": "Contact person name",
                "event_name": "Event name",
                "company_name": "Company name",
                "expected_attendees": "Number of attendees",
                "sender_name": "Sender name",
                "club_name": "Club name"
            },
            "is_default": True
        },
        {
            "name": "Meeting Request - Default",
            "email_type": "meeting_request",
            "subject_template": "Meeting request: {event_name} partnership with {company_name}",
            "body_template": """Hi {contact_person},

Thank you for your interest in partnering with {event_name}! I'm excited about the potential to work together.

As discussed, I'd like to schedule a 30-minute call to:
1. Walk through sponsorship options tailored for {company_name}
2. Discuss your goals (brand awareness, talent pipeline, community engagement)
3. Finalize details and next steps

Available slots this week:
\u2022 [Option 1: Day, Date at Time UTC]
\u2022 [Option 2: Day, Date at Time UTC]
\u2022 [Option 3: Day, Date at Time UTC]

Or share your Calendly/availability and I'll book accordingly.

Looking forward to it!

Best,
{sender_name}
{club_name}""",
            "variables": {
                "contact_person": "Contact person name",
                "event_name": "Event name",
                "company_name": "Company name",
                "sender_name": "Sender name",
                "club_name": "Club name"
            },
            "is_default": True
        },
        {
            "name": "Thank You - Default",
            "email_type": "thank_you",
            "subject_template": "Thank you for sponsoring {event_name}! ",
            "body_template": """Hi {contact_person},

On behalf of the entire {club_name} team - thank you for sponsoring {event_name}!

Your support of {sponsorship_details} will directly impact {expected_attendees}+ students and make this event possible. We're thrilled to have {company_name} as a partner.

Next steps:
\u2022 We'll send the sponsorship agreement and logistics details by [date]
\u2022 Your brand assets (logo, guidelines) can be sent to this email
\u2022 We'll schedule a brief sync to align on deliverables

We'll keep you updated as the event approaches. Please don't hesitate to reach out with any questions.

With gratitude,
{sender_name}
{club_name}""",
            "variables": {
                "contact_person": "Contact person name",
                "club_name": "Club name",
                "event_name": "Event name",
                "sponsorship_details": "Sponsorship details",
                "expected_attendees": "Number of attendees",
                "company_name": "Company name",
                "sender_name": "Sender name"
            },
            "is_default": True
        },
        {
            "name": "Interested Response - Default",
            "email_type": "interested_response",
            "subject_template": "Re: {event_name} partnership - Next steps",
            "body_template": """Hi {contact_person},

Thanks for the positive response! Excited that {company_name} is interested in {event_name}.

{reply_summary}

As next steps, I'd love to schedule a brief call to:
1. Discuss which sponsorship option best fits your goals
2. Answer any questions you have
3. Outline the timeline and deliverables

Available for a 20-minute call:
\u2022 [Option 1]
\u2022 [Option 2] 
\u2022 [Option 3]

Or feel free to share your Calendly link.

Looking forward to making this happen!

Best,
{sender_name}
{club_name}""",
            "variables": {
                "contact_person": "Contact person name",
                "company_name": "Company name",
                "event_name": "Event name",
                "reply_summary": "Summary of sponsor's reply",
                "sender_name": "Sender name",
                "club_name": "Club name"
            },
            "is_default": True
        }
    ]

    for t in templates:
        existing = db.query(EmailTemplate).filter(
            EmailTemplate.name == t["name"]
        ).first()
        if not existing:
            template = EmailTemplate(**t)
            db.add(template)

    db.commit()


def create_default_team_members(db):
    """Create default team members if they don't exist."""
    from app.models import TeamMember

    members = [
        {"name": "John Doe", "email": "john@club.org", "role": "Sponsorship Lead", "is_active": True},
        {"name": "Jane Smith", "email": "jane@club.org", "role": "Team Member", "is_active": True},
    ]
    for m in members:
        existing = db.query(TeamMember).filter(TeamMember.email == m["email"]).first()
        if not existing:
            member = TeamMember(**m)
            db.add(member)
    db.commit()


def create_default_events(db):
    """Create default event if none exist."""
    from app.models import Event
    from datetime import datetime, timedelta

    existing = db.query(Event).first()
    if not existing:
        event = Event(
            name="HackTech 2026",
            description="Premier Student Hackathon with 500+ attendees focusing on AI and Cloud innovations.",
            start_date=datetime.utcnow() + timedelta(days=30),
            end_date=datetime.utcnow() + timedelta(days=32),
            location="University Main Auditorium",
            expected_attendees=500,
            budget_target=2500000,
            sponsorship_tiers={
                "Platinum": {"amount": 10000, "benefits": ["Keynote speech", "Booth at entrance", "Resume book", "Branding on t-shirts"]},
                "Gold": {"amount": 5000, "benefits": ["Workshop slot", "Booth", "Branding on website"]},
                "Silver": {"amount": 2500, "benefits": ["Mentorship table", "Branding on banners"]}
            },
            is_active=True
        )
        db.add(event)
        db.commit()


def create_default_sponsors(db):
    """Create sample sponsors if none exist."""
    from app.models import Sponsor, SponsorStatus, TeamMember

    count = db.query(Sponsor).count()
    if count == 0:
        john = db.query(TeamMember).filter(TeamMember.email == "john@club.org").first()
        jane = db.query(TeamMember).filter(TeamMember.email == "jane@club.org").first()
        john_id = john.id if john else None
        jane_id = jane.id if jane else None

        sample_sponsors = [
            {
                "company_name": "Google",
                "company_category": "Tier 1 - Tech Giant",
                "industry": "Technology / Cloud",
                "website": "https://google.com",
                "contact_person": "Sundar Pichai",
                "contact_email": "partnerships@google.com",
                "contact_role": "Director of University Relations",
                "status": SponsorStatus.NOT_CONTACTED,
                "assignee_id": john_id,
            },
            {
                "company_name": "Microsoft",
                "company_category": "Tier 1 - Tech Giant",
                "industry": "Cloud / Software",
                "website": "https://microsoft.com",
                "contact_person": "Satya Nadella",
                "contact_email": "sponsorships@microsoft.com",
                "contact_role": "Community Partnerships Lead",
                "status": SponsorStatus.NOT_CONTACTED,
                "assignee_id": john_id,
            },
            {
                "company_name": "AWS",
                "company_category": "Cloud Infrastructure",
                "industry": "Cloud Infrastructure",
                "website": "https://aws.amazon.com",
                "contact_person": "Andy Jassy",
                "contact_email": "community@amazon.com",
                "contact_role": "Developer Advocacy Lead",
                "status": SponsorStatus.NOT_CONTACTED,
                "assignee_id": jane_id,
            },
            {
                "company_name": "Stripe",
                "company_category": "Fintech",
                "industry": "Fintech / Payments",
                "website": "https://stripe.com",
                "contact_person": "Patrick Collison",
                "contact_email": "devrel@stripe.com",
                "contact_role": "Head of DevRel",
                "status": SponsorStatus.NOT_CONTACTED,
                "assignee_id": jane_id,
            },
            {
                "company_name": "GitHub",
                "company_category": "Developer Tools",
                "industry": "Developer Tools",
                "website": "https://github.com",
                "contact_person": "Thomas Dohmke",
                "contact_email": "education@github.com",
                "contact_role": "GitHub Education Program Lead",
                "status": SponsorStatus.NOT_CONTACTED,
                "assignee_id": john_id,
            },
        ]
        for s in sample_sponsors:
            db.add(Sponsor(**s))
        db.commit()

    """Background job to check and schedule follow-ups."""
    from app.database import SessionLocal
    from app.services.follow_up import FollowUpService
    from app.services.email_generation import email_generation_service
    from app.models import TeamMember, Sponsor, SponsorStatus, EmailStatus, Event
    from datetime import datetime

    db = SessionLocal()
    try:
        followup_service = FollowUpService(db)
        actions = followup_service.check_and_schedule_follow_ups()

        for action in actions:
            sponsor = db.query(Sponsor).filter(Sponsor.id == action.sponsor_id).first()
            if not sponsor:
                continue

            sender = db.query(TeamMember).filter(TeamMember.id == sponsor.assignee_id).first()
            if not sender:
                # Find any active team member as fallback
                sender = db.query(TeamMember).filter(TeamMember.is_active == True).first()

            if not sender:
                logger.warning(f"No sender available for follow-up for sponsor {sponsor.company_name}")
                continue

            # Get active event for context
            event = db.query(Event).filter(Event.is_active == True).first()
            event_data = {
                "name": event.name if event else "Tech Event",
                "description": event.description if event else "A student technology event",
                "date": event.start_date.strftime("%B %d, %Y") if event and event.start_date else "Upcoming",
                "expected_attendees": event.expected_attendees if event else 100,
                "location": event.location if event else "TBD"
            }

            sender_data = {
                "name": sender.name,
                "role": sender.role,
                "club_name": "Student Tech Club",
                "email": sender.email
            }

            # Generate follow-up draft
            draft = email_generation_service.generate_email(
                email_type=f"follow_up_{action.follow_up_number}",
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
                previous_emails=[{
                    "email_type": e.email_type,
                    "subject": e.subject,
                    "sent_at": e.sent_at.isoformat() if e.sent_at else None
                } for e in db.query(EmailLog).filter(
                    EmailLog.sponsor_id == sponsor.id,
                    EmailLog.status == EmailStatus.SENT
                ).order_by(EmailLog.sent_at).all()]
            )

            # Create follow-up schedule with draft
            followup = followup_service.create_follow_up_schedule(
                action.sponsor_id, action.follow_up_number, action.scheduled_at,
                draft.subject, draft.body, draft.body_html
            )

            # Create email log as DRAFT (requires approval)
            from app.models import EmailLog
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

            # Update sponsor
            sponsor.follow_up_count = action.follow_up_number
            sponsor.status = SponsorStatus.FOLLOW_UP
            sponsor.next_follow_up_at = action.scheduled_at

            # Create notification for assignee
            from app.services.notification import NotificationService
            notification_service = NotificationService(db)
            notification_service.notify_follow_up_due(sponsor)

            logger.info(f"Created follow-up #{action.follow_up_number} draft for {sponsor.company_name}")

        db.commit()
    except Exception as e:
        logger.error(f"Follow-up scheduler error: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
def run_follow_up_scheduler(*a, **k): pass
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    init_db()

    # Create default email templates, team members, events, and sample sponsors
    db = next(get_db())
    try:
        create_default_templates(db)
        create_default_team_members(db)
        create_default_events(db)
        create_default_sponsors(db)
    finally:
        db.close()

    # Start scheduler for follow-ups (runs every hour)
    scheduler.add_job(
        run_follow_up_scheduler,
        trigger=IntervalTrigger(hours=1),
        id='follow_up_scheduler',
        name='Check and schedule follow-ups',
        replace_existing=True
    )
    scheduler.start()
    logger.info("Follow-up scheduler started")

    yield

    # Shutdown
    scheduler.shutdown()
    logger.info("Follow-up scheduler stopped")


app = FastAPI(
    title="SponsyBot API",
    description="Sponsorship Outreach Automation for Student Clubs",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "SponsyBot API",
        "version": "1.0.0",
        "description": "Sponsorship Outreach Automation",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "demo_mode": settings.demo_mode}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)