# Supabase Setup Guide

## 1. Create Supabase Project
Go to https://supabase.com → New Project → fill in name and password.

## 2. Enable pgvector
Dashboard → Database → Extensions → search "vector" → Enable

## 3. Create Storage Bucket
Dashboard → Storage → New Bucket → Name: `invoices` → Public: OFF

## 4. Get Your Credentials
Dashboard → Settings → API:
- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = anon/public key
- `SUPABASE_SERVICE_KEY` = service_role key (keep secret)

Dashboard → Settings → Database → Connection String → URI (Mode: Transaction):
- Replace `[YOUR-PASSWORD]` with your DB password
- This is your `DATABASE_URL` (replace `postgresql://` with `postgresql+asyncpg://`)

## 5. Create .env
```bash
cp .env.example .env
# Fill in all values from above
```

## 6. Install psycopg2 for Alembic (sync driver)
```bash
pip install psycopg2-binary
```

## 7. Run Migrations
```bash
alembic upgrade head
```

## 8. Seed Demo Data
```bash
python seeds/seed.py
```

## 9. Start Backend
```bash
uvicorn app.main:app --reload
# API docs at http://localhost:8000/docs
```
