"""Generate 6 realistic sample invoice PDFs for testing."""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
import os

OUT = "/media/piyushw/C058547C58547360/finbridge/sample_invoices"
os.makedirs(OUT, exist_ok=True)

styles = getSampleStyleSheet()
H1 = ParagraphStyle("h1", fontSize=18, fontName="Helvetica-Bold", spaceAfter=4)
H2 = ParagraphStyle("h2", fontSize=13, fontName="Helvetica-Bold", spaceAfter=2)
NORMAL = styles["Normal"]
RIGHT = ParagraphStyle("right", fontSize=10, alignment=TA_RIGHT)
SMALL = ParagraphStyle("small", fontSize=8, textColor=colors.grey)
BOLD = ParagraphStyle("bold", fontSize=10, fontName="Helvetica-Bold")


def hr(): return HRFlowable(width="100%", thickness=1, color=colors.grey, spaceAfter=6, spaceBefore=6)
def sp(h=6): return Spacer(1, h)


# ── 1. AWS Cloud Services Invoice (clean PDF, high trust) ──────────────────────
def pdf1():
    doc = SimpleDocTemplate(f"{OUT}/1_aws_cloud_invoice.pdf", pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm)
    story = []
    story.append(Paragraph("Amazon Web Services India Pvt Ltd", H1))
    story.append(Paragraph("Tax Invoice", ParagraphStyle("inv", fontSize=12, textColor=colors.HexColor("#FF9900"), fontName="Helvetica-Bold")))
    story.append(sp())
    story.append(Table([
        ["Registered Address:", "Invoice No:", "IN-AWS-2024-04-8821"],
        ["2/F, Tower B, Unitech Cyber Park,", "Invoice Date:", "30-Apr-2024"],
        ["Sector 39, Gurgaon - 122001", "Due Date:", "30-May-2024"],
        ["GSTIN: 06AAQCA4519Q1ZX", "PAN:", "AAQCA4519Q"],
        ["", "SAC Code:", "998313"],
    ], colWidths=[80*mm, 40*mm, 70*mm]))
    story.append(hr())
    story.append(Paragraph("Bill To:", BOLD))
    story.append(Paragraph("Acme IT Solutions Pvt Ltd", NORMAL))
    story.append(Paragraph("Tower B, Cybercity, Pune - 411014 | GSTIN: 27AABCU9603R1ZX", NORMAL))
    story.append(hr())
    data = [
        ["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"],
        ["1", "EC2 Instances - t3.medium × 5 (April 2024)", "1", "18,500.00", "18,500.00"],
        ["2", "S3 Standard Storage - 2.1 TB", "1", "12,840.00", "12,840.00"],
        ["3", "CloudFront CDN - 850 GB transfer", "1", "7,650.00", "7,650.00"],
        ["4", "RDS PostgreSQL db.t3.medium", "1", "9,210.50", "9,210.50"],
        ["5", "AWS Support - Business Plan", "1", "5,000.00", "5,000.00"],
        ["", "", "", "Subtotal", "53,200.50"],
        ["", "", "", "IGST @18%", "9,576.09"],
        ["", "", "", "Total", "62,776.59"],
    ]
    t = Table(data, colWidths=[10*mm, 90*mm, 15*mm, 30*mm, 35*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#232F3E")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ALIGN", (2,0), (-1,-1), "RIGHT"),
        ("FONTNAME", (3,6), (-1,-1), "Helvetica-Bold"),
        ("LINEABOVE", (0,6), (-1,6), 1, colors.grey),
        ("ROWBACKGROUNDS", (0,1), (-1,5), [colors.white, colors.HexColor("#F9F9F9")]),
    ]))
    story.append(t)
    story.append(sp(10))
    story.append(Paragraph("Amount in words: Sixty Two Thousand Seven Hundred Seventy Six and 59/100 Rupees Only", SMALL))
    story.append(sp(8))
    story.append(Paragraph("Bank Details: HDFC Bank | A/c: 00601450004783 | IFSC: HDFC0000060", SMALL))
    story.append(Paragraph("This is a computer-generated invoice. No signature required.", SMALL))
    doc.build(story)
    print("✓ 1_aws_cloud_invoice.pdf")


# ── 2. Office Rent Invoice (property/services, clean) ─────────────────────────
def pdf2():
    doc = SimpleDocTemplate(f"{OUT}/2_office_rent_invoice.pdf", pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm)
    story = []
    story.append(Paragraph("Prestige Estate Projects Ltd", H1))
    story.append(Paragraph("TAX INVOICE", ParagraphStyle("t", fontSize=11, fontName="Helvetica-Bold", textColor=colors.darkblue)))
    story.append(sp(4))
    story.append(Table([
        ["GSTIN: 29AABCP6022N1ZS", "Invoice No:", "PRE/PUN/2024/0412"],
        ["No. 3, Residency Road, Bangalore - 560025", "Invoice Date:", "01-Apr-2024"],
        ["Tel: +91-80-25591080", "Period:", "April 2024"],
        ["Email: billing@prestigegroup.com", "SAC:", "997212"],
    ], colWidths=[100*mm, 35*mm, 65*mm]))
    story.append(hr())
    story.append(Paragraph("<b>Tenant:</b> Acme IT Solutions Pvt Ltd, Tower B, Cybercity, Pune - 411014", NORMAL))
    story.append(Paragraph("<b>Property:</b> Unit 4B, Prestige Tech Park, Hadapsar, Pune - 411028 | Area: 2,400 sq ft", NORMAL))
    story.append(hr())
    data = [
        ["Description", "Amount (₹)"],
        ["Base Rent - April 2024 (2,400 sq ft @ ₹85/sq ft)", "2,04,000.00"],
        ["Maintenance Charges", "12,000.00"],
        ["Car Parking (4 slots)", "8,000.00"],
        ["Subtotal", "2,24,000.00"],
        ["CGST @9%", "20,160.00"],
        ["SGST @9%", "20,160.00"],
        ["Total Amount Due", "2,64,320.00"],
    ]
    t = Table(data, colWidths=[120*mm, 60*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.darkblue),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("FONTNAME", (0,4), (-1,-1), "Helvetica-Bold"),
        ("LINEABOVE", (0,4), (-1,4), 1, colors.black),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#E8F0FE")),
    ]))
    story.append(t)
    story.append(sp(8))
    story.append(Paragraph("Payment due within 30 days. Late payment attracts 2% interest per month.", SMALL))
    story.append(Paragraph("TDS @10% u/s 194I may be deducted. TDS Certificate to be provided.", SMALL))
    doc.build(story)
    print("✓ 2_office_rent_invoice.pdf")


# ── 3. GST Purchase Invoice - Manufacturing Supplier (complex, multi-line) ─────
def pdf3():
    doc = SimpleDocTemplate(f"{OUT}/3_supplier_purchase_invoice.pdf", pagesize=A4, topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)
    story = []
    story.append(Paragraph("TATA STEEL LIMITED", H1))
    story.append(Paragraph("TAX INVOICE (Original for Buyer)", ParagraphStyle("t2", fontSize=10, fontName="Helvetica-Bold")))
    story.append(sp(3))
    story.append(Table([
        ["Reg. Office: Bombay House, 24 Homi Mody St, Mumbai 400001", "Invoice No:", "TSL/NAS/2024/INV/08821"],
        ["GSTIN: 27AAACT2727Q1ZW | PAN: AAACT2727Q", "Date:", "12-Apr-2024"],
        ["HSN Code: 7208 | State: Maharashtra (27)", "Delivery:", "Ex-Works Nashik"],
        ["Plant: Nashik Works, MIDC, Nashik - 422010", "PO Ref:", "BHM/PO/2024/156"],
    ], colWidths=[110*mm, 30*mm, 60*mm]))
    story.append(hr())
    story.append(Paragraph("<b>Buyer:</b> Bharat Manufacturing Co, Plot 45, MIDC Industrial Area, Nashik - 422010 | GSTIN: 27AABCB1234M1ZY", NORMAL))
    story.append(hr())
    data = [
        ["HSN", "Description", "Qty (MT)", "Rate/MT (₹)", "Value (₹)", "CGST\n9%", "SGST\n9%", "Total (₹)"],
        ["7208", "Hot Rolled Steel Coil\nGrade: IS 2062 E250", "25.000", "58,500", "14,62,500", "1,31,625", "1,31,625", "17,25,750"],
        ["7209", "Cold Rolled Steel Sheet\nThk: 1.5mm x 1250mm", "10.500", "72,000", "7,56,000", "68,040", "68,040", "8,92,080"],
        ["7210", "Galvanised Steel Coil\nZ200 coating", "8.000", "85,000", "6,80,000", "61,200", "61,200", "8,02,400"],
        ["", "", "", "Subtotal", "28,98,500", "2,60,865", "2,60,865", "34,20,230"],
        ["", "", "TCS @0.1%", "", "", "", "", "3,420"],
        ["", "", "", "", "", "Grand Total", "", "34,23,650"],
    ]
    t = Table(data, colWidths=[15*mm, 55*mm, 18*mm, 22*mm, 22*mm, 16*mm, 16*mm, 22*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1A3C5E")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,0), 8),
        ("FONTSIZE", (0,1), (-1,-1), 8),
        ("ALIGN", (2,0), (-1,-1), "RIGHT"),
        ("FONTNAME", (0,4), (-1,-1), "Helvetica-Bold"),
        ("LINEABOVE", (0,4), (-1,4), 1, colors.black),
        ("ROWBACKGROUNDS", (0,1), (-1,3), [colors.white, colors.HexColor("#F5F5F5")]),
    ]))
    story.append(t)
    story.append(sp(6))
    story.append(Paragraph("Amount in Words: Thirty Four Lakh Twenty Three Thousand Six Hundred Fifty Rupees Only", SMALL))
    story.append(Paragraph("E-way Bill No: 331024567891 | Vehicle No: MH15BZ4523 | Distance: 45 KM", SMALL))
    doc.build(story)
    print("✓ 3_supplier_purchase_invoice.pdf")


# ── 4. Salary Register / Payroll Statement ────────────────────────────────────
def pdf4():
    doc = SimpleDocTemplate(f"{OUT}/4_salary_register_april2024.pdf", pagesize=A4, topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)
    story = []
    story.append(Paragraph("ACME IT SOLUTIONS PVT LTD", H1))
    story.append(Paragraph("SALARY REGISTER — APRIL 2024", ParagraphStyle("t3", fontSize=12, fontName="Helvetica-Bold", alignment=TA_CENTER)))
    story.append(sp(4))
    story.append(Table([
        ["Company GSTIN:", "27AABCU9603R1ZX", "Month:", "April 2024"],
        ["PAN:", "AABCU9603R", "Processed On:", "30-Apr-2024"],
        ["Bank:", "ICICI Bank - Pune Main", "Payment Date:", "01-May-2024"],
    ], colWidths=[35*mm, 60*mm, 35*mm, 60*mm]))
    story.append(hr())
    data = [
        ["#", "Employee Name", "Designation", "Basic (₹)", "HRA (₹)", "Allowances (₹)", "Gross (₹)", "TDS (₹)", "Net Pay (₹)"],
        ["1", "Rahul Verma", "Sr. Engineer", "75,000", "30,000", "15,000", "1,20,000", "12,000", "1,08,000"],
        ["2", "Anita Sharma", "Product Manager", "95,000", "38,000", "20,000", "1,53,000", "18,000", "1,35,000"],
        ["3", "Vikram Singh", "DevOps Lead", "85,000", "34,000", "17,000", "1,36,000", "14,500", "1,21,500"],
        ["4", "Priya Nair", "QA Engineer", "60,000", "24,000", "12,000", "96,000", "8,000", "88,000"],
        ["5", "Suresh Babu", "Frontend Dev", "65,000", "26,000", "13,000", "1,04,000", "9,500", "94,500"],
        ["6", "Meena Pillai", "HR Manager", "70,000", "28,000", "14,000", "1,12,000", "11,000", "1,01,000"],
        ["7", "Karan Malhotra", "Sales Manager", "72,000", "28,800", "25,000", "1,25,800", "13,000", "1,12,800"],
        ["8", "Deepa Iyer", "Finance Analyst", "68,000", "27,200", "13,000", "1,08,200", "10,500", "97,700"],
        ["", "", "", "", "", "TOTAL", "9,55,000", "96,500", "8,58,500"],
    ]
    t = Table(data, colWidths=[8*mm, 38*mm, 30*mm, 18*mm, 18*mm, 22*mm, 20*mm, 16*mm, 20*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2E7D32")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 7.5),
        ("ALIGN", (3,0), (-1,-1), "RIGHT"),
        ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
        ("LINEABOVE", (0,-1), (-1,-1), 1.5, colors.black),
        ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#F1F8E9")]),
    ]))
    story.append(t)
    story.append(sp(6))
    story.append(Paragraph("Prepared by: Finance Dept | Approved by: Amit Kumar, Company Admin", SMALL))
    story.append(Paragraph("Provident Fund (12% employer) paid separately via EPFO portal.", SMALL))
    doc.build(story)
    print("✓ 4_salary_register_april2024.pdf")


# ── 5. Internet / SaaS Subscription Invoice (Jio/Airtel style) ───────────────
def pdf5():
    doc = SimpleDocTemplate(f"{OUT}/5_internet_subscription_invoice.pdf", pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm)
    story = []
    story.append(Paragraph("Reliance Jio Infocomm Limited", H1))
    story.append(Paragraph("TAX INVOICE / BILL OF SUPPLY", ParagraphStyle("t4", fontSize=10, fontName="Helvetica-Bold", textColor=colors.HexColor("#0066CC"))))
    story.append(sp(4))
    story.append(Table([
        ["GSTIN: 27AAACR4849R1ZP", "Invoice No:", "JIO/B2B/MUM/APR24/448821"],
        ["Maker Chambers IV, Nariman Point, Mumbai 400021", "Bill Date:", "01-Apr-2024"],
        ["Customer ID: BUS-PUN-002241", "Bill Period:", "Apr 1 – Apr 30, 2024"],
        ["SAC: 998431", "Due Date:", "21-Apr-2024"],
    ], colWidths=[95*mm, 35*mm, 70*mm]))
    story.append(hr())
    story.append(Paragraph("<b>Account:</b> Acme IT Solutions Pvt Ltd | Cybercity, Pune - 411014 | GSTIN: 27AABCU9603R1ZX", NORMAL))
    story.append(hr())
    data = [
        ["Service", "Plan", "Qty", "Rate (₹)", "Amount (₹)"],
        ["JioFiber Business 1 Gbps", "Enterprise Annual", "1", "12,499.00", "12,499.00"],
        ["Static IP Addresses (x5)", "Add-on", "5", "500.00", "2,500.00"],
        ["Cloud Storage 10TB", "Add-on", "1", "2,000.00", "2,000.00"],
        ["Priority Support SLA", "Gold Plan", "1", "1,500.00", "1,500.00"],
        ["", "", "", "Subtotal", "18,499.00"],
        ["", "", "", "IGST @18%", "3,329.82"],
        ["", "", "", "Round Off", "-0.82"],
        ["", "", "", "Total Due", "21,828.00"],
    ]
    t = Table(data, colWidths=[80*mm, 35*mm, 15*mm, 30*mm, 40*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0066CC")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ALIGN", (2,0), (-1,-1), "RIGHT"),
        ("FONTNAME", (3,5), (-1,-1), "Helvetica-Bold"),
        ("LINEABOVE", (0,5), (-1,5), 1, colors.grey),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#E3F2FD")),
        ("ROWBACKGROUNDS", (0,1), (-1,4), [colors.white, colors.HexColor("#F8F9FA")]),
    ]))
    story.append(t)
    story.append(sp(6))
    story.append(Paragraph("Pay via NEFT/RTGS: ICICI Bank | A/c: 628005502321 | IFSC: ICIC0000104", SMALL))
    story.append(Paragraph("For disputes: enterprise.support@jio.com | 1800-889-9999 (Toll Free)", SMALL))
    doc.build(story)
    print("✓ 5_internet_subscription_invoice.pdf")


# ── 6. Consulting / Professional Services Invoice ─────────────────────────────
def pdf6():
    doc = SimpleDocTemplate(f"{OUT}/6_consulting_services_invoice.pdf", pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm)
    story = []
    story.append(Paragraph("Deloitte Touche Tohmatsu India LLP", H1))
    story.append(Paragraph("PROFESSIONAL SERVICES INVOICE", ParagraphStyle("t5", fontSize=10, fontName="Helvetica-Bold", textColor=colors.HexColor("#86BC25"))))
    story.append(sp(4))
    story.append(Table([
        ["LLPIN: AAB-8303 | GSTIN: 27AABFD5071N2ZE", "Invoice No:", "DTTI/PUN/FY24/003821"],
        ["7, Lodha Excelus, Apollo Mills Compound", "Date:", "15-Apr-2024"],
        ["N.M. Joshi Marg, Mahalaxmi, Mumbai - 400011", "Engagement:", "ENG-2024-0192"],
        ["SAC Code: 998311", "PO Ref:", "ACM/PO/2024/044"],
    ], colWidths=[105*mm, 30*mm, 65*mm]))
    story.append(hr())
    story.append(Paragraph("<b>Client:</b> Acme IT Solutions Pvt Ltd | Pune | GSTIN: 27AABCU9603R1ZX", NORMAL))
    story.append(Paragraph("<b>Engagement:</b> Technology Risk Advisory & IT Controls Assessment — Q1 FY2024-25", NORMAL))
    story.append(hr())
    data = [
        ["Role", "Consultant", "Days", "Day Rate (₹)", "Amount (₹)"],
        ["Partner", "Rajiv Mehta", "3", "1,25,000", "3,75,000"],
        ["Senior Manager", "Pooja Agarwal", "8", "65,000", "5,20,000"],
        ["Consultant", "Nikhil Rao", "15", "28,000", "4,20,000"],
        ["Analyst", "Divya Krishnan", "15", "18,000", "2,70,000"],
        ["Out of Pocket Expenses (Travel+Stay)", "", "", "", "48,500"],
        ["", "", "", "Subtotal", "16,33,500"],
        ["", "", "", "IGST @18%", "2,94,030"],
        ["", "", "", "Total", "19,27,530"],
    ]
    t = Table(data, colWidths=[45*mm, 45*mm, 15*mm, 35*mm, 40*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#86BC25")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ALIGN", (2,0), (-1,-1), "RIGHT"),
        ("FONTNAME", (0,6), (-1,-1), "Helvetica-Bold"),
        ("LINEABOVE", (0,6), (-1,6), 1, colors.grey),
        ("ROWBACKGROUNDS", (0,1), (-1,5), [colors.white, colors.HexColor("#F9FCF4")]),
    ]))
    story.append(t)
    story.append(sp(6))
    story.append(Paragraph("TDS @10% u/s 194J deductible. Net payable after TDS: ₹17,34,777", SMALL))
    story.append(Paragraph("Wire: YES Bank | A/c: 004463700000281 | IFSC: YESB0000044", SMALL))
    story.append(Paragraph("Subject to Mumbai jurisdiction. E&OE.", SMALL))
    doc.build(story)
    print("✓ 6_consulting_services_invoice.pdf")


if __name__ == "__main__":
    pdf1(); pdf2(); pdf3(); pdf4(); pdf5(); pdf6()
    print(f"\nAll PDFs saved to: {OUT}")
