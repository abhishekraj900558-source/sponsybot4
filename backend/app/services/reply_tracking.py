# SPONSY BOT Reply Tracking Service
"""
Reply tracking and classification service.
Processes incoming emails, classifies them, and suggests next actions.
"""
import logging
import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from app.config import settings
from app.models import ReplyClassification

logger = logging.getLogger(__name__)


@dataclass
class ReplyAnalysis:
    """Analysis result for a sponsor reply."""
    classification: ReplyClassification
    confidence: int  # 0-100
    summary: str
    key_points: List[str]
    suggested_action: str
    suggested_response: str
    requires_human_review: bool


class ReplyTrackingService:
    """Service for tracking and classifying sponsor replies."""
    
    def __init__(self):
        self.demo_mode = settings.demo_mode
        self.model = None
        
        if not self.demo_mode and settings.gemini_api_key:
            try:
                genai.configure(api_key=settings.gemini_api_key)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                self.safety_settings = {
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                }
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini for reply tracking: {e}. Falling back to demo mode.")
                self.demo_mode = True
    
    def analyze_reply(
        self,
        reply_body: str,
        reply_subject: str = "",
        original_email_subject: str = "",
        original_email_body: str = "",
        sponsor_context: Dict = None,
        event_context: Dict = None
    ) -> ReplyAnalysis:
        """
        Analyze a sponsor reply and classify it.
        
        Returns classification, summary, suggested action, and suggested response.
        """
        if self.demo_mode:
            return self._demo_analyze(
                reply_body, reply_subject, original_email_subject,
                original_email_body, sponsor_context, event_context
            )
        
        try:
            return self._gemini_analyze(
                reply_body, reply_subject, original_email_subject,
                original_email_body, sponsor_context, event_context
            )
        except Exception as e:
            logger.error(f"Gemini reply analysis failed: {e}")
            return self._demo_analyze(
                reply_body, reply_subject, original_email_subject,
                original_email_body, sponsor_context, event_context
            )
    
    def _gemini_analyze(
        self,
        reply_body: str,
        reply_subject: str,
        original_email_subject: str,
        original_email_body: str,
        sponsor_context: Dict,
        event_context: Dict
    ) -> ReplyAnalysis:
        """Analyze reply using Gemini."""
        
        sponsor_name = sponsor_context.get("company_name", "the sponsor") if sponsor_context else "the sponsor"
        event_name = event_context.get("name", "the event") if event_context else "the event"
        
        prompt = f"""You are analyzing a reply from a potential sponsor for a student tech event.

ORIGINAL EMAIL SENT:
Subject: {original_email_subject}
Body: {original_email_body[:1000]}

SPONSOR'S REPLY:
Subject: {reply_subject}
Body: {reply_body}

CONTEXT:
- Sponsor: {sponsor_name}
- Event: {event_name}
- Sponsor Industry: {sponsor_context.get('industry', 'Unknown') if sponsor_context else 'Unknown'}

Classify this reply into ONE of these categories:
1. INTERESTED - Sponsor shows genuine interest, asks questions, wants to proceed, requests meeting, or indicates willingness to sponsor
2. DECLINED - Sponsor explicitly says no, not interested, budget constraints, not a fit, unsubscribe
3. NO_REPLY - Auto-reply, out of office, bounce, or irrelevant/empty response

Provide analysis in JSON format:
{{
  "classification": "<INTERESTED|DECLINED|NO_REPLY>",
  "confidence": <0-100>,
  "summary": "<2-3 sentence summary of the reply>",
  "key_points": ["<point1>", "<point2>", ...],
  "suggested_action": "<what the organizer should do next>",
  "suggested_response": "<draft response the organizer can send, or empty if no response needed>",
  "requires_human_review": <true/false>
}}

Guidelines:
- INTERESTED: "We'd love to discuss", "interested in partnering", "tell me more", "what are the options", "can we schedule a call", "send me details", "we have budget"
- DECLINED: "not interested", "no budget", "not a fit", "unsubscribe", "remove me", "not at this time", "cannot sponsor"
- NO_REPLY: "out of office", "auto-reply", "delivery failure", empty/very short with no substance
- Ambiguous replies (e.g., "thanks for reaching out") → NO_REPLY with low confidence, requires_human_review=true
- Confidence: 90+ for clear cases, 50-70 for ambiguous
- requires_human_review: true if classification is uncertain or reply needs nuanced handling
"""
        
        response = self.model.generate_content(
            prompt,
            safety_settings=self.safety_settings,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=2000,
                response_mime_type="application/json"
            )
        )
        
        result_json = json.loads(response.text)
        
        classification_str = result_json.get("classification", "NO_REPLY")
        try:
            classification = ReplyClassification(classification_str)
        except ValueError:
            classification = ReplyClassification.NO_REPLY
        
        return ReplyAnalysis(
            classification=classification,
            confidence=result_json.get("confidence", 50),
            summary=result_json.get("summary", "Reply received."),
            key_points=result_json.get("key_points", []),
            suggested_action=result_json.get("suggested_action", "Review manually."),
            suggested_response=result_json.get("suggested_response", ""),
            requires_human_review=result_json.get("requires_human_review", True)
        )
    
    def _demo_analyze(
        self,
        reply_body: str,
        reply_subject: str,
        original_email_subject: str,
        original_email_body: str,
        sponsor_context: Dict,
        event_context: Dict
    ) -> ReplyAnalysis:
        """Demo mode reply analysis using keyword matching."""
        
        body_lower = reply_body.lower()
        subject_lower = reply_subject.lower()
        combined = f"{subject_lower} {body_lower}"
        
        # Auto-reply / bounce detection
        auto_reply_indicators = [
            "out of office", "automatic reply", "auto-reply", "vacation",
            "away from my desk", "out of the office", "delivery status notification",
            "undelivered", "bounce", "mail delivery failed", "returned mail"
        ]
        
        if any(ind in combined for ind in auto_reply_indicators):
            return ReplyAnalysis(
                classification=ReplyClassification.NO_REPLY,
                confidence=95,
                summary="Automatic reply (out of office or bounce) received.",
                key_points=["Auto-reply detected"],
                suggested_action="No action needed. Wait for human reply or schedule follow-up.",
                suggested_response="",
                requires_human_review=False
            )
        
        # Interested indicators
        interested_keywords = [
            "interested", "would love to", "like to discuss", "tell me more",
            "schedule a call", "set up a meeting", "hop on a call", "next steps",
            "send me details", "more information", "proposal", "partnership",
            "collaborate", "sponsor", "support", "budget", "approve",
            "looks great", "sounds good", "excited", "keen", "on board",
            "move forward", "proceed", "availability", "calendly", "calendar"
        ]
        
        interested_score = sum(2 for kw in interested_keywords if kw in combined)
        
        # Strong interest phrases (higher weight)
        strong_interest = [
            "we would like to sponsor", "we'd like to sponsor", "we want to sponsor",
            "happy to sponsor", "can sponsor", "will sponsor", "approved",
            "let's do this", "let's partner", "count us in"
        ]
        interested_score += sum(5 for kw in strong_interest if kw in combined)
        
        # Declined indicators
        declined_keywords = [
            "not interested", "no interest", "not a fit", "not a good fit",
            "no budget", "budget constraints", "cannot sponsor", "can't sponsor",
            "unable to sponsor", "won't be able", "not at this time",
            "not right now", "maybe next time", "not currently",
            "unsubscribe", "remove me", "stop emailing", "opt out",
            "no thank you", "no thanks", "pass", "declined"
        ]
        
        declined_score = sum(2 for kw in declined_keywords if kw in combined)
        
        # Strong decline phrases
        strong_decline = [
            "we don't sponsor", "we do not sponsor", "no sponsorship",
            "not in our budget", "policy against", "company policy"
        ]
        declined_score += sum(5 for kw in strong_decline if kw in combined)
        
        # Determine classification
        if interested_score > declined_score and interested_score >= 3:
            classification = ReplyClassification.INTERESTED
            confidence = min(60 + interested_score * 3, 90)
            summary = f"Sponsor expressed interest in partnering. Key phrases detected: {[kw for kw in interested_keywords if kw in combined][:3]}"
            suggested_action = "Schedule a meeting to discuss sponsorship details. Send interested response email."
            suggested_response = "Thank you for your interest! I'd love to schedule a brief call to discuss how we can tailor a sponsorship package for your goals. Here's my Calendly link: [link]."
            requires_review = confidence < 80
            
        elif declined_score > interested_score and declined_score >= 3:
            classification = ReplyClassification.DECLINED
            confidence = min(60 + declined_score * 3, 90)
            summary = f"Sponsor declined or indicated no interest. Key phrases: {[kw for kw in declined_keywords if kw in combined][:3]}"
            suggested_action = "Mark sponsor as Declined. Stop all follow-ups. Thank them for their time."
            suggested_response = "Thank you for your response and for considering our event. I completely understand. If priorities change in the future, we'd love to reconnect. Best of luck!"
            requires_review = confidence < 80
            
        else:
            # Ambiguous or no clear signal
            classification = ReplyClassification.NO_REPLY
            confidence = 40
            summary = "Reply received but intent is unclear. May be a polite acknowledgment or require human review."
            suggested_action = "Review reply manually. Determine if follow-up is appropriate."
            suggested_response = ""
            requires_review = True
        
        # Extract key points (simple sentence extraction)
        sentences = [s.strip() for s in reply_body.split('.') if len(s.strip()) > 10]
        key_points = sentences[:3]
        
        return ReplyAnalysis(
            classification=classification,
            confidence=confidence,
            summary=summary,
            key_points=key_points,
            suggested_action=suggested_action,
            suggested_response=suggested_response,
            requires_human_review=requires_review
        )
    
    def extract_reply_from_raw(
        self,
        raw_email: Dict,
        original_message_id: str = None
    ) -> Optional[Dict]:
        """
        Extract reply content from raw email data (e.g., from webhook or IMAP).
        
        Expected raw_email keys: from, subject, body_text, body_html, message_id, in_reply_to, date
        """
        # This would integrate with email webhook (SendGrid, Mailgun) or IMAP polling
        # For now, return structured data if valid reply
        
        in_reply_to = raw_email.get("in_reply_to", "")
        if original_message_id and original_message_id not in in_reply_to:
            # Not a reply to our email
            return None
        
        return {
            "from_email": raw_email.get("from", ""),
            "subject": raw_email.get("subject", ""),
            "body": raw_email.get("body_text", ""),
            "body_html": raw_email.get("body_html", ""),
            "message_id": raw_email.get("message_id", ""),
            "received_at": raw_email.get("date", datetime.utcnow()),
        }


# Singleton instance
reply_tracking_service = ReplyTrackingService()