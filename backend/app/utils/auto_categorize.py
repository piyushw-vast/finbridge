"""
Auto-categorization: maps extracted vendor/description to a company's payment heads.
Uses keyword matching first, falls back to fuzzy head-name matching.
"""
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.company import PaymentHead, PaymentSubHead
import uuid

# Keyword rules: (patterns) -> canonical head name fragment to match
# Patterns are matched case-insensitively against vendor_name + line item descriptions
KEYWORD_RULES = [
    (["amazon web services", "aws", "ec2", "s3 storage", "rds", "lambda", "cloudfront"],    "cloud"),
    (["microsoft azure", "azure"],                                                            "cloud"),
    (["google cloud", "gcp", "bigquery", "compute engine"],                                  "cloud"),
    (["digitalocean", "linode", "vultr", "hetzner"],                                         "cloud"),
    (["jetbrains", "github", "gitlab", "figma", "notion", "slack", "zoom", "atlassian",
      "jira", "confluence", "postman", "datadog", "sentry", "new relic", "software license",
      "subscription", "saas"],                                                                "software"),
    (["salary", "payroll", "wages", "staff payment", "employee", "hr", "compensation"],      "salary"),
    (["rent", "lease", "office space", "co-working", "coworking", "brigade", "prestige"],    "rent"),
    (["electricity", "power bill", "bescom", "msedcl", "tata power", "water bill",
      "utility", "broadband", "internet", "airtel", "jio", "bsnl", "act fibernet"],          "utilities"),
    (["travel", "flight", "hotel", "uber", "ola", "cab", "taxi", "indigo", "air india",
      "makemytrip", "yatra", "boarding", "lodging"],                                          "travel"),
    (["marketing", "advertising", "google ads", "meta ads", "facebook ads",
      "linkedin ads", "seo", "campaign", "promotion"],                                        "marketing"),
    (["catering", "food", "canteen", "restaurant", "swiggy", "zomato", "snacks"],            "food"),
    (["stationery", "office supplies", "printing", "courier", "packaging"],                  "office supplies"),
    (["insurance", "mediclaim", "health insurance", "group insurance", "lic"],               "insurance"),
    (["maintenance", "repair", "service charge", "amc", "annual maintenance"],               "maintenance"),
    (["tax", "gst payment", "income tax", "tds", "advance tax", "professional tax"],         "tax"),
    (["bank charges", "bank fee", "processing fee", "transaction fee", "forex"],             "bank charges"),
    (["raw material", "purchase", "inventory", "stock", "goods", "material"],                "purchases"),
]


def _build_search_text(vendor_name: str | None, line_items: list | None) -> str:
    parts = [vendor_name or ""]
    if line_items:
        for item in line_items:
            if isinstance(item, dict):
                parts.append(item.get("description", ""))
    return " ".join(parts).lower()


def _match_keyword(text: str) -> str | None:
    for keywords, category in KEYWORD_RULES:
        for kw in keywords:
            if kw in text:
                return category
    return None


async def auto_assign_payment_head(
    db: AsyncSession,
    company_id: uuid.UUID,
    vendor_name: str | None,
    line_items: list | None,
) -> uuid.UUID | None:
    """
    Returns the best-matching payment_head_id for this company, or None.
    """
    search_text = _build_search_text(vendor_name, line_items)
    category_hint = _match_keyword(search_text)
    if not category_hint:
        return None

    result = await db.execute(
        select(PaymentHead).where(PaymentHead.company_id == company_id)
    )
    heads = result.scalars().all()
    if not heads:
        return None

    # Match category hint against head names
    for head in heads:
        if category_hint in head.name.lower():
            return head.id

    # Fallback: partial word overlap
    hint_words = set(category_hint.split())
    best_head = None
    best_score = 0
    for head in heads:
        head_words = set(re.sub(r"[^a-z ]", "", head.name.lower()).split())
        score = len(hint_words & head_words)
        if score > best_score:
            best_score = score
            best_head = head

    return best_head.id if best_head and best_score > 0 else None
