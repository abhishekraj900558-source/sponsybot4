# SPONSY BOT AI Prioritization Service
"""
AI-powered sponsor prioritization and recommendation using Gemini (free tier).
Analyzes company research to prioritize sponsors and recommend sponsorship types.
"""
import json
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from app.config import settings
from app.models import SponsorshipType

logger = logging.getLogger(__name__)


@dataclass
class PrioritizationResult:
    """Result of AI prioritization analysis."""
    priority_score: int  # 0-100
    priority_tier: str   # High, Medium, Low
    recommended_types: List[str]  # List of SponsorshipType values
    reasoning: str
    confidence: int  # 0-100


class AIPrioritizationService:
    """Service for AI-powered sponsor prioritization and recommendation."""
    
    def __init__(self):
        self.demo_mode = settings.demo_mode
        self.model = None
        
        if not self.demo_mode and settings.gemini_api_key:
            try:
                genai.configure(api_key=settings.gemini_api_key)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                # Configure safety settings
                self.safety_settings = {
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                }
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini: {e}. Falling back to demo mode.")
                self.demo_mode = True
    
    def analyze_sponsor(
        self,
        company_name: str,
        industry: Optional[str],
        company_category: Optional[str],
        research_verified: Dict,
        research_unverified: Dict,
        event_context: Optional[Dict] = None,
        institutional_memory: Optional[Dict] = None
    ) -> PrioritizationResult:
        """
        Analyze a sponsor and return prioritization + recommendation.
        
        Uses Gemini to analyze research data and provide:
        - Priority score (0-100)
        - Priority tier (High/Medium/Low)
        - Recommended sponsorship types
        - Detailed reasoning
        """
        if self.demo_mode:
            return self._demo_analysis(
                company_name, industry, company_category, 
                research_verified, research_unverified,
                event_context, institutional_memory
            )
        
        try:
            return self._gemini_analysis(
                company_name, industry, company_category,
                research_verified, research_unverified,
                event_context, institutional_memory
            )
        except Exception as e:
            logger.error(f"Gemini analysis failed for {company_name}: {e}")
            return self._demo_analysis(
                company_name, industry, company_category,
                research_verified, research_unverified,
                event_context, institutional_memory
            )
    
    def _gemini_analysis(
        self,
        company_name: str,
        industry: Optional[str],
        company_category: Optional[str],
        research_verified: Dict,
        research_unverified: Dict,
        event_context: Optional[Dict],
        institutional_memory: Optional[Dict]
    ) -> PrioritizationResult:
        """Analyze using Gemini API."""
        
        # Prepare research summary for prompt
        research_summary = self._format_research_for_prompt(research_verified, research_unverified)
        
        # Event context
        event_info = ""
        if event_context:
            event_info = f"""
Event Context:
- Event Name: {event_context.get('name', 'N/A')}
- Event Type: {event_context.get('type', 'Hackathon/Tech Event')}
- Expected Attendees: {event_context.get('expected_attendees', 'N/A')}
- Budget Target: {event_context.get('budget_target', 'N/A')}
- Sponsorship Needs: {event_context.get('sponsorship_needs', 'Cash, Swag, Cloud Credits, Infrastructure')}
"""
        
        # Institutional memory
        memory_info = ""
        if institutional_memory:
            memory_info = f"""
Historical Data (Institutional Memory):
- Previous Sponsorships: {institutional_memory.get('previous_sponsorships', 'None recorded')}
- Total Contributed: {institutional_memory.get('total_contributed', 0)}
- Preferred Types: {institutional_memory.get('preferred_sponsorship_types', 'Unknown')}
- Outcome Notes: {institutional_memory.get('outcome_notes', 'None')}
"""
        
        prompt = f"""You are a sponsorship strategy expert for a student tech club. Analyze this potential sponsor and provide a prioritization score and sponsorship recommendation.

Company: {company_name}
Industry: {industry or 'Unknown'}
Company Category/Tier: {company_category or 'Not categorized'}

{event_info}

{research_summary}

{memory_info}

Available Sponsorship Types:
- Cash Sponsorship
- Swag / Goodies
- Infrastructure
- Cloud Credits
- Software Credits
- Hardware
- Food / Refreshments
- Marketing Support
- Other

Provide your analysis in this exact JSON format:
{{
  "priority_score": <integer 0-100>,
  "priority_tier": "<High|Medium|Low>",
  "recommended_types": ["<type1>", "<type2>", ...],
  "reasoning": "<detailed reasoning explaining the score, tier, and each recommendation with evidence from research>",
  "confidence": <integer 0-100>
}}

Guidelines:
- Score 80-100 = High priority (strong alignment, history of sponsorship, relevant industry)
- Score 50-79 = Medium priority (some alignment, potential but uncertain)
- Score 0-49 = Low priority (weak alignment, no history, irrelevant industry)
- Only recommend sponsorship types that match the company's business
- For cloud companies → Cloud Credits, Infrastructure
- For hardware companies → Hardware, Swag
- For food/beverage companies → Food/Refreshments, Swag
- For software companies → Software Credits, Cloud Credits
- For all → Cash Sponsorship (if budget allows), Marketing Support
- Mark reasoning with [VERIFIED] or [UNVERIFIED] tags based on research data
- Be specific: cite research findings that support each recommendation
"""
        
        response = self.model.generate_content(
            prompt,
            safety_settings=self.safety_settings,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=2000,
                response_mime_type="application/json"
            )
        )
        
        result_json = json.loads(response.text)
        
        return PrioritizationResult(
            priority_score=result_json.get("priority_score", 50),
            priority_tier=result_json.get("priority_tier", "Medium"),
            recommended_types=result_json.get("recommended_types", ["Cash Sponsorship"]),
            reasoning=result_json.get("reasoning", "Analysis completed."),
            confidence=result_json.get("confidence", 70)
        )
    
    def _format_research_for_prompt(self, verified: Dict, unverified: Dict) -> str:
        """Format research data for the prompt."""
        parts = []
        
        if verified:
            parts.append("VERIFIED Information:")
            for key, value in verified.items():
                parts.append(f"  - {key}: {value}")
        
        if unverified:
            parts.append("\nUNVERIFIED Information (from web search, not confirmed):")
            for key, data in unverified.items():
                if isinstance(data, dict) and "value" in data:
                    parts.append(f"  - {key}: {data['value']}")
                else:
                    parts.append(f"  - {key}: {data}")
        
        return "\n".join(parts) if parts else "No research data available."
    
    def _demo_analysis(
        self,
        company_name: str,
        industry: Optional[str],
        company_category: Optional[str],
        research_verified: Dict,
        research_unverified: Dict,
        event_context: Optional[Dict],
        institutional_memory: Optional[Dict]
    ) -> PrioritizationResult:
        """Demo mode analysis with rule-based logic."""
        
        company_lower = company_name.lower()
        industry_lower = (industry or "").lower()
        
        # Base score
        score = 30
        
        # Industry boost
        high_priority_industries = ["technology", "software", "cloud", "fintech", "ai", "developer tools"]
        medium_priority_industries = ["finance", "consulting", "education", "healthcare", "retail"]
        
        if any(ind in industry_lower for ind in high_priority_industries):
            score += 30
        elif any(ind in industry_lower for ind in medium_priority_industries):
            score += 15
        
        # Company category boost
        if company_category:
            cat_lower = company_category.lower()
            if "platinum" in cat_lower or "tier 1" in cat_lower:
                score += 20
            elif "gold" in cat_lower or "tier 2" in cat_lower:
                score += 15
            elif "silver" in cat_lower or "tier 3" in cat_lower:
                score += 10
        
        # Research-based boost
        unverified_str = json.dumps(research_unverified).lower()
        
        # Check for sponsorship history indicators
        sponsorship_keywords = ["sponsor", "partnership", "community", "student", "hackathon", "developer program", "activate", "educate", "credits"]
        sponsorship_mentions = sum(1 for kw in sponsorship_keywords if kw in unverified_str)
        score += min(sponsorship_mentions * 3, 15)
        
        # Check for relevant products
        cloud_keywords = ["cloud", "aws", "azure", "gcp", "google cloud", "infrastructure"]
        if any(kw in unverified_str for kw in cloud_keywords):
            score += 10
        
        # Institutional memory boost
        if institutional_memory and institutional_memory.get("total_contributed", 0) > 0:
            score += 20
        
        # Cap score
        score = min(max(score, 0), 100)
        
        # Determine tier
        if score >= 80:
            tier = "High"
        elif score >= 50:
            tier = "Medium"
        else:
            tier = "Low"
        
        # Determine recommended types based on industry/company
        recommended = []
        
        # Cloud/Infrastructure companies
        cloud_indicators = ["cloud", "aws", "azure", "gcp", "google cloud", "infrastructure", "hosting", "server", "datacenter"]
        if any(ind in company_lower or ind in industry_lower for ind in cloud_indicators):
            recommended.extend(["Cloud Credits", "Infrastructure"])
        
        # Developer tools / Software companies
        dev_indicators = ["github", "gitlab", "jetbrains", "atlassian", "developer", "api", "sdk", "software", "saas"]
        if any(ind in company_lower or ind in industry_lower for ind in dev_indicators):
            recommended.extend(["Software Credits", "Cloud Credits"])
        
        # Hardware companies
        hardware_indicators = ["hardware", "laptop", "computer", "device", "chip", "semiconductor", "arduino", "raspberry pi", "nvidia", "amd", "intel"]
        if any(ind in company_lower or ind in industry_lower for ind in hardware_indicators):
            recommended.extend(["Hardware", "Swag / Goodies"])
        
        # Food/Beverage
        food_indicators = ["food", "beverage", "coffee", "pizza", "restaurant", "catering", "drink", "snack"]
        if any(ind in company_lower or ind in industry_lower for ind in food_indicators):
            recommended.extend(["Food / Refreshments", "Swag / Goodies"])
        
        # Finance/Fintech
        finance_indicators = ["stripe", "paypal", "square", "bank", "finance", "fintech", "payment", "capital", "venture"]
        if any(ind in company_lower or ind in industry_lower for ind in finance_indicators):
            recommended.extend(["Cash Sponsorship", "Software Credits"])
        
        # Default recommendations for any tech company
        if not recommended:
            recommended = ["Cash Sponsorship", "Swag / Goodies", "Cloud Credits"]
        
        # Deduplicate and limit
        recommended = list(dict.fromkeys(recommended))[:4]
        
        # Generate reasoning
        reasoning_parts = [
            f"[DEMO MODE] Analysis for {company_name} ({industry or 'Unknown industry'})",
            f"Priority Score: {score}/100 → {tier} Priority",
            "",
            "Reasoning:"
        ]
        
        if score >= 80:
            reasoning_parts.append("- Strong alignment with event goals and/or proven sponsorship history")
        elif score >= 50:
            reasoning_parts.append("- Moderate alignment; potential sponsor with some relevant indicators")
        else:
            reasoning_parts.append("- Lower priority; limited evidence of sponsorship fit or history")
        
        if institutional_memory and institutional_memory.get("total_contributed", 0) > 0:
            reasoning_parts.append(f"- [VERIFIED] Previous sponsor: contributed {institutional_memory['total_contributed']} in past events")
        
        if sponsorship_mentions > 0:
            reasoning_parts.append(f"- [UNVERIFIED] Found {sponsorship_mentions} indicators of community/sponsorship activity in research")
        
        reasoning_parts.append("")
        reasoning_parts.append("Recommended Sponsorship Types:")
        for r in recommended:
            reasoning_parts.append(f"- {r}: Matched based on company industry/products")
        
        reasoning_parts.append("")
        reasoning_parts.append("Note: All research data in demo mode is UNVERIFIED. Verify before outreach.")
        
        return PrioritizationResult(
            priority_score=score,
            priority_tier=tier,
            recommended_types=recommended,
            reasoning="\n".join(reasoning_parts),
            confidence=65  # Lower confidence in demo mode
        )


# Singleton instance
ai_prioritization_service = AIPrioritizationService()