# FinBridge

AI-powered invoice exchange platform — replaces email/WhatsApp invoice sharing with structured, auditable, multi-engine AI extraction and review workflows.

---

## Live Demo

**[https://finbridge-demo.vercel.app](https://finbridge-demo.vercel.app)**

| Role | Email | Password |
|---|---|---|
| Platform Admin | admin@finbridge.com | admin123 |
| Firm Admin | firmadmin@demo.com | firm123 |
| Accountant | accountant@demo.com | acc123 |
| Company Admin | companyadmin@acme.com | company123 |
| Company User | user@acme.com | user123 |

---

## Key Features

- **Multi-engine AI extraction** — Groq Vision (Llama 4 Scout), PyMuPDF, and PaddleOCR run in parallel; results are consensus-merged with per-field confidence scores and a trust score (0–100)
- **Smart auto-routing** — invoices scoring ≥85 are auto-accepted; 60–84 go to the review queue; <60 require mandatory manual review
- **Conflict detection** — field-level disagreements between engines are surfaced as conflicts and highlighted for the reviewer
- **PDF + image support** — live PDF viewer and image viewer inline on the review page
- **Vendor Intelligence** — per-vendor historical stats (avg amount, invoice count, sparkline) with anomaly alerts when current invoice is >1.5× or <0.5× average
- **GST breakdown** — CGST/SGST split shown inline on invoice detail with intra-state badge
- **Bulk accept** — accountants can select multiple invoices from the queue and accept in one click
- **Bank statement processing** — upload a PDF bank statement, all transactions are extracted and auto-categorized
- **Spend insights** — monthly spend charts and category breakdown per company
- **MIS reports** — firm accountants publish reports; companies view them in-app
- **Audit trail** — every upload, correction, accept, and reject is logged with timestamp and user
- **Comment threads** — per-invoice discussion between company and accountant
- **Multi-tenant** — platform admin → firms → companies hierarchy with full role isolation
- **Duplicate detection** — same invoice number + vendor triggers a duplicate warning

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + SQLAlchemy async + asyncpg |
| Database | PostgreSQL (Supabase) |
| Storage | Supabase Storage |
| AI Extraction | Groq (Llama 4 Scout vision), PyMuPDF, PaddleOCR |
| Frontend | React + Vite + Tailwind CSS v4 |
| Auth | JWT (python-jose) |

---

## AI Extraction Pipeline

```
Upload → Preprocess (deskew / denoise / sharpen / contrast)
       ↓
       ├── Groq Vision (Llama 4 Scout) ──────┐
       ├── PyMuPDF text extraction ──────────→ Consensus Engine → Field confidence (0–1)
       └── PaddleOCR fallback ───────────────┘                  → Conflict detection
                                                                 → Trust score (0–100)
                                                                 → Auto-routing:
                                                                     ≥85 → Auto-accepted
                                                                     60–84 → Review queue
                                                                     <60  → Mandatory review
```

---

## End-to-End Demo Flow

1. Log in as **Company Admin** (`companyadmin@acme.com`)
2. Dashboard shows spend insights (monthly chart + category breakdown) and invoice stats
3. Click **Upload Invoice** → drop a PDF or image → watch live AI processing stages
4. View extracted fields with inline confidence scores, conflicts highlighted, trust score ring
5. Audit trail shows the full history of the invoice
6. Log in as **Accountant** (`accountant@demo.com`)
7. Review queue shows invoices sorted by risk level (red/amber/green)
8. Click any invoice → review confidence scores, vendor intel, and PDF viewer → correct fields → Accept or Reject
9. Use checkboxes to bulk-accept multiple low-risk invoices at once
10. Switch back to company admin → invoice status updated, notification received in sidebar
11. Firm Admin uploads MIS report → company sees it in Reports

---

## Roadmap

- Zoho / QuickBooks / Tally export integration
- Mobile PWA for on-the-go uploads
- Advanced MIS report generation with charts
- Payment gateway reconciliation
- Email notifications for status changes
- Recurring invoice detection and auto-matching
- Multi-currency support with live FX rates

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Supabase project (free tier works)
- A Groq API key (free at console.groq.com)

### 1. Clone & configure backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:<password>@<host>:5432/postgres
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
SUPABASE_STORAGE_BUCKET=invoices
SECRET_KEY=your-secret-key-min-32-chars
GROQ_API_KEY=gsk_...
```

### 2. Run database migrations

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
```

### 3. Seed demo data

```bash
cd backend
python seeds/seed.py
```

### 4. Start backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

API docs at: http://localhost:8000/docs

### 5. Start frontend

```bash
cd frontend
npm install
npm run dev
```

App at: http://localhost:5173

---

## Project Structure

```
finbridge/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # FastAPI routes (invoices, firms, companies, reports, notifications)
│   │   ├── models/               # SQLAlchemy models (Invoice, AuditLog, Notification, ...)
│   │   ├── services/extraction/  # Groq, PyMuPDF, OCR extractors + consensus engine
│   │   ├── utils/                # Audit logging, notification helpers
│   │   └── core/                 # Config, database, auth deps
│   ├── seeds/seed.py             # Full demo dataset
│   └── alembic/                  # DB migrations
└── frontend/
    └── src/
        ├── pages/                # company/, accountant/, firm/, admin/
        ├── components/
        │   ├── layout/           # Sidebar (with notifications dropdown), Layout
        │   └── ui/               # TrustScoreBadge, FieldConfidence, AuditTrail, SpendInsights, LiveProcessing
        └── context/              # AuthContext (JWT)
```
