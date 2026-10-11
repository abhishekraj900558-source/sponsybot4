from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./sponsybot.db"

    # Security
    secret_key: str = "your-super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # AI Models
    gemini_api_key: Optional[str] = None

    # Research API
    tavily_api_key: Optional[str] = None

    # Contact Search
    apollo_api_key: Optional[str] = None
    hunter_api_key: Optional[str] = None

    # Email (SMTP)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None

    # Frontend URL
    frontend_url: str = "http://localhost:3000"

    # Demo Mode
    demo_mode: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()