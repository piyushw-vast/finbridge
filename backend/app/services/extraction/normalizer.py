import re
from datetime import datetime


def normalize_amount(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    if isinstance(value, str):
        cleaned = re.sub(r"[₹Rs,\s]", "", value)
        try:
            return round(float(cleaned), 2)
        except (ValueError, TypeError):
            return None
    return None


def normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y/%m/%d",
               "%d %b %Y", "%d %B %Y", "%B %d, %Y"]
    for fmt in formats:
        try:
            return datetime.strptime(value.strip(), fmt).strftime("%Y-%m-%d")
        except (ValueError, AttributeError):
            continue
    return value  # return as-is if can't normalize


def normalize_gst(value: str | None) -> str | None:
    if not value:
        return None
    return value.upper().replace(" ", "").strip()


def normalize_name(value: str | None) -> str | None:
    if not value:
        return None
    return " ".join(word.capitalize() for word in value.strip().split())


def normalize_extraction(data: dict) -> dict:
    """Normalize all fields in extraction output."""
    normalized = dict(data)

    normalized["vendor_name"] = normalize_name(data.get("vendor_name"))
    normalized["buyer_name"] = normalize_name(data.get("buyer_name"))
    normalized["vendor_gst"] = normalize_gst(data.get("vendor_gst"))
    normalized["buyer_gst"] = normalize_gst(data.get("buyer_gst"))
    normalized["invoice_date"] = normalize_date(data.get("invoice_date"))
    normalized["due_date"] = normalize_date(data.get("due_date"))
    normalized["subtotal"] = normalize_amount(data.get("subtotal"))
    normalized["tax_amount"] = normalize_amount(data.get("tax_amount"))
    normalized["total_amount"] = normalize_amount(data.get("total_amount"))
    normalized["currency"] = (data.get("currency") or "INR").upper()

    if normalized.get("invoice_number"):
        normalized["invoice_number"] = str(normalized["invoice_number"]).strip()

    return normalized
