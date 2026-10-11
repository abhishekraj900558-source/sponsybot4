# SPONSY BOT Email Sending Service
"""
SMTP-based email sending with tracking and error handling.
Supports Gmail, Outlook, and other SMTP providers.
"""
import logging
import asyncio
from typing import Optional, List, Dict, Any
from email.message import EmailMessage
from email.utils import formataddr
import aiosmtplib
from datetime import datetime

from app.config import settings
from app.models import EmailLog, EmailStatus, TeamMember

logger = logging.getLogger(__name__)


class EmailSendingService:
    """Service for sending emails via SMTP."""
    
    def __init__(self):
        self.demo_mode = settings.demo_mode
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.smtp_from = settings.smtp_from
        
        # Validate config
        if not self.demo_mode:
            if not all([self.smtp_host, self.smtp_user, self.smtp_password, self.smtp_from]):
                logger.warning("SMTP configuration incomplete. Falling back to demo mode.")
                self.demo_mode = True
    
    async def send_email(
        self,
        email_log: EmailLog,
        sender: TeamMember,
        recipient_email: str,
        recipient_name: str = None,
        attachments: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        Send an email and return result.
        
        Returns:
            Dict with keys: success (bool), message_id (str), error (str)
        """
        if self.demo_mode:
            return await self._demo_send(email_log, sender, recipient_email, recipient_name)
        
        try:
            return await self._smtp_send(email_log, sender, recipient_email, recipient_name, attachments)
        except Exception as e:
            logger.error(f"SMTP send failed: {e}")
            return {"success": False, "message_id": None, "error": str(e)}
    
    async def _smtp_send(
        self,
        email_log: EmailLog,
        sender: TeamMember,
        recipient_email: str,
        recipient_name: str = None,
        attachments: List[Dict] = None
    ) -> Dict[str, Any]:
        """Send email via SMTP."""
        
        # Create email message
        msg = EmailMessage()
        msg["From"] = formataddr((sender.name or self.smtp_from, self.smtp_from))
        msg["To"] = formataddr((recipient_name or "", recipient_email)) if recipient_name else recipient_email
        msg["Subject"] = email_log.subject
        
        # Set content
        if email_log.body_html:
            msg.set_content(email_log.body, subtype="plain")
            msg.add_alternative(email_log.body_html, subtype="html")
        else:
            msg.set_content(email_log.body, subtype="plain")
        
        # Add Message-ID for tracking
        import uuid
        msg["Message-ID"] = f"<{uuid.uuid4()}@sponsybot>"
        
        # Add attachments if any
        if attachments:
            for att in attachments:
                # attachments should have: filename, content (bytes), mimetype
                msg.add_attachment(
                    att.get("content", b""),
                    maintype=att.get("mimetype", "application").split("/")[0],
                    subtype=att.get("mimetype", "application/octet-stream").split("/")[1],
                    filename=att.get("filename", "attachment")
                )
        
        # Send via SMTP
        try:
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                start_tls=True,
                username=self.smtp_user,
                password=self.smtp_password,
            )
            
            logger.info(f"Email sent successfully to {recipient_email} (Message-ID: {msg['Message-ID']})")
            return {
                "success": True,
                "message_id": msg["Message-ID"],
                "error": None
            }
            
        except aiosmtplib.SMTPException as e:
            logger.error(f"SMTP error sending to {recipient_email}: {e}")
            return {"success": False, "message_id": None, "error": f"SMTP Error: {str(e)}"}
        except Exception as e:
            logger.error(f"Unexpected error sending to {recipient_email}: {e}")
            return {"success": False, "message_id": None, "error": str(e)}
    
    async def _demo_send(
        self,
        email_log: EmailLog,
        sender: TeamMember,
        recipient_email: str,
        recipient_name: str = None
    ) -> Dict[str, Any]:
        """Demo mode - simulate email sending."""
        
        # Simulate network delay
        await asyncio.sleep(0.5)
        
        # Simulate 95% success rate
        import random
        if random.random() < 0.95:
            message_id = f"<demo-{datetime.utcnow().timestamp()}@sponsybot.demo>"
            logger.info(f"[DEMO] Email sent to {recipient_email}: {email_log.subject}")
            return {
                "success": True,
                "message_id": message_id,
                "error": None
            }
        else:
            logger.warning(f"[DEMO] Simulated email failure to {recipient_email}")
            return {
                "success": False,
                "message_id": None,
                "error": "Simulated SMTP failure (demo mode)"
            }
    
    async def send_test_email(self, to_email: str) -> Dict[str, Any]:
        """Send a test email to verify SMTP configuration."""
        if self.demo_mode:
            return {"success": True, "message_id": "demo-test", "error": None}
        
        msg = EmailMessage()
        msg["From"] = formataddr(("SponsyBot Test", self.smtp_from))
        msg["To"] = to_email
        msg["Subject"] = "SponsyBot SMTP Test"
        msg.set_content("This is a test email from SponsyBot to verify SMTP configuration.")
        
        try:
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                start_tls=True,
                username=self.smtp_user,
                password=self.smtp_password,
            )
            return {"success": True, "message_id": msg["Message-ID"], "error": None}
        except Exception as e:
            return {"success": False, "message_id": None, "error": str(e)}


# Singleton instance
email_sending_service = EmailSendingService()