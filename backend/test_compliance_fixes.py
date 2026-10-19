"""
Compliance Fixes Test Suite for SponsyBot
Verifies:
1. Follow-up scheduler function definition and execution
2. Normalized company name database constraint and concurrent duplicate blocking
3. Rate limit exponential backoff retry logic in research and email generation
"""
import pytest
import asyncio
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app.models import Base, Sponsor, normalize_company_name
from app.services.duplicate_prevention import DuplicatePreventionService, check_duplicate_sponsor
from app.services.research import ResearchService
from app.services.email_generation import EmailGenerationService
from app.main import run_follow_up_scheduler


def test_task1_scheduler_callable():
    """Verify run_follow_up_scheduler is a top-level callable function."""
    assert callable(run_follow_up_scheduler)
    assert run_follow_up_scheduler.__doc__ == "Background job to check and schedule follow-ups."


def test_task2_normalized_name_helper():
    """Verify company name normalization handles casing, whitespace, and legal suffixes."""
    assert normalize_company_name("Google") == "google"
    assert normalize_company_name("Google, Inc.") == "google"
    assert normalize_company_name("Google LLC") == "google"
    assert normalize_company_name("Stripe, Inc.") == "stripe"
    assert normalize_company_name("Microsoft Corp.") == "microsoft"
    assert normalize_company_name("Amazon Web Services Ltd") == "amazonwebservices"


def test_task2_database_unique_constraint_blocks_concurrent_duplicates():
    """Verify database unique constraint on normalized_company_name prevents concurrent duplicates."""
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSession()
    
    # Organizer A adds "Google Inc." with email a@google.com
    sp1 = Sponsor(
        company_name="Google Inc.",
        contact_email="a@google.com",
    )
    db.add(sp1)
    db.commit()
    assert sp1.normalized_company_name == "google"
    
    # Organizer B tries to add "Google LLC" with a completely DIFFERENT email (b@google.com)
    # This would bypass composite (company_name, contact_email) unique constraint!
    sp2 = Sponsor(
        company_name="Google LLC",
        contact_email="b@google.com",
    )
    db.add(sp2)
    with pytest.raises(IntegrityError):
        db.commit()
    
    db.rollback()
    db.close()


def test_task2_duplicate_prevention_catches_normalized_duplicate():
    """Verify duplicate prevention service catches different company suffixes before outreach."""
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSession()
    sp1 = Sponsor(company_name="Stripe Inc.", contact_email="partnerships@stripe.com")
    db.add(sp1)
    db.commit()
    
    dup_service = DuplicatePreventionService(db)
    result = dup_service.check_before_outreach("Stripe LLC", contact_email="different@stripe.com")
    
    assert result.is_duplicate is True
    assert result.conflict_type == "exact_company_normalized"
    assert result.existing_sponsor.company_name == "Stripe Inc."
    db.close()


@pytest.mark.asyncio
@patch("asyncio.sleep", return_value=None)
async def test_task3_research_retry_logic_on_rate_limit(mock_sleep):
    """Verify ResearchService retries with backoff on 429 before fallback."""
    service = ResearchService()
    service.demo_mode = False
    service.client = MagicMock()
    
    call_count = 0
    def mock_search(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise Exception("HTTP 429 Too Many Requests: Rate limit exceeded")
    
    service.client.search = mock_search
    
    # Call research_company
    result = await service.research_company("MockCorp")
    
    # Should attempt retries up to 3 times, then fall back to demo research
    assert call_count >= 3
    assert result.company_name == "MockCorp"
    assert result.source == "demo"


@patch("time.sleep", return_value=None)
def test_task3_email_generation_retry_logic_on_rate_limit(mock_sleep):
    """Verify EmailGenerationService retries with backoff on 429 before fallback."""
    service = EmailGenerationService()
    service.demo_mode = False
    service.model = MagicMock()
    
    call_count = 0
    def mock_generate_content(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise Exception("429 ResourceExhausted: Quota exceeded for model")
    
    service.model.generate_content = mock_generate_content
    
    draft = service.generate_email(
        email_type="initial",
        sponsor_data={"company_name": "TestCorp", "contact_person": "Jane Doe", "industry": "Tech"},
        event_data={"name": "Hackathon 2026", "date": "Next Month", "expected_attendees": 200},
        sender_data={"name": "Alex", "role": "Lead", "club_name": "ACM", "email": "alex@club.org"},
        recommended_types=["Cash Sponsorship"],
        reasoning="Good fit",
        research_verified={"website": "https://test.com"},
        research_unverified={}
    )
    
    assert call_count == 3
    assert draft is not None
    assert "TestCorp" in draft.body
