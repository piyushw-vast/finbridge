# FinBridge

**A Multi-Tenant Financial Data Exchange Platform** — AI-powered invoice scanning, multi-role workflows, and financial reconciliation between businesses and accounting firms.

---

## What It Does

Mid-sized businesses exchange invoices, payments, salary registers, and bank statements with accounting firms via email and WhatsApp. FinBridge replaces that chaos with:

- **AI bill scanning** — upload any invoice image or PDF; Groq Vision + OCR extracts all fields in seconds
- **Three-tier tenancy** — Platform Admin → Accounting Firm Admin → Company Admin/Users
- **Accountant review workflow** — review, correct, accept or reject extracted transactions
- **MIS reports** — accountants publish reports; companies can view and download as PDF
- **GST Dashboard** — monthly GST summary, vendor analytics, payment aging
- **Audit trail** — every upload, modification, and acceptance is logged
- **PWA** — installable on mobile for on-the-go invoice uploads

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | FastAPI (Python), SQLAlchemy async, Alembic |
| Database | PostgreSQL |
| AI | Groq Vision API (LLaMA 3.2 Vision), PyMuPDF |
| Auth | JWT, role-based access control |
| Storage | Local filesystem (configurable) |

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- A Groq API key (free at https://console.groq.com)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/piyushw-vast/finbridge.git
cd finbridge
```

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL and GROQ_API_KEY

# Run migrations
alembic upgrade head

# Seed demo data
python seeds/seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```

**Required `.env` values:**

```
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/finbridge
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=any-long-random-string
UPLOAD_DIR=./uploads
```

### 3. Frontend

```bash
cd frontend

npm install

# Start dev server
npm run dev
```

Open http://localhost:5173

---

## Demo Accounts

After running `seed.py`, the following accounts are available:

| Role | Email | Password |
|---|---|---|
| Platform Admin | admin@finbridge.com | Admin@123 |
| Firm Admin | firm@vastaccounting.com | Firm@123 |
| Accountant | accountant@vastaccounting.com | Accountant@123 |
| Company Admin | admin@techcorp.com | Company@123 |
| Company User | user@techcorp.com | User@123 |

---

## Core Features Built

### Must-Have (All Complete)
- Multi-tenant role-based auth across all 3 tenancy levels
- Company onboarding with configurable payment heads and sub-heads by business type
- Invoice upload — purchase, sales, payments, salary registers, bank statements, ledgers
- AI-powered bill scanning with Groq Vision + consensus extraction engine
- Accountant review workflow — refine, correct, accept, reject
- MIS Reports — accountant uploads, company views and downloads as PDF

### Stretch Goals (All Complete)
- PWA — installable on Android/iOS home screen
- Dashboard with insights — cash flow, top expense heads, vendor analytics
- Audit trail — every action logged with actor and timestamp
- Notifications — real-time bell icon, per-event types
- GST Dashboard — CGST/SGST/IGST split, monthly trend, payment aging
- Bulk document upload — bank statements, salary registers (up to 10 files)

---

## Architecture

```
┌─────────────────────────────────────────┐
│              React Frontend              │
│  Company | Accountant | Firm | Admin     │
└──────────────────┬──────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────┐
│           FastAPI Backend                │
│  Auth | Invoices | Reports | Firms       │
└────────┬──────────────────┬─────────────┘
         │                  │
┌────────▼──────┐  ┌────────▼──────────┐
│  PostgreSQL   │  │  Groq Vision API  │
│  (asyncpg)    │  │  AI Extraction    │
└───────────────┘  └───────────────────┘
```

---

## Project Structure

```
finbridge/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # REST endpoints
│   │   ├── models/             # SQLAlchemy models
│   │   ├── core/               # DB, auth, config
│   │   └── main.py
│   ├── alembic/                # DB migrations
│   └── seeds/seed.py           # Demo data
└── frontend/
    └── src/
        ├── pages/
        │   ├── company/        # Company user flows
        │   ├── accountant/     # Review workflow
        │   ├── firm/           # Firm admin
        │   └── admin/          # Platform admin
        └── components/         # Shared UI components
```

---

## What We'd Build Next

- Integration with Zoho Books / Tally / QuickBooks
- Mobile-native app (React Native) for field invoice capture
- Automated bank statement reconciliation with ML categorization
- Multi-currency and forex handling
- Scheduled report generation and email delivery
