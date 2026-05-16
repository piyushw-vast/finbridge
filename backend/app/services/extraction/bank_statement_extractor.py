"""
Bank statement extractor — parses individual transaction rows from a bank statement image/PDF.
Returns a structured list of transactions rather than a single invoice record.
"""
import json
import re
import base64
from app.core.config import settings

BANK_STATEMENT_PROMPT = """You are an expert at parsing Indian bank statements. Extract ALL transaction rows from this bank statement.

Return ONLY valid JSON with this structure:
{
  "account_holder": "name on the account or null",
  "account_number": "masked account number e.g. XXXX1234 or null",
  "bank_name": "name of the bank or null",
  "statement_period_start": "YYYY-MM-DD or null",
  "statement_period_end": "YYYY-MM-DD or null",
  "opening_balance": number or null,
  "closing_balance": number or null,
  "currency": "INR",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "full transaction narration/description",
      "reference": "UTR/cheque/ref number or null",
      "debit": number or null,
      "credit": number or null,
      "balance": number or null
    }
  ]
}

Rules:
- Extract EVERY transaction row visible — do not skip any
- Amounts: plain numbers only, no commas. 1,23,456.78 → 123456.78
- Dates: convert any format to YYYY-MM-DD
- debit = money going out, credit = money coming in
- If a transaction is a debit, set debit field and leave credit null, and vice versa
- description: include full narration — UPI/NEFT/ATM/IMPS prefix + merchant name
- Return ONLY the JSON, no markdown"""


async def extract_bank_statement(image_bytes: bytes, media_type: str = "image/jpeg", pdf_bytes: bytes = None) -> dict:
    """Extract bank statement transactions using Groq vision + PDF text fallback."""
    if settings.GROQ_API_KEY:
        result = await _extract_with_groq(image_bytes, media_type)
        if result["success"] and result.get("data", {}).get("transactions"):
            return result

    # Fallback: try PDF text extraction
    if pdf_bytes:
        result = _extract_from_pdf_text(pdf_bytes)
        if result["success"] and result.get("data", {}).get("transactions"):
            return result

    return result if result else {"success": False, "data": {}, "error": "Extraction failed"}


async def _extract_with_groq(image_bytes: bytes, media_type: str) -> dict:
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": BANK_STATEMENT_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                ],
            }],
            temperature=0.1,
            max_tokens=4000,
        )

        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)
        transactions = data.get("transactions", [])

        return {
            "success": True,
            "data": data,
            "transaction_count": len(transactions),
            "raw": raw,
        }
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


def _extract_from_pdf_text(pdf_bytes: bytes) -> dict:
    """Extract transactions from PDF text layer using regex patterns."""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)

        # Common date patterns in bank statements
        date_pattern = r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{2}[-/]\d{2})"
        amount_pattern = r"[\d,]+\.\d{2}"

        lines = [l.strip() for l in text.split("\n") if l.strip()]
        transactions = []

        for line in lines:
            if re.search(date_pattern, line) and re.search(amount_pattern, line):
                amounts = re.findall(amount_pattern, line)
                date_match = re.search(date_pattern, line)
                if not date_match or not amounts:
                    continue

                raw_date = date_match.group()
                # Normalize date
                for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%y", "%d/%m/%y"]:
                    try:
                        from datetime import datetime
                        parsed = datetime.strptime(raw_date, fmt)
                        normalized_date = parsed.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        normalized_date = raw_date

                # Remove date and amounts from line for description
                desc = re.sub(date_pattern, "", line)
                desc = re.sub(amount_pattern, "", desc).strip(" |-/")

                # Parse amounts — last two are usually debit/credit and balance
                clean_amounts = [float(a.replace(",", "")) for a in amounts]
                balance = clean_amounts[-1] if len(clean_amounts) >= 1 else None
                txn_amount = clean_amounts[-2] if len(clean_amounts) >= 2 else clean_amounts[0]

                if desc and txn_amount:
                    transactions.append({
                        "date": normalized_date,
                        "description": desc[:200],
                        "reference": None,
                        "debit": txn_amount if "dr" in line.lower() or "debit" in line.lower() else None,
                        "credit": txn_amount if "cr" in line.lower() or "credit" in line.lower() else None,
                        "balance": balance,
                    })

        return {
            "success": len(transactions) > 0,
            "data": {"transactions": transactions, "currency": "INR"},
            "transaction_count": len(transactions),
        }
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}
