# SPONSY BOT Database Configuration
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator

from app.config import settings
from app.models import Base


# Create engine
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    echo=False,  # Set to True for SQL debugging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Initialize database tables and ensure schema constraints."""
    Base.metadata.create_all(bind=engine)
    
    # Check if normalized_company_name exists in sponsors table (SQLite migration & index)
    with engine.connect() as conn:
        try:
            result = conn.exec_driver_sql("PRAGMA table_info(sponsors)")
            cols = [row[1] for row in result.fetchall()]
            if cols and "normalized_company_name" not in cols:
                conn.exec_driver_sql("ALTER TABLE sponsors ADD COLUMN normalized_company_name VARCHAR(255)")
                conn.commit()
            
            # Backfill any null normalized_company_name
            from app.models import normalize_company_name
            rows = conn.exec_driver_sql("SELECT id, company_name FROM sponsors WHERE normalized_company_name IS NULL OR normalized_company_name = ''").fetchall()
            for r_id, r_name in rows:
                norm = normalize_company_name(r_name)
                conn.exec_driver_sql("UPDATE sponsors SET normalized_company_name = ? WHERE id = ?", (norm, r_id))
            conn.commit()
            
            # Ensure unique index exists on normalized_company_name
            conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS uq_sponsor_normalized_company_name ON sponsors(normalized_company_name)")
            conn.commit()
        except Exception:
            pass


def get_db() -> Generator[Session, None, None]:
    """Dependency for FastAPI to get DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for DB session outside of FastAPI."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def drop_db() -> None:
    """Drop all tables (for testing)."""
    Base.metadata.drop_all(bind=engine)