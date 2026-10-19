# SPONSY BOT Research Service
"""
Company research using Tavily API (free tier) with fallback to demo mode.
All unverified information is clearly marked.
"""
import json
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime

import httpx
from tavily import TavilyClient

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ResearchResult:
    """Structured research result with verification status."""
    company_name: str
    verified: Dict[str, Any]
    unverified: Dict[str, Any]
    sources: List[str]
    researched_at: datetime
    source: str  # "tavily", "manual", "demo"


class ResearchService:
    """Service for researching companies using Tavily API."""
    
    def __init__(self):
        self.demo_mode = settings.demo_mode
        self.client = None
        
        if not self.demo_mode and settings.tavily_api_key:
            try:
                self.client = TavilyClient(api_key=settings.tavily_api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize Tavily client: {e}. Falling back to demo mode.")
                self.demo_mode = True
    
    async def research_company(
        self, 
        company_name: str, 
        website: Optional[str] = None,
        industry: Optional[str] = None
    ) -> ResearchResult:
        """
        Research a company and return verified/unverified information.
        
        Uses Tavily API for web search, then structures the results.
        All information from web search is marked as UNVERIFIED unless
        it comes from official company sources.
        Includes exponential backoff retry for HTTP 429 / rate limits.
        """
        if self.demo_mode:
            return self._demo_research(company_name, website, industry)
        
        import asyncio
        max_retries = 3
        base_delay = 2.0
        for attempt in range(max_retries):
            try:
                return await self._tavily_research(company_name, website, industry)
            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = any(term in err_msg for term in ["429", "rate limit", "quota", "too many requests"])
                if is_rate_limit and attempt < max_retries - 1:
                    wait_time = base_delay * (2 ** attempt)
                    logger.warning(
                        f"Tavily API rate limit (429) for '{company_name}' (attempt {attempt+1}/{max_retries}). "
                        f"Retrying in {wait_time}s..."
                    )
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Tavily research failed for {company_name} after {attempt+1} attempts: {e}. Falling back to demo mode.")
                    return self._demo_research(company_name, website, industry)
    
    async def _tavily_research(
        self, 
        company_name: str, 
        website: Optional[str] = None,
        industry: Optional[str] = None
    ) -> ResearchResult:
        """Research using Tavily API with retry on 429 rate limits."""
        
        # Build search queries
        queries = [
            f"{company_name} company profile overview",
            f"{company_name} sponsorship history partnerships",
            f"{company_name} community initiatives student programs",
            f"{company_name} CSR corporate social responsibility",
        ]
        
        if website:
            queries.append(f"site:{website} sponsorship partners")
        
        all_results = []
        sources = []
        import asyncio
        max_retries = 3
        base_delay = 2.0
        
        for query in queries:
            response = None
            for attempt in range(max_retries):
                try:
                    response = self.client.search(
                        query=query,
                        search_depth="basic",
                        max_results=5,
                        include_domains=None,
                        exclude_domains=None
                    )
                    break
                except Exception as e:
                    err_msg = str(e).lower()
                    is_rate_limit = any(term in err_msg for term in ["429", "rate limit", "quota", "too many requests"])
                    if is_rate_limit and attempt < max_retries - 1:
                        wait_time = base_delay * (2 ** attempt)
                        logger.warning(
                            f"Tavily query rate limit (429) for '{query}' (attempt {attempt+1}/{max_retries}). "
                            f"Retrying in {wait_time}s..."
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        logger.warning(f"Query failed: {query} - {e}")
                        break
            
            if response:
                for result in response.get("results", []):
                    all_results.append({
                        "query": query,
                        "title": result.get("title", ""),
                        "content": result.get("content", ""),
                        "url": result.get("url", ""),
                        "score": result.get("score", 0)
                    })
                    sources.append(result.get("url", ""))
        
        if not all_results and queries:
            raise Exception("Tavily search yielded zero results due to rate limits or connection errors")
        
        # Structure the results
        verified = {}
        unverified = {}
        
        # Extract structured information from search results
        structured = self._extract_structured_info(company_name, all_results)
        
        # Mark everything from web search as UNVERIFIED
        for key, value in structured.items():
            if value:
                unverified[key] = {
                    "value": value,
                    "note": "UNVERIFIED - Sourced from web search, not officially confirmed"
                }
        
        # Official website info could be considered more reliable
        if website:
            verified["website"] = website
            unverified["website_note"] = {
                "value": website,
                "note": "UNVERIFIED - Provided by user, not independently verified"
            }
        
        return ResearchResult(
            company_name=company_name,
            verified=verified,
            unverified=unverified,
            sources=list(set(sources)),
            researched_at=datetime.utcnow(),
            source="tavily"
        )
    
    def _extract_structured_info(self, company_name: str, results: List[Dict]) -> Dict[str, Any]:
        """Extract structured information from search results using keyword matching."""
        
        # Combine all content
        all_content = " ".join([r.get("content", "") for r in results]).lower()
        company_lower = company_name.lower()
        
        structured = {
            "company_profile": None,
            "industry": None,
            "products_services": None,
            "previous_sponsorships": None,
            "past_events_supported": None,
            "relevant_partnerships": None,
            "community_initiatives": None,
            "student_initiatives": None,
            "sponsorship_opportunities": None,
            "size": None,
            "headquarters": None,
            "founded_year": None,
        }
        
        # Simple keyword-based extraction (in production, use LLM for this)
        # This is a basic implementation - a real system would use an LLM
        
        # Industry detection
        industry_keywords = {
            "technology": ["software", "tech", "technology", "saas", "cloud", "ai", "artificial intelligence"],
            "finance": ["bank", "finance", "fintech", "investment", "capital", "financial services"],
            "healthcare": ["health", "medical", "pharma", "biotech", "healthcare", "clinical"],
            "education": ["education", "edtech", "learning", "university", "academy", "training"],
            "retail": ["retail", "ecommerce", "e-commerce", "consumer", "brand"],
            "manufacturing": ["manufacturing", "industrial", "factory", "production"],
            "consulting": ["consulting", "advisory", "professional services"],
        }
        
        for industry, keywords in industry_keywords.items():
            if any(kw in all_content for kw in keywords):
                structured["industry"] = industry.title()
                break
        
        # Size detection
        size_keywords = {
            "1-10": ["startup", "small team", "early stage"],
            "11-50": ["small business", "growing team", "50 employees"],
            "51-200": ["mid-size", "medium enterprise", "200 employees"],
            "201-500": ["large team", "500 employees"],
            "501-1000": ["1000 employees", "large company"],
            "1000+": ["enterprise", "fortune 500", "global company", "multinational"],
        }
        
        for size, keywords in size_keywords.items():
            if any(kw in all_content for kw in keywords):
                structured["size"] = size
                break
        
        # Sponsorship history
        sponsorship_indicators = [
            "sponsor", "sponsorship", "partnered with", "supported", "funded",
            "grant", "donation", "community program", "developer program",
            "student program", "hackathon", "university partnership"
        ]
        
        sponsorship_mentions = []
        for result in results:
            content = result.get("content", "").lower()
            if any(indicator in content for indicator in sponsorship_indicators):
                # Extract relevant sentences
                sentences = content.split(".")
                for sent in sentences:
                    if any(indicator in sent for indicator in sponsorship_indicators):
                        sponsorship_mentions.append(sent.strip()[:200])
        
        if sponsorship_mentions:
            structured["previous_sponsorships"] = sponsorship_mentions[:5]
            structured["sponsorship_opportunities"] = "Company has history of sponsorships/community support"
        
        # Community/Student initiatives
        community_keywords = [
            "community", "student", "university", "education", "STEM", "STEAM",
            "developer", "open source", "hackathon", "coding", "tech education"
        ]
        
        community_mentions = []
        for result in results:
            content = result.get("content", "").lower()
            if any(kw in content for kw in community_keywords):
                sentences = content.split(".")
                for sent in sentences:
                    if any(kw in sent for kw in community_keywords):
                        community_mentions.append(sent.strip()[:200])
        
        if community_mentions:
            structured["community_initiatives"] = community_mentions[:5]
            structured["student_initiatives"] = "Company appears to support student/tech communities"
        
        # Company profile (first substantial result)
        for result in results:
            content = result.get("content", "")
            if len(content) > 100 and company_lower in content.lower():
                structured["company_profile"] = content[:500]
                break
        
        return structured
    
    def _demo_research(
        self, 
        company_name: str, 
        website: Optional[str] = None,
        industry: Optional[str] = None
    ) -> ResearchResult:
        """Demo mode research with realistic mock data."""
        
        # Demo data for known companies
        demo_data = {
            "google": {
                "company_profile": "Google LLC is a multinational technology company specializing in Internet-related services and products, including online advertising technologies, search engine, cloud computing, software, and hardware.",
                "industry": "Technology",
                "products_services": "Search, Advertising, Cloud Platform (GCP), Android, YouTube, Hardware",
                "previous_sponsorships": [
                    "Google Developer Student Clubs (DSC) program globally",
                    "Google Cloud credits for student hackathons",
                    "Women Techmakers sponsorship program",
                    "TensorFlow community events sponsorship"
                ],
                "past_events_supported": "Numerous hackathons, developer conferences, student tech events globally",
                "relevant_partnerships": "Universities worldwide, UNESCO, various non-profits",
                "community_initiatives": "Google Developer Groups, Women Techmakers, Google Developer Student Clubs",
                "student_initiatives": "Strong focus on student developer communities through DSC program",
                "sponsorship_opportunities": "Cloud credits, swag, speaker sessions, mentorship, API access",
                "size": "1000+",
                "headquarters": "Mountain View, California, USA",
                "founded_year": "1998"
            },
            "microsoft": {
                "company_profile": "Microsoft Corporation is a multinational technology corporation producing computer software, consumer electronics, personal computers, and related services.",
                "industry": "Technology",
                "products_services": "Windows, Office 365, Azure Cloud, Visual Studio, GitHub, LinkedIn, Xbox",
                "previous_sponsorships": [
                    "Microsoft Learn Student Ambassadors program",
                    "Azure credits for student projects and hackathons",
                    "Imagine Cup global student competition",
                    "GitHub Education pack for students"
                ],
                "past_events_supported": "Microsoft Build, Imagine Cup, numerous university hackathons globally",
                "relevant_partnerships": "Universities globally, GitHub Education, LinkedIn Learning",
                "community_initiatives": "Microsoft Learn, Student Ambassadors, AI for Good",
                "student_initiatives": "Extensive student developer programs through Microsoft Learn",
                "sponsorship_opportunities": "Azure credits, GitHub swag, Microsoft Surface devices, mentorship",
                "size": "1000+",
                "headquarters": "Redmond, Washington, USA",
                "founded_year": "1975"
            },
            "aws": {
                "company_profile": "Amazon Web Services (AWS) is a comprehensive cloud computing platform provided by Amazon.com.",
                "industry": "Technology",
                "products_services": "Cloud computing (EC2, S3, Lambda, RDS), AI/ML services, IoT, Developer tools",
                "previous_sponsorships": [
                    "AWS Activate program for startups and students",
                    "AWS Cloud credits for hackathons and student projects",
                    "AWS Educate program for cloud education",
                    "Community Builder program"
                ],
                "past_events_supported": "AWS re:Invent, numerous cloud hackathons, university cloud programs",
                "relevant_partnerships": "Universities, EdX, Coursera, various educational platforms",
                "community_initiatives": "AWS User Groups, Community Builders, AWS Educate",
                "student_initiatives": "AWS Academy, AWS Educate, Cloud credits for students",
                "sponsorship_opportunities": "AWS Activate credits ($1000-$5000), swag, training credits, speaker sessions",
                "size": "1000+",
                "headquarters": "Seattle, Washington, USA",
                "founded_year": "2006"
            },
            "stripe": {
                "company_profile": "Stripe is a financial services and software as a service (SaaS) company offering payment processing software and APIs for e-commerce websites and mobile applications.",
                "industry": "Finance/FinTech",
                "products_services": "Payment processing, Billing, Connect, Atlas, Radar, Sigma, Climate",
                "previous_sponsorships": [
                    "Stripe Atlas for student founders",
                    "Hackathon sponsorships with payment processing credits",
                    "Open source sponsorships"
                ],
                "past_events_supported": "Numerous fintech hackathons, student entrepreneur events",
                "relevant_partnerships": "Y Combinator, various accelerators, universities",
                "community_initiatives": "Stripe Sessions, Open source fund, Climate commitment",
                "student_initiatives": "Stripe Atlas for student entrepreneurs, startup programs",
                "sponsorship_opportunities": "Payment processing credits, Stripe Atlas access, swag, mentorship",
                "size": "1000+",
                "headquarters": "San Francisco, California, USA",
                "founded_year": "2010"
            },
            "github": {
                "company_profile": "GitHub is a platform for version control and collaboration, allowing developers to work together on projects.",
                "industry": "Technology",
                "products_services": "Git hosting, Actions (CI/CD), Codespaces, Copilot, Security, Enterprise",
                "previous_sponsorships": [
                    "GitHub Education Pack (free Pro for students)",
                    "Campus Experts program",
                    "Open source sponsorships via GitHub Sponsors",
                    "Hackathon sponsorships globally"
                ],
                "past_events_supported": "GitHub Universe, hackathons worldwide, student developer events",
                "relevant_partnerships": "Universities globally, Hack Club, Major League Hacking",
                "community_initiatives": "GitHub Campus Experts, Open Source Friday, GitHub Sponsors",
                "student_initiatives": "GitHub Education Pack, Campus Experts, Student Developer Pack",
                "sponsorship_opportunities": "GitHub Pro accounts, Copilot access, swag, speaker sessions, venue credits",
                "size": "1000+",
                "headquarters": "San Francisco, California, USA",
                "founded_year": "2008"
            }
        }
        
        company_key = company_name.lower().replace(" ", "").replace(".", "").replace(",", "")
        
        # Find matching demo data
        matched_data = None
        for key, data in demo_data.items():
            if key in company_key or company_key in key:
                matched_data = data
                break
        
        if not matched_data:
            # Generic demo data
            matched_data = {
                "company_profile": f"{company_name} is a company in the {industry or 'technology'} sector.",
                "industry": industry or "Technology",
                "products_services": "Various products and services",
                "previous_sponsorships": ["UNVERIFIED - No specific sponsorship history found in demo mode"],
                "past_events_supported": "UNVERIFIED - Event sponsorship history not available in demo mode",
                "relevant_partnerships": "UNVERIFIED - Partnership information not available in demo mode",
                "community_initiatives": "UNVERIFIED - Community initiatives not verified",
                "student_initiatives": "UNVERIFIED - Student programs not verified",
                "sponsorship_opportunities": "Potential: Cash, Swag, Cloud Credits, Software Licenses",
                "size": "Unknown",
                "headquarters": "Unknown",
                "founded_year": "Unknown"
            }
        
        # Mark everything as UNVERIFIED in demo mode
        unverified = {}
        for key, value in matched_data.items():
            if key != "company_name":
                unverified[key] = {
                    "value": value,
                    "note": "UNVERIFIED - Demo mode data, not verified from live sources"
                }
        
        verified = {}
        if website:
            verified["website"] = website
        
        return ResearchResult(
            company_name=company_name,
            verified=verified,
            unverified=unverified,
            sources=["Demo mode - simulated data"],
            researched_at=datetime.utcnow(),
            source="demo"
        )


# Singleton instance
research_service = ResearchService()