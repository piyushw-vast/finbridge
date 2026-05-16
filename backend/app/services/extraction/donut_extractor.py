"""
PDF/image text extraction — format-agnostic extractor.
Uses PyMuPDF for text-based PDFs, easyocr for images.
Amount extraction uses math (subtotal+tax=total) not keyword brittle matching.
"""
import re
import io


async def extract_with_donut(image_bytes: bytes, pdf_bytes: bytes | None = None) -> dict:
    if pdf_bytes:
        return _extract_from_pdf_text(pdf_bytes)
    return await _extract_from_image_ocr(image_bytes)


def _extract_from_pdf_text(pdf_bytes: bytes) -> dict:
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = "\n".join(page.get_text() for page in doc)
        doc.close()
        if not full_text.strip():
            return {"success": False, "error": "No text in PDF", "data": {}}
        data = _parse_text(full_text)
        data["_raw_text"] = full_text
        return {"success": True, "data": data, "raw": full_text[:500]}
    except ImportError:
        return {"success": False, "error": "PyMuPDF not installed", "data": {}}
    except Exception as e:
        return {"success": False, "error": str(e), "data": {}}


async def _extract_from_image_ocr(image_bytes: bytes) -> dict:
    try:
        import easyocr
        import numpy as np
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        results = reader.readtext(np.array(img))
        full_text = "\n".join([r[1] for r in results])
        data = _parse_text(full_text)
        data["_raw_text"] = full_text
        return {"success": True, "data": data, "raw": full_text[:500]}
    except ImportError:
        return {"success": False, "error": "easyocr not installed", "data": {}}
    except Exception as e:
        return {"success": False, "error": str(e), "data": {}}


def _parse_text(text: str) -> dict:
    result = {}

    # ── GST numbers (fixed 15-char Indian format — unambiguous) ──────────────
    gst_pattern = r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b'
    gst_matches = re.findall(gst_pattern, text.upper())
    if gst_matches:
        result["vendor_gst"] = gst_matches[0]
        if len(gst_matches) > 1:
            result["buyer_gst"] = gst_matches[1]

    # ── Invoice number — look for common labels, then fallback to alphanumeric codes ──
    inv_m = re.search(
        r'(?:invoice\s*(?:no|number|#|num)|bill\s*(?:no|number|#)|receipt\s*(?:no|#)|ref(?:erence)?\s*(?:no|#)?)'
        r'[\s:.\-]*([A-Z0-9][A-Z0-9/\-]{2,30})',
        text, re.IGNORECASE
    )
    if inv_m:
        val = inv_m.group(1).strip()
        if any(c.isdigit() for c in val):  # must contain a digit — not a company name
            result["invoice_number"] = val

    # ── Date — multiple formats, all converted to YYYY-MM-DD ──────────────────
    date_patterns = [
        (r'\b([A-Za-z]{3,9})\s+(\d{1,2})[,\s]+(\d{4})\b', 'mdy_text'),   # Apr 21, 2026
        (r'\b(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})\b', 'dmy_text'), # 21 Apr 2026
        (r'\b(\d{4})[-/](\d{2})[-/](\d{2})\b', 'ymd'),                    # 2026-04-21
        (r'\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b', 'dmy'),                # 21/04/2026
    ]
    for pat, fmt in date_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            result["invoice_date"] = _normalize_date(m.group(0), fmt)
            break

    # ── Amounts: label-based first (reliable), math as fallback ─────────────────
    amounts = _extract_amounts_by_label(text)
    if not amounts:
        all_nums = _extract_all_amounts(text)
        amounts = _resolve_amounts_mathematically(all_nums)
    result.update(amounts)

    # ── Currency — detect $ vs ₹ ─────────────────────────────────────────────
    if re.search(r'\$\s*\d', text):
        result["currency"] = "USD"
    elif re.search(r'₹|Rs\.?\s*\d', text):
        result["currency"] = "INR"
    else:
        result["currency"] = "INR"

    # ── Vendor name — first substantive line (skip pure numbers/headers) ──────
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines[:8]:
        if (len(line) > 4
                and not re.match(r'^[\d\s₹$,.\-+%]+$', line)
                and not re.match(r'^(tax invoice|invoice|bill|receipt|gstin|pan|hsn|sac)', line, re.IGNORECASE)):
            result["vendor_name"] = line
            break

    # ── Buyer name ────────────────────────────────────────────────────────────
    buyer_m = re.search(
        r'(?:bill\s*to|sold\s*to|buyer|client|customer|ship\s*to)[\s:.\-]+([A-Za-z][^\n,]{4,60})',
        text, re.IGNORECASE
    )
    if buyer_m:
        result["buyer_name"] = buyer_m.group(1).strip()

    return result


def _extract_amounts_by_label(text: str) -> dict:
    """
    Extract amounts by looking for labeled lines: Total, Subtotal, Tax, Amount Due.
    Handles label and value on same line OR next line.
    Handles both ₹/Rs and $ prefixes.
    """
    # Number pattern — handles INR and USD, with or without currency symbol
    num = r'(?:₹|Rs\.?\s*|-?\$\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)'
    # Allow label followed by optional whitespace/newline then the amount
    sep = r'[\s:]*\n?[\s:]*'

    total_m = re.search(
        r'(?:grand\s*total|amount\s*due|total\s*amount|total\s*payable|net\s*payable)' + sep + num,
        text, re.IGNORECASE
    )
    subtotal_m = re.search(
        r'(?:subtotal|sub\s*total|taxable\s*value|taxable\s*amount)' + sep + num,
        text, re.IGNORECASE
    )
    tax_m = re.search(
        r'(?:total\s*tax|tax\s*amount|igst|cgst\s*\+\s*sgst|gst\s*amount)' + sep + num,
        text, re.IGNORECASE
    )

    result = {}
    if total_m:
        result["total_amount"] = _parse_number(total_m.group(1))
    if subtotal_m:
        result["subtotal"] = _parse_number(subtotal_m.group(1))
    if tax_m:
        result["tax_amount"] = _parse_number(tax_m.group(1))

    # If we got total but not subtotal, try to derive
    if result.get("total_amount") and result.get("tax_amount") and not result.get("subtotal"):
        derived = result["total_amount"] - result["tax_amount"]
        if derived > 0:
            result["subtotal"] = round(derived, 2)

    # Only return if we got at least total_amount
    return result if result.get("total_amount") else {}


def _extract_all_amounts(text: str) -> list[float]:
    """
    Pull every number that looks like a currency amount.
    Handles Indian comma format (1,23,456.78) and plain numbers.
    """
    # Indian number format: optional leading ₹/Rs, digits with commas, optional decimals
    pattern = r'(?:₹|Rs\.?\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?|\d{4,}(?:\.\d{2})?)'
    raw = re.findall(pattern, text)
    amounts = []
    for r in raw:
        v = _parse_number(r)
        if v is not None and v >= 1:  # ignore tiny numbers (tax rates, qty, etc.)
            amounts.append(v)
    return amounts


def _resolve_amounts_mathematically(amounts: list[float]) -> dict:
    """
    Find (subtotal, tax, total) where subtotal + tax ≈ total.
    Also handles CGST+SGST split (two equal tax lines that sum to total - subtotal).
    Works for any invoice format — no label matching needed.
    """
    if not amounts:
        return {}

    unique = sorted(set(amounts), reverse=True)
    candidates = [v for v in unique if v >= 100]

    if not candidates:
        return {}

    tol = lambda total: max(2.0, total * 0.005)  # 0.5% tolerance

    # Pass 1: find subtotal + tax = total (tax appears explicitly as single line)
    for total in candidates:
        others = [v for v in candidates if v != total and v < total]
        for subtotal in others:
            tax = total - subtotal
            if tax <= 0:
                continue
            # Check if tax exists in candidates (not total, not subtotal)
            tax_match = any(
                abs(v - tax) <= tol(total)
                for v in candidates
                if v != total and v != subtotal
            )
            if tax_match:
                return {"total_amount": total, "subtotal": subtotal, "tax_amount": round(tax, 2)}

    # Pass 2: CGST+SGST split — two equal values that sum to (total - subtotal)
    for total in candidates:
        others = [v for v in candidates if v != total and v < total]
        for subtotal in others:
            tax = total - subtotal
            if tax <= 0:
                continue
            half = tax / 2
            # Check if half-tax appears (at least once) — CGST = SGST pattern
            half_match = any(abs(v - half) <= tol(total) for v in candidates if v != total and v != subtotal)
            if half_match and tax > tol(total) * 10:  # tax must be meaningful
                return {"total_amount": total, "subtotal": subtotal, "tax_amount": round(tax, 2)}

    # Fallback: largest = total
    result = {"total_amount": candidates[0]}
    if len(candidates) >= 2:
        result["subtotal"] = candidates[1]
    return result


def _normalize_date(date_str: str, fmt: str) -> str:
    months = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "may": "05", "jun": "06", "jul": "07", "aug": "08",
        "sep": "09", "oct": "10", "nov": "11", "dec": "12"
    }
    date_str = date_str.strip()
    if fmt == 'mdy_text':
        m = re.match(r'([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})', date_str, re.IGNORECASE)
        if m:
            mon, d, y = m.groups()
            mo = months.get(mon[:3].lower(), "01")
            return f"{y}-{mo}-{d.zfill(2)}"
    if fmt == 'dmy_text':
        m = re.match(r'(\d{1,2})[-/\s]+([A-Za-z]+)[-/\s]+(\d{4})', date_str, re.IGNORECASE)
        if m:
            d, mon, y = m.groups()
            mo = months.get(mon[:3].lower(), "01")
            return f"{y}-{mo}-{d.zfill(2)}"
    elif fmt == 'ymd':
        m = re.match(r'(\d{4})[-/](\d{2})[-/](\d{2})', date_str)
        if m:
            return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    elif fmt == 'dmy':
        m = re.match(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', date_str)
        if m:
            return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return date_str


def _parse_number(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = str(value).replace(",", "").replace("₹", "").replace("Rs", "").replace(" ", "").strip()
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None
