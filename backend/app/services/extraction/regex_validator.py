import re
from datetime import datetime, date


GST_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
INVOICE_NUMBER_PATTERN = re.compile(r"^[\w\-/]{3,50}$")


def validate_gst(gst: str | None) -> dict:
    if not gst:
        return {"valid": False, "confidence": 0.0, "reason": "missing"}
    cleaned = gst.upper().replace(" ", "")
    if GST_PATTERN.match(cleaned):
        return {"valid": True, "confidence": 1.0, "normalized": cleaned}
    return {"valid": False, "confidence": 0.0, "reason": f"invalid format: {gst}"}


def validate_math(subtotal: float | None, tax: float | None, total: float | None) -> dict:
    if total is None:
        return {"valid": False, "confidence": 0.3, "reason": "total missing"}

    if subtotal is not None and tax is not None:
        expected = round(subtotal + tax, 2)
        actual = round(total, 2)
        diff = abs(expected - actual)
        if diff < 1.0:
            return {"valid": True, "confidence": 1.0, "expected": expected, "actual": actual}
        elif diff < 10.0:
            return {"valid": False, "confidence": 0.7, "reason": f"small discrepancy: expected {expected}, got {actual}"}
        else:
            return {"valid": False, "confidence": 0.0, "reason": f"math mismatch: expected {expected}, got {actual}"}

    if subtotal is not None and total >= subtotal:
        return {"valid": True, "confidence": 0.8, "reason": "total >= subtotal"}

    return {"valid": True, "confidence": 0.6, "reason": "partial validation only"}


def validate_date(date_str: str | None) -> dict:
    if not date_str:
        return {"valid": False, "confidence": 0.0, "reason": "missing"}

    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str.strip(), fmt).date()
            today = date.today()

            if parsed > today:
                return {"valid": False, "confidence": 0.5, "reason": "future date", "normalized": parsed.isoformat()}

            years_ago = (today - parsed).days / 365
            if years_ago > 5:
                return {"valid": False, "confidence": 0.6, "reason": "date more than 5 years ago", "normalized": parsed.isoformat()}

            return {"valid": True, "confidence": 1.0, "normalized": parsed.isoformat()}
        except ValueError:
            continue

    return {"valid": False, "confidence": 0.0, "reason": f"unparseable date: {date_str}"}


def validate_amount(amount: float | None, field_name: str = "amount") -> dict:
    if amount is None:
        return {"valid": False, "confidence": 0.0, "reason": "missing"}
    if amount < 0:
        return {"valid": False, "confidence": 0.0, "reason": "negative amount"}
    if amount > 10_000_000:  # 1 crore sanity check
        return {"valid": False, "confidence": 0.5, "reason": "unusually large amount"}
    return {"valid": True, "confidence": 1.0}


def run_all_validations(data: dict) -> dict:
    """Run all validation checks and return validation report."""
    report = {}

    report["gst_validation"] = validate_gst(data.get("vendor_gst"))
    report["math_validation"] = validate_math(
        data.get("subtotal"), data.get("tax_amount"), data.get("total_amount")
    )
    report["date_validation"] = validate_date(data.get("invoice_date"))
    report["total_validation"] = validate_amount(data.get("total_amount"), "total")

    # Normalize GST if valid
    if report["gst_validation"]["valid"]:
        data["vendor_gst"] = report["gst_validation"]["normalized"]

    # Normalize date if valid
    if report["date_validation"]["valid"] and "normalized" in report["date_validation"]:
        data["invoice_date"] = report["date_validation"]["normalized"]

    passed = sum(1 for v in report.values() if v.get("valid", False))
    total = len(report)
    report["overall_score"] = round(passed / total, 2)

    return report
