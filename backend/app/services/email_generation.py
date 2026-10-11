# SPONSY BOT Email Generation Service
"""
AI-powered personalized email generation using Gemini (free tier).
Generates company-specific sponsorship emails based on research and recommendations.
"""
import json
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from app.config import settings
from app.models import SponsorshipType, EmailTemplate

logger = logging.getLogger(__name__)


@dataclass
class EmailDraft:
    """Generated email draft."""
    subject: str
    body: str
    body_html: Optional[str]
    variables_used: Dict[str, str]


class EmailGenerationService:
    """Service for generating personalized sponsorship emails."""
    
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
                logger.warning(f"Failed to initialize Gemini for email generation: {e}. Falling back to demo mode.")
                self.demo_mode = True
    
    def generate_email(
        self,
        email_type: str,
        sponsor_data: Dict,
        event_data: Dict,
        sender_data: Dict,
        recommended_types: List[str],
        reasoning: str,
        research_verified: Dict,
        research_unverified: Dict,
        previous_emails: List[Dict] = None,
        reply_context: Dict = None,
        template: Optional[EmailTemplate] = None
    ) -> EmailDraft:
        """
        Generate a personalized sponsorship email.
        
        Args:
            email_type: 'initial', 'follow_up_1', 'follow_up_2', 'meeting_request', 'thank_you', 'interested_response'
            sponsor_data: Dict with company_name, contact_person, contact_role, industry, etc.
            event_data: Dict with event name, description, dates, attendance, etc.
            sender_data: Dict with sender name, role, club name, etc.
            recommended_types: List of recommended sponsorship types
            reasoning: AI reasoning for recommendations
            research_verified: Verified research data
            research_unverified: Unverified research data
            previous_emails: List of previous email exchanges
            reply_context: Context from sponsor's reply (for response emails)
            template: Optional email template to use as base
        """
        if self.demo_mode:
            return self._demo_generate(
                email_type, sponsor_data, event_data, sender_data,
                recommended_types, reasoning, research_verified, research_unverified,
                previous_emails, reply_context, template
            )
        
        try:
            return self._gemini_generate(
                email_type, sponsor_data, event_data, sender_data,
                recommended_types, reasoning, research_verified, research_unverified,
                previous_emails, reply_context, template
            )
        except Exception as e:
            logger.error(f"Gemini email generation failed: {e}")
            return self._demo_generate(
                email_type, sponsor_data, event_data, sender_data,
                recommended_types, reasoning, research_verified, research_unverified,
                previous_emails, reply_context, template
            )
    
    def _gemini_generate(
        self,
        email_type: str,
        sponsor_data: Dict,
        event_data: Dict,
        sender_data: Dict,
        recommended_types: List[str],
        reasoning: str,
        research_verified: Dict,
        research_unverified: Dict,
        previous_emails: List[Dict] = None,
        reply_context: Dict = None,
        template: Optional[EmailTemplate] = None
    ) -> EmailDraft:
        """Generate email using Gemini API."""
        
        # Format research for prompt
        research_summary = self._format_research(research_verified, research_unverified)
        
        # Previous emails context
        prev_context = ""
        if previous_emails:
            prev_context = "\nPrevious Email History:\n"
            for i, email in enumerate(previous_emails[-3:], 1):  # Last 3 emails
                prev_context += f"  Email {i} ({email['email_type']}): Subject: {email['subject']}\n"
                prev_context += f"    Sent: {email.get('sent_at', 'N/A')}\n"
        
        # Reply context
        reply_info = ""
        if reply_context:
            reply_info = f"""
Sponsor's Reply Context:
- Classification: {reply_context.get('classification', 'Unknown')}
- Summary: {reply_context.get('summary', 'N/A')}
- Sponsor's Key Points: {reply_context.get('key_points', 'N/A')}
"""
        
        # Template guidance
        template_guidance = ""
        if template:
            template_guidance = f"""
Use this template as a base (adapt but keep structure):
Subject Template: {template.subject_template}
Body Template: {template.body_template}
Available Variables: {template.variables}
"""
        
        # Email type specific instructions
        type_instructions = {
            "initial": "Write a FIRST OUTREACH email. Introduce the club, the event, and make a specific ask based on recommended types. Be concise, professional, and personalized.",
            "follow_up_1": "Write a FIRST FOLLOW-UP email (sent ~5-7 days after initial). Reference the previous email, add value (new info, deadline reminder), and restate the ask gently.",
            "follow_up_2": "Write a SECOND (FINAL) FOLLOW-UP email (sent ~5-7 days after follow-up 1). This is the last attempt. Be respectful, acknowledge they may be busy, leave door open for future.",
            "meeting_request": "Write a MEETING REQUEST email for an interested sponsor. Propose specific meeting times/formats, outline agenda, and confirm next steps.",
            "thank_you": "Write a THANK YOU email after sponsorship is confirmed. Express gratitude, confirm details, provide next steps.",
            "interested_response": "Write a RESPONSE to a sponsor who showed interest. Acknowledge their interest, answer any questions, propose next steps (meeting/call)."
        }
        
        prompt = f"""You are a sponsorship outreach expert writing personalized emails for a student tech club.

{type_instructions.get(email_type, "Write a professional sponsorship email.")}

SENDER INFO:
- Name: {sender_data.get('name', 'Club Organizer')}
- Role: {sender_data.get('role', 'Sponsorship Lead')}
- Club: {sender_data.get('club_name', 'Student Tech Club')}
- Club Description: {sender_data.get('club_description', 'A student-run technology club')}

EVENT INFO:
- Name: {event_data.get('name', 'Tech Event')}
- Description: {event_data.get('description', 'A student technology event')}
- Date: {event_data.get('date', 'TBD')}
- Expected Attendees: {event_data.get('expected_attendees', '100+')}
- Location: {event_data.get('location', 'TBD')}

SPONSOR INFO:
- Company: {sponsor_data.get('company_name', 'Company')}
- Contact Person: {sponsor_data.get('contact_person', 'Decision Maker')}
- Contact Role: {sponsor_data.get('contact_role', 'Relevant Decision Maker')}
- Industry: {sponsor_data.get('industry', 'Technology')}
- Company Category: {sponsor_data.get('company_category', 'Not specified')}

RESEARCH & RECOMMENDATIONS:
{research_summary}

RECOMMENDED SPONSORSHIP TYPES: {', '.join(recommended_types)}
AI REASONING: {reasoning}

{prev_context}
{reply_info}
{template_guidance}

REQUIREMENTS:
1. PERSONALIZE: Reference specific company details (products, initiatives, history)
2. BE SPECIFIC: Ask for specific sponsorship types, not generic "support"
3. SHOW RESEARCH: Mention 1-2 specific things you know about them
4. PROFESSIONAL TONE: Respectful, concise, clear value proposition
5. CLEAR ASK: Specific request with suggested amounts/options
6. EASY NEXT STEP: Clear call-to-action (reply, call, meeting link)
7. NO FABRICATION: Only use verified info or mark as "based on public information"
8. SUBJECT LINE: Compelling, personalized, under 60 characters

OUTPUT FORMAT (JSON):
{{
  "subject": "<subject line>",
  "body": "<plain text email body>",
  "body_html": "<HTML version with basic formatting>",
  "variables_used": {{"variable_name": "value_used"}}
}}

Generate the email now.
"""
        
        response = self.model.generate_content(
            prompt,
            safety_settings=self.safety_settings,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                max_output_tokens=3000,
                response_mime_type="application/json"
            )
        )
        
        result_json = json.loads(response.text)
        
        return EmailDraft(
            subject=result_json.get("subject", "Sponsorship Opportunity"),
            body=result_json.get("body", ""),
            body_html=result_json.get("body_html"),
            variables_used=result_json.get("variables_used", {})
        )
    
    def _format_research(self, verified: Dict, unverified: Dict) -> str:
        """Format research for prompt."""
        parts = []
        
        if verified:
            parts.append("VERIFIED Research:")
            for key, value in verified.items():
                if value:
                    parts.append(f"  ✓ {key}: {value}")
        
        if unverified:
            parts.append("\nUNVERIFIED Research (from web search - use carefully):")
            for key, data in unverified.items():
                if isinstance(data, dict) and "value" in data:
                    val = data["value"]
                    if val and str(val).lower() not in ["unknown", "none", "n/a", ""]:
                        parts.append(f"  ~ {key}: {val}")
                elif data:
                    parts.append(f"  ~ {key}: {data}")
        
        return "\n".join(parts) if parts else "No research data available."
    
    def _demo_generate(
        self,
        email_type: str,
        sponsor_data: Dict,
        event_data: Dict,
        sender_data: Dict,
        recommended_types: List[str],
        reasoning: str,
        research_verified: Dict,
        research_unverified: Dict,
        previous_emails: List[Dict] = None,
        reply_context: Dict = None,
        template: Optional[EmailTemplate] = None
    ) -> EmailDraft:
        """Demo mode email generation with templates."""
        
        company_name = sponsor_data.get('company_name', 'Your Company')
        contact_person = sponsor_data.get('contact_person', 'Decision Maker')
        contact_role = sponsor_data.get('contact_role', '')
        sender_name = sender_data.get('name', 'Club Organizer')
        club_name = sender_data.get('club_name', 'Student Tech Club')
        event_name = event_data.get('name', 'Our Tech Event')
        event_date = event_data.get('date', 'Upcoming')
        event_attendees = event_data.get('expected_attendees', '100+')
        
        # Build sponsorship ask
        ask_lines = []
        for stype in recommended_types[:3]:
            if stype == "Cash Sponsorship":
                ask_lines.append("• Cash sponsorship (flexible tiers available)")
            elif stype == "Cloud Credits":
                ask_lines.append("• Cloud infrastructure credits for our event infrastructure and participant projects")
            elif stype == "Software Credits":
                ask_lines.append("• Software licenses/credits for participant use during the event")
            elif stype == "Hardware":
                ask_lines.append("• Hardware devices for prizes or event infrastructure")
            elif stype == "Swag / Goodies":
                ask_lines.append("• Branded swag/goodies for participant welcome kits (stickers, t-shirts, etc.)")
            elif stype == "Food / Refreshments":
                ask_lines.append("• Food/refreshments for participants during the event")
            elif stype == "Infrastructure":
                ask_lines.append("• Infrastructure support (venue, networking, AV equipment)")
            elif stype == "Marketing Support":
                ask_lines.append("• Marketing/promotional support for the event")
            else:
                ask_lines.append(f"• {stype}")
        
        sponsorship_ask = "\n".join(ask_lines)
        
        # Research highlights
        research_highlights = []
        for key, data in research_unverified.items():
            if isinstance(data, dict) and "value" in data:
                val = data["value"]
                if val and str(val).lower() not in ["unknown", "none", "n/a", ""] and len(str(val)) > 10:
                    research_highlights.append(f"{key}: {str(val)[:150]}")
        
        research_note = ""
        if research_highlights:
            research_note = f"\nI noticed {company_name}'s work in {research_highlights[0].lower()}. "
            if len(research_highlights) > 1:
                research_note += f"Also, {research_highlights[1].lower()}. "
        
        # Email type specific content
        if email_type == "initial":
            subject = f"Sponsorship Opportunity: {event_name} × {company_name}"
            body = f"""Hi {contact_person},

I'm {sender_name}, {sender_data.get('role', 'Sponsorship Lead')} at {club_name}. We're organizing {event_name} on {event_date}, expecting {event_attendees}+ student developers, designers, and tech enthusiasts.{research_note}

Given {company_name}'s focus on {sponsor_data.get('industry', 'technology')}, we believe there's a strong alignment with our event's mission. We'd love to explore a partnership where you can engage with top student talent.

We're looking for partners to support:
{sponsorship_ask}

In return, we offer brand visibility to 100+ students, speaking opportunities, direct access to talent, and recognition across our channels.

Would you be open to a brief 15-minute call to discuss? I'm flexible with timing and can work around your schedule.

Best regards,
{sender_name}
{sender_data.get('role', 'Sponsorship Lead')} | {club_name}
{sender_data.get('email', 'contact@club.org')}
{club_name} Website | LinkedIn
"""
        
        elif email_type == "follow_up_1":
            prev_subject = previous_emails[-1]['subject'] if previous_emails else "our previous email"
            subject = f"Following up: {event_name} sponsorship opportunity"
            body = f"""Hi {contact_person},

Following up on my previous email about {event_name} ({event_date}). I know you're busy, so I'll keep this brief.

We're finalizing our sponsorship lineup this week and {company_name} would be an ideal partner given your work in {sponsor_data.get('industry', 'technology')}.{research_note}

We have flexible options ranging from cloud credits to swag to cash sponsorship - happy to tailor a package that fits your goals and budget.

Even a quick "not right now" helps us plan. But if there's interest, I'd love to hop on a 10-minute call this week.

Best,
{sender_name}
{club_name}
"""
        
        elif email_type == "follow_up_2":
            subject = f"Final follow-up: {event_name} partnership"
            body = f"""Hi {contact_person},

This will be my last note on {event_name} - I want to respect your time.

We're locking in sponsors by [deadline] and I'd hate for {company_name} to miss out on connecting with {event_attendees}+ student developers. If the timing isn't right, no worries at all - happy to reach out for future events.

If there's someone else on your team who handles sponsorships/community, I'd appreciate a forward.

Either way, thank you for considering it. I admire {company_name}'s work and would love to collaborate someday.

All the best,
{sender_name}
{club_name}
"""
        
        elif email_type == "meeting_request":
            subject = f"Meeting request: {event_name} partnership with {company_name}"
            body = f"""Hi {contact_person},

Thank you for your interest in partnering with {event_name}! I'm excited about the potential to work together.

As discussed, I'd like to schedule a 30-minute call to:
1. Walk through sponsorship options tailored for {company_name}
2. Discuss your goals (brand awareness, talent pipeline, community engagement)
3. Finalize details and next steps

Available slots this week:
• [Option 1: Day, Date at Time UTC]
• [Option 2: Day, Date at Time UTC]
• [Option 3: Day, Date at Time UTC]

Or share your Calendly/availability and I'll book accordingly.

Looking forward to it!

Best,
{sender_name}
{club_name}
"""
        
        elif email_type == "thank_you":
            subject = f"Thank you for sponsoring {event_name}! 🎉"
            body = f"""Hi {contact_person},

On behalf of the entire {club_name} team - thank you for sponsoring {event_name}!

Your support of [specific sponsorship details] will directly impact {event_attendees}+ students and make this event possible. We're thrilled to have {company_name} as a partner.

Next steps:
• We'll send the sponsorship agreement and logistics details by [date]
• Your brand assets (logo, guidelines) can be sent to this email
• We'll schedule a brief sync to align on deliverables

We'll keep you updated as the event approaches. Please don't hesitate to reach out with any questions.

With gratitude,
{sender_name}
{club_name}
"""
        
        elif email_type == "interested_response":
            subject = f"Re: {event_name} partnership - Next steps"
            body = f"""Hi {contact_person},

Thanks for the positive response! Excited that {company_name} is interested in {event_name}.

{reply_context.get('summary', 'Great to hear you\'re interested in exploring a partnership.')}

As next steps, I'd love to schedule a brief call to:
1. Discuss which sponsorship option best fits your goals
2. Answer any questions you have
3. Outline the timeline and deliverables

Available for a 20-minute call:
• [Option 1]
• [Option 2] 
• [Option 3]

Or feel free to share your Calendly link.

Looking forward to making this happen!

Best,
{sender_name}
{club_name}
"""
        
        else:
            subject = f"Sponsorship Inquiry: {event_name}"
            body = f"Hi {contact_person},\n\nI'm reaching out about {event_name}...\n\nBest,\n{sender_name}"
        
        # Simple HTML version
        body_html = body.replace('\n', '<br>').replace('• ', '<li>').replace('\n\n', '</p><p>')
        body_html = f"<p>{body_html}</p>"
        body_html = body_html.replace('<li>', '<ul><li>').replace('</p><p><ul>', '</p><ul>').replace('</li></p>', '</li></ul></p>')
        
        return EmailDraft(
            subject=subject,
            body=body,
            body_html=body_html,
            variables_used={
                "company_name": company_name,
                "contact_person": contact_person,
                "event_name": event_name,
                "sender_name": sender_name,
                "club_name": club_name,
            }
        )


# Singleton instance
email_generation_service = EmailGenerationService()