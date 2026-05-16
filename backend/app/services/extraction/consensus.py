"""
Consensus Engine — cross-validates outputs from Claude, Donut, OCR, and Regex.
Produces field-level confidence scores, conflict detection, and a final trust score.
"""

from typing import Any


# Weights per extractor per field type
# Higher = more trusted for that field
EXTRACTOR_WEIGHTS = {
    "claude": {
        "vendor_name": 0.90,
        "vendor_gst": 0.75,
        "invoice_number": 0.85,
        "invoice_date": 0.85,
        "subtotal": 0.80,
        "tax_amount": 0.80,
        "total_amount": 0.80,
        "line_items": 0.90,
        "category": 0.95,
    },
    "donut": {
        "vendor_name": 0.70,
        "total_amount": 0.85,
        "subtotal": 0.85,
        "tax_amount": 0.85,
        "line_items": 0.80,
    },
    "ocr": {
        "vendor_gst": 0.85,
        "invoice_number": 0.75,
        "total_amount": 0.80,
        "subtotal": 0.75,
        "tax_amount": 0.75,
    },
    "regex": {
        "vendor_gst": 1.0,  # regex is most reliable for GST format
        "invoice_number": 0.80,
        "invoice_date": 0.90,
        "total_amount": 0.90,  # math validation
        "tax_amount": 0.85,
    },
}

NUMERIC_FIELDS = {"subtotal", "tax_amount", "total_amount"}
AMOUNT_TOLERANCE = 5.0  # ₹5 tolerance for numeric comparisons


def build_consensus(
    claude_result: dict,
    donut_result: dict,
    ocr_result: dict,
    validation_report: dict,
    image_quality: float,
) -> dict:
    """
    Build consensus from all extractor outputs.
    Returns: field_confidence, conflicts, final_data, trust_score
    """
    fields_to_consensus = [
        "vendor_name", "vendor_gst", "invoice_number", "invoice_date",
        "subtotal", "tax_amount", "total_amount", "line_items", "category",
        "vendor_address", "buyer_name", "buyer_gst", "due_date",
        "payment_method", "currency",
    ]

    field_confidence = {}
    conflicts = []
    final_data = {}

    for field in fields_to_consensus:
        values = _collect_values(field, claude_result, donut_result, ocr_result)
        if not values:
            field_confidence[field] = {"confidence": 0.0, "source": "none", "value": None}
            final_data[field] = None
            continue

        result = _resolve_field(field, values, validation_report)
        field_confidence[field] = result
        final_data[field] = result["value"]

        if result.get("conflict"):
            conflicts.append({
                "field": field,
                "description": result["conflict"],
                "values": result.get("conflicting_values", {}),
            })

    trust_score = _calculate_trust_score(
        field_confidence=field_confidence,
        validation_report=validation_report,
        conflicts=conflicts,
        image_quality=image_quality,
    )

    return {
        "field_confidence": field_confidence,
        "conflicts": conflicts,
        "final_data": final_data,
        "trust_score": trust_score,
        "risk_level": _get_risk_level(trust_score),
        "auto_approve": trust_score >= 85,
    }


def _collect_values(field: str, claude: dict, donut: dict, ocr: dict) -> dict:
    values = {}
    if field in claude and claude[field] is not None:
        values["claude"] = claude[field]
    if field in donut and donut[field] is not None:
        values["donut"] = donut[field]
    if field in ocr and ocr[field] is not None:
        values["ocr"] = ocr[field]
    return values


def _resolve_field(field: str, values: dict, validation_report: dict) -> dict:
    if len(values) == 1:
        source = list(values.keys())[0]
        value = list(values.values())[0]
        base_weight = EXTRACTOR_WEIGHTS.get(source, {}).get(field, 0.6)
        confidence = base_weight * 0.8  # single source penalty
        return {"value": value, "confidence": round(confidence, 3), "source": source}

    # Check for conflicts in numeric fields
    if field in NUMERIC_FIELDS:
        return _resolve_numeric_field(field, values, validation_report)

    # For text fields — check agreement
    return _resolve_text_field(field, values, validation_report)


def _resolve_numeric_field(field: str, values: dict, validation_report: dict) -> dict:
    numeric_vals = {}
    for source, val in values.items():
        if isinstance(val, (int, float)) and val > 0:
            numeric_vals[source] = float(val)

    if not numeric_vals:
        return {"value": None, "confidence": 0.0, "source": "none"}

    # Filter outliers: if a value is less than 15% of the max, it's OCR/regex noise
    max_val = max(numeric_vals.values())
    numeric_vals = {s: v for s, v in numeric_vals.items() if v >= max_val * 0.15 or max_val < 100}

    if not numeric_vals:
        return {"value": None, "confidence": 0.0, "source": "none"}

    # Gemini (labelled "claude" for compatibility) is the authority for vision fields
    # If only one source left after filtering, use it with moderate confidence
    if len(numeric_vals) == 1:
        source = list(numeric_vals.keys())[0]
        base = EXTRACTOR_WEIGHTS.get(source, {}).get(field, 0.6)
        return {"value": list(numeric_vals.values())[0], "confidence": round(base * 0.9, 3), "source": source}

    vals = list(numeric_vals.values())
    max_diff = max(vals) - min(vals)
    relative_diff = max_diff / max(max_val, 1)

    if relative_diff <= 0.05 or max_diff <= AMOUNT_TOLERANCE:
        # Good agreement — weighted average
        weighted_sum = sum(v * EXTRACTOR_WEIGHTS.get(s, {}).get(field, 0.5) for s, v in numeric_vals.items())
        weight_sum = sum(EXTRACTOR_WEIGHTS.get(s, {}).get(field, 0.5) for s in numeric_vals)
        final_val = round(weighted_sum / weight_sum, 2) if weight_sum > 0 else vals[0]
        math_valid = validation_report.get("math_validation", {}).get("valid", False)
        confidence = 0.92 if math_valid else 0.85
        best_source = max(numeric_vals, key=lambda s: EXTRACTOR_WEIGHTS.get(s, {}).get(field, 0.5))
        return {"value": final_val, "confidence": confidence, "source": best_source}

    else:
        # Real conflict — trust Gemini/claude, flag with reduced penalty
        claude_val = numeric_vals.get("claude")
        best_source = "claude" if claude_val else max(numeric_vals, key=lambda s: EXTRACTOR_WEIGHTS.get(s, {}).get(field, 0.5))
        final_val = numeric_vals[best_source]
        conflict_desc = " vs ".join(f"{s}:₹{v:,.2f}" for s, v in numeric_vals.items())
        return {
            "value": final_val,
            "confidence": 0.65,
            "source": best_source,
            "conflict": f"Amount mismatch: {conflict_desc}",
            "conflicting_values": numeric_vals,
        }


def _resolve_text_field(field: str, values: dict, validation_report: dict) -> dict:
    if field == "vendor_gst":
        # Regex is most authoritative for GST
        gst_valid = validation_report.get("gst_validation", {}).get("valid", False)
        gst_normalized = validation_report.get("gst_validation", {}).get("normalized")

        if gst_valid:
            return {"value": gst_normalized, "confidence": 0.98, "source": "regex_validated"}

        # Check if extractors agree
        gst_values = {s: v for s, v in values.items() if isinstance(v, str)}
        unique = set(v.upper().replace(" ", "") for v in gst_values.values())
        if len(unique) == 1:
            return {"value": list(gst_values.values())[0], "confidence": 0.55, "source": "extractors_agree",
                    "conflict": "GST format invalid but extractors agree"}

        return {
            "value": values.get("claude") or list(values.values())[0],
            "confidence": 0.30,
            "source": "claude",
            "conflict": f"GST mismatch across extractors: {list(values.values())}",
            "conflicting_values": values,
        }

    # General text field — check agreement
    str_values = {s: str(v).strip().lower() for s, v in values.items() if v}
    unique_vals = set(str_values.values())

    if len(unique_vals) == 1:
        # Perfect agreement
        best_source = max(values, key=lambda s: EXTRACTOR_WEIGHTS.get(s, {}).get(field, 0.5))
        confidence = min(0.97, 0.75 + 0.07 * len(values))
        return {"value": values[best_source], "confidence": round(confidence, 3), "source": best_source}

    # Partial agreement or conflict — trust Claude
    claude_val = values.get("claude")
    best_source = "claude" if claude_val else list(values.keys())[0]
    confidence = 0.72 if len(unique_vals) == len(values) else 0.80

    return {
        "value": values[best_source],
        "confidence": round(confidence, 3),
        "source": best_source,
    }


def _calculate_trust_score(
    field_confidence: dict,
    validation_report: dict,
    conflicts: list,
    image_quality: float,
) -> float:
    # Component 1: Field confidence average (40%)
    key_fields = ["vendor_name", "vendor_gst", "invoice_number", "invoice_date", "total_amount"]
    key_confidences = [field_confidence[f]["confidence"] for f in key_fields if f in field_confidence]
    avg_confidence = sum(key_confidences) / len(key_confidences) if key_confidences else 0.5
    confidence_score = avg_confidence * 40

    # Component 2: Validation score (30%)
    validation_score = validation_report.get("overall_score", 0.5) * 30

    # Component 3: Image quality (15%)
    quality_score = min(1.0, image_quality) * 15

    # Component 4: Conflict penalty (15%)
    conflict_penalty = min(15, len(conflicts) * 5)
    conflict_score = 15 - conflict_penalty

    total = confidence_score + validation_score + quality_score + conflict_score
    return round(min(100, max(0, total)), 1)


def _get_risk_level(trust_score: float) -> str:
    if trust_score >= 85:
        return "safe"
    elif trust_score >= 60:
        return "review"
    else:
        return "high_risk"
