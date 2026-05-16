import re


async def extract_with_ocr(image_bytes: bytes, pdf_bytes: bytes | None = None) -> dict:
    """
    Extract raw text and parse key numerical fields.
    For PDFs: uses PyMuPDF direct text extraction (fast, accurate).
    For images: uses PaddleOCR.
    """
    # PDF text extraction — fast and accurate for text-based PDFs
    if pdf_bytes:
        try:
            import fitz
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            if text.strip():
                parsed = _parse_raw_text(text)
                return {"success": True, "data": parsed, "raw_text": text}
        except Exception:
            pass  # fall through to image OCR

    try:
        from paddleocr import PaddleOCR
        import numpy as np
        import cv2

        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "error": "Could not decode image", "data": {}, "raw_text": ""}

        result = ocr.ocr(img, cls=True)

        if not result or not result[0]:
            return {"success": False, "error": "No text detected", "data": {}, "raw_text": ""}

        # Collect all text lines with confidence
        lines = []
        confidences = []
        for line in result[0]:
            if line and len(line) >= 2:
                text = line[1][0]
                conf = line[1][1]
                lines.append(text)
                confidences.append(conf)

        raw_text = "\n".join(lines)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        parsed = _parse_raw_text(raw_text)
        parsed["ocr_confidence"] = round(avg_confidence, 3)

        return {"success": True, "data": parsed, "raw_text": raw_text}

    except ImportError:
        return {"success": False, "error": "PaddleOCR not installed", "data": {}, "raw_text": ""}
    except Exception as e:
        return {"success": False, "error": str(e), "data": {}, "raw_text": ""}


def _parse_raw_text(text: str) -> dict:
    """Extract key fields from raw OCR text using heuristics."""
    result = {}
    lines = text.split("\n")

    # GST number pattern
    gst_pattern = r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b"
    gst_matches = re.findall(gst_pattern, text.upper())
    if gst_matches:
        result["vendor_gst"] = gst_matches[0]
        if len(gst_matches) > 1:
            result["buyer_gst"] = gst_matches[1]

    # Invoice number — must contain at least one digit, prevents matching plain company names
    inv_pattern = r"(?:invoice\s*(?:no|number|#|num)|bill\s*(?:no|number|#)|receipt\s*(?:no|#)|ref(?:erence)?\s*(?:no|#)?)[\s:.\-]*([A-Z0-9][A-Z0-9\-/_]{2,30})"
    inv_match = re.search(inv_pattern, text, re.IGNORECASE)
    if inv_match:
        val = inv_match.group(1).strip()
        if any(c.isdigit() for c in val):  # must have at least one digit
            result["invoice_number"] = val

    # Date patterns
    date_patterns = [
        r"\b(\d{2})[/\-\.](\d{2})[/\-\.](\d{4})\b",
        r"\b(\d{4})[/\-\.](\d{2})[/\-\.](\d{2})\b",
        r"\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{4})\b",
    ]
    for pat in date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            result["invoice_date_raw"] = match.group(0)
            break

    # Amount extraction — look for largest numbers near total/amount keywords
    amount_pattern = r"(?:total|amount|grand\s*total)[^\d]*([0-9,]+\.?[0-9]*)"
    amount_match = re.search(amount_pattern, text, re.IGNORECASE)
    if amount_match:
        result["total_amount"] = _parse_number(amount_match.group(1))

    # Tax amount
    tax_pattern = r"(?:tax|gst|igst|cgst|sgst)[^\d]*([0-9,]+\.?[0-9]*)"
    tax_match = re.search(tax_pattern, text, re.IGNORECASE)
    if tax_match:
        result["tax_amount"] = _parse_number(tax_match.group(1))

    # All currency amounts found (for cross-validation)
    all_amounts = re.findall(r"(?:₹|Rs\.?\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)", text)
    parsed_amounts = [_parse_number(a) for a in all_amounts if _parse_number(a) and _parse_number(a) > 100]
    if parsed_amounts:
        result["all_amounts_found"] = sorted(set(parsed_amounts), reverse=True)[:10]

    return result


def _parse_number(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = str(value).replace(",", "").replace("₹", "").replace("Rs", "").strip()
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None
