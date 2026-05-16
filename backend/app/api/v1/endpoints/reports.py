import uuid
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.report import Report, ReportType
from app.models.company import Company
from app.utils.audit import create_audit_log
from app.utils.notifications import create_notification
from app.models.audit import AuditAction
from app.models.notification import NotificationType
from app.core.config import settings

router = APIRouter()


@router.post("/upload")
async def upload_report(
    file: UploadFile = File(...),
    company_id: uuid.UUID = Form(...),
    title: str = Form(...),
    report_type: ReportType = Form(ReportType.MIS),
    description: Optional[str] = Form(None),
    period_start: Optional[str] = Form(None),
    period_end: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN)),
):
    file_bytes = await file.read()
    file_url = await _upload_report_file(file_bytes, file.filename)

    report = Report(
        company_id=company_id,
        uploaded_by=current_user.id,
        title=title,
        report_type=report_type,
        file_name=file.filename,
        file_url=file_url,
        description=description,
        period_start=period_start,
        period_end=period_end,
    )
    db.add(report)
    await db.flush()

    await create_audit_log(
        db=db,
        action=AuditAction.REPORT_UPLOADED,
        entity_type="report",
        entity_id=str(report.id),
        user_id=current_user.id,
        details={"title": title, "report_type": report_type.value},
    )

    # Notify company users
    from app.models.user import User as UserModel
    users_result = await db.execute(
        select(UserModel).where(
            UserModel.company_id == company_id,
            UserModel.is_active == True,
        )
    )
    company_users = users_result.scalars().all()
    for user in company_users:
        await create_notification(
            db=db,
            recipient_id=user.id,
            type=NotificationType.REPORT_PUBLISHED,
            title="New Report Available",
            message=f"{title} has been published by your accounting firm.",
            entity_type="report",
            entity_id=str(report.id),
        )

    await db.commit()
    return {"report_id": str(report.id), "message": "Report uploaded successfully"}


@router.get("")
async def list_reports(
    company_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Report)

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        query = query.where(Report.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        companies_q = select(Company.id).where(Company.firm_id == current_user.firm_id)
        query = query.where(Report.company_id.in_(companies_q))

    if company_id:
        query = query.where(Report.company_id == company_id)

    query = query.order_by(Report.created_at.desc())
    result = await db.execute(query)
    reports = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "company_id": str(r.company_id),
            "title": r.title,
            "report_type": r.report_type.value,
            "file_name": r.file_name,
            "file_url": r.file_url,
            "description": r.description,
            "period_start": r.period_start,
            "period_end": r.period_end,
            "summary_data": r.summary_data,
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]


@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    pdf_bytes = _generate_report_pdf(report)
    filename = report.file_name or f"{report.title}.pdf"
    if not filename.endswith(".pdf"):
        filename += ".pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _fmt(v):
    if not v and v != 0:
        return "—"
    n = float(v)
    if n >= 10000000:
        return f"Rs {n/10000000:.2f}Cr"
    if n >= 100000:
        return f"Rs {n/100000:.2f}L"
    return f"Rs {n:,.0f}"


def _generate_report_pdf(report: Report) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2*cm, rightMargin=2*cm)

    styles = getSampleStyleSheet()
    INDIGO = colors.HexColor("#4f46e5")
    SLATE = colors.HexColor("#64748b")
    DARK = colors.HexColor("#0f172a")
    LIGHT = colors.HexColor("#f8fafc")
    EMERALD = colors.HexColor("#059669")
    ROSE = colors.HexColor("#e11d48")

    title_style = ParagraphStyle("title", parent=styles["Normal"], fontSize=20,
                                  textColor=DARK, spaceAfter=4, fontName="Helvetica-Bold")
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10,
                                textColor=SLATE, spaceAfter=2)
    section_style = ParagraphStyle("section", parent=styles["Normal"], fontSize=11,
                                    textColor=INDIGO, spaceBefore=14, spaceAfter=6,
                                    fontName="Helvetica-Bold")
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=9,
                                 textColor=SLATE, spaceAfter=3)

    story = []

    # Header
    story.append(Paragraph("FinBridge", ParagraphStyle("brand", parent=styles["Normal"],
                            fontSize=11, textColor=INDIGO, fontName="Helvetica-Bold")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(report.title, title_style))
    rtype = (report.report_type.value if report.report_type else "report").replace("_", " ").title()
    story.append(Paragraph(f"{rtype}  ·  {report.period_start or ''} — {report.period_end or ''}", sub_style))
    if report.description:
        story.append(Paragraph(report.description, body_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=10))

    sd = report.summary_data or {}

    # KPI table
    if sd:
        story.append(Paragraph("Financial Summary", section_style))
        kpis = [
            ["Total Spend", _fmt(sd.get("total_spend")), "GST Input Credit", _fmt(sd.get("gst_input_credit"))],
            ["Invoices Accepted", f"{sd.get('accepted', '—')} / {sd.get('total_invoices', '—')}",
             "Avg Trust Score", f"{sd.get('avg_trust_score', '—')}%"],
        ]
        t = Table(kpis, colWidths=[4*cm, 4*cm, 4*cm, 4*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef2ff")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#eef2ff")),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
            ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (0, -1), SLATE),
            ("TEXTCOLOR", (2, 0), (2, -1), SLATE),
            ("TEXTCOLOR", (1, 0), (1, -1), DARK),
            ("TEXTCOLOR", (3, 0), (3, -1), DARK),
            ("ROWBACKGROUND", (0, 0), (-1, -1), [LIGHT, colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ]))
        story.append(t)

    # Spend by category
    if sd.get("categories"):
        story.append(Paragraph("Spend by Category", section_style))
        rows = [["Category", "Amount", "% of Total"]]
        for c in sd["categories"]:
            rows.append([c["name"], _fmt(c["amount"]), f"{c['pct']}%"])
        t = Table(rows, colWidths=[9*cm, 4*cm, 3*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUND", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ]))
        story.append(t)

    # Top vendors
    if sd.get("top_vendors"):
        story.append(Paragraph("Top Vendors", section_style))
        rows = [["#", "Vendor", "Amount", "Invoices"]]
        for i, v in enumerate(sd["top_vendors"], 1):
            rows.append([str(i), v["name"], _fmt(v["amount"]), str(v.get("invoices", "—"))])
        t = Table(rows, colWidths=[1*cm, 9*cm, 4*cm, 2*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUND", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ]))
        story.append(t)

    # GST split
    if sd.get("gst_split"):
        story.append(Paragraph("GST Input Tax Credit Breakdown", section_style))
        g = sd["gst_split"]
        total_gst = sum(g.values())
        rows = [["Component", "Amount"],
                ["CGST (Central GST)", _fmt(g.get("cgst", 0))],
                ["SGST (State GST)", _fmt(g.get("sgst", 0))],
                ["IGST (Integrated GST)", _fmt(g.get("igst", 0))],
                ["Total Input Credit", _fmt(total_gst)]]
        t = Table(rows, colWidths=[10*cm, 6*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f59e0b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUND", (0, 1), (-1, -2), [colors.white, LIGHT]),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fef9c3")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]))
        story.append(t)

    # Cash flow
    if sd.get("cash_flow"):
        story.append(Paragraph("Cash Flow Summary", section_style))
        cf = sd["cash_flow"]
        rows = [["", "Amount"],
                ["Opening Balance", _fmt(cf.get("opening"))],
                ["+ Total Inflows", _fmt(cf.get("inflows"))],
                ["− Total Outflows", _fmt(cf.get("outflows"))],
                ["Closing Balance", _fmt(cf.get("closing"))]]
        t = Table(rows, colWidths=[10*cm, 6*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUND", (0, 1), (-1, -2), [colors.white, LIGHT]),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ede9fe")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]))
        story.append(t)

    # Highlights
    if sd.get("highlights"):
        story.append(Paragraph("Key Highlights", section_style))
        for h in sd["highlights"]:
            story.append(Paragraph(f"• {h}", body_style))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Generated by FinBridge · AI-powered financial document management",
                            ParagraphStyle("footer", parent=styles["Normal"], fontSize=8,
                                           textColor=SLATE, alignment=TA_CENTER)))

    doc.build(story)
    return buf.getvalue()


async def _upload_report_file(file_bytes: bytes, filename: str) -> str:
    try:
        from supabase import create_client
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        path = f"reports/{uuid.uuid4()}/{filename}"
        supabase.storage.from_("reports").upload(path, file_bytes)
        return supabase.storage.from_("reports").get_public_url(path)
    except Exception:
        return f"/uploads/reports/{uuid.uuid4()}/{filename}"
