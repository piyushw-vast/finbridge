"""
Vision-based invoice extractor using Groq (Llama 4 Scout vision).
Falls back to Gemini if GROQ_API_KEY not set.
Same interface and output schema as before.
"""
import json
import re
import base64
from app.core.config import settings

EXTRACTION_PROMPT = """You are an expert financial document analyst. Extract ALL fields from this invoice/receipt/bill image.

CRITICAL: Read every part of the document carefully. Do NOT return null for fields that are visible.

Return ONLY valid JSON with exactly these fields:
{
  "vendor_name": "company or person who issued the invoice",
  "vendor_address": "full address of vendor or null",
  "vendor_gst": "exactly 15-char Indian GST (format: 2digits+5letters+4digits+1letter+1alphanum+Z+1alphanum) or null",
  "vendor_pan": "10-char PAN number or null",
  "buyer_name": "company or person being billed (Bill To / Sold To) or null",
  "buyer_gst": "buyer GST number or null",
  "invoice_number": "the invoice/bill/receipt ID number (e.g. INV-001, #12345) — NOT the company name",
  "invoice_date": "date invoice was issued, converted to YYYY-MM-DD format",
  "due_date": "payment due date as YYYY-MM-DD or null",
  "subtotal": "amount before tax as number (e.g. 8474.58)",
  "tax_amount": "total tax charged as number (CGST+SGST+IGST combined)",
  "tax_rate": "tax percentage as number (e.g. 18 for 18%) or null",
  "total_amount": "final total payable as number",
  "currency": "INR or USD etc based on what is shown",
  "payment_method": "cash/card/bank transfer/UPI etc or null",
  "line_items": [{"description": "item name", "quantity": "number or null", "unit_price": "number or null", "amount": "number"}],
  "confidence": {
    "vendor_name": "0.0-1.0",
    "vendor_gst": "0.0-1.0",
    "invoice_number": "0.0-1.0",
    "invoice_date": "0.0-1.0",
    "total_amount": "0.0-1.0"
  }
}

Rules:
- Amounts: plain numbers only — no commas, no ₹/$. Example: 1,23,456.78 → 123456.78
- Dates: ANY format → convert to YYYY-MM-DD. "May 1, 2026" → "2026-05-01"
- invoice_number: alphanumeric code next to labels like "Invoice No", "Bill No", "Receipt No"
- Return ONLY the JSON object, no markdown, no explanation"""

PAYMENT_RECEIPT_PROMPT = """You are an expert financial document analyst. Extract ALL fields from this payment receipt/challan/acknowledgment.

CRITICAL: Read every part of the document carefully. Do NOT return null for fields that are visible.

Return ONLY valid JSON with exactly these fields:
{
  "vendor_name": "name of the payee — who received the payment",
  "vendor_address": "payee address or null",
  "vendor_gst": "15-char GST number of payee or null",
  "buyer_name": "name of the payer — who made the payment or null",
  "buyer_gst": "payer GST number or null",
  "invoice_number": "receipt/reference/transaction number (look for Receipt No, Ref No, UTR, Transaction ID)",
  "invoice_date": "date payment was made, converted to YYYY-MM-DD",
  "due_date": null,
  "subtotal": "base amount before tax as number or null",
  "tax_amount": "tax amount as number or null",
  "tax_rate": "tax percentage as number or null",
  "total_amount": "total amount paid as number",
  "currency": "INR or USD etc",
  "payment_method": "UPI/NEFT/RTGS/IMPS/cash/cheque/card — look for mode of payment field",
  "utr_number": "UTR/transaction reference number if visible or null",
  "bank_name": "bank name if mentioned or null",
  "line_items": [],
  "confidence": {
    "vendor_name": "0.0-1.0",
    "vendor_gst": "0.0-1.0",
    "invoice_number": "0.0-1.0",
    "invoice_date": "0.0-1.0",
    "total_amount": "0.0-1.0"
  }
}

Rules:
- Amounts: plain numbers only — no commas, no ₹/$. Example: 1,23,456.78 → 123456.78
- Dates: ANY format → convert to YYYY-MM-DD
- invoice_number: look for "Receipt No", "Ref No", "UTR No", "Transaction ID", "Ack No"
- payment_method: prioritize explicit labels like "Mode: UPI", "Payment via NEFT"
- Return ONLY the JSON object, no markdown, no explanation"""


def _get_prompt(invoice_type: str | None) -> str:
    if invoice_type == "payment":
        return PAYMENT_RECEIPT_PROMPT
    return EXTRACTION_PROMPT


async def extract_with_claude(image_bytes: bytes, media_type: str = "image/jpeg", invoice_type: str | None = None) -> dict:
    """Extract invoice data using Groq Llama 4 vision (falls back to Gemini)."""
    if settings.GROQ_API_KEY:
        return await _extract_with_groq(image_bytes, media_type, invoice_type)
    if settings.GEMINI_API_KEY:
        return await _extract_with_gemini(image_bytes, media_type, invoice_type)
    return {"success": False, "data": {}, "error": "No vision API key configured (GROQ_API_KEY or GEMINI_API_KEY)"}


async def _extract_with_groq(image_bytes: bytes, media_type: str, invoice_type: str | None = None) -> dict:
    try:
        from groq import Groq

        client = Groq(api_key=settings.GROQ_API_KEY)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        prompt = _get_prompt(invoice_type)

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=2000,
        )

        raw = response.choices[0].message.content.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)

        parsed = json.loads(raw)
        confidence = parsed.pop("confidence", {})

        return {
            "success": True,
            "data": parsed,
            "confidence": confidence,
            "raw": raw[:300],
        }

    except json.JSONDecodeError as e:
        return {"success": False, "data": {}, "error": f"JSON parse error: {e}"}
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


async def _extract_with_gemini(image_bytes: bytes, media_type: str, invoice_type: str | None = None) -> dict:
    try:
        import google.genai as genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        prompt = _get_prompt(invoice_type)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(parts=[
                    types.Part(text=prompt),
                    types.Part(inline_data=types.Blob(mime_type=media_type, data=image_b64)),
                ])
            ],
            config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=2000),
        )

        raw = response.text.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)

        parsed = json.loads(raw)
        confidence = parsed.pop("confidence", {})

        return {
            "success": True,
            "data": parsed,
            "confidence": confidence,
            "raw": raw[:300],
        }

    except json.JSONDecodeError as e:
        return {"success": False, "data": {}, "error": f"JSON parse error: {e}"}
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


async def refine_low_confidence_field(
    field: str,
    current_value,
    image_bytes: bytes,
    media_type: str = "image/jpeg",
) -> dict:
    """Re-ask vision model to focus on a specific low-confidence field."""
    prompt = (
        f"Look carefully at this invoice image. "
        f"I need to extract the field: {field}. "
        f"Current extracted value is: {current_value}. "
        f'Return ONLY a JSON: {{"value": <corrected value or null>, "confidence": <0.0-1.0>}}'
    )

    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
            response = client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                ]}],
                temperature=0.1,
                max_tokens=200,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            return json.loads(raw)
        except Exception:
            pass

    return {"value": current_value, "confidence": 0.3}
