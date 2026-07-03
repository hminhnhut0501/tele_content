# Content Hub Only for Render Free

This folder is a separate deployment target focused only on the `content hub` workflow.

## What stays

- FastAPI app
- Content Hub UI
- Telegram client layer
- SQLite-based runtime for quick start

## What is removed

- Auto-discovery of all other modules
- Mirror, drip, harvest, outreach, and other tabs
- Multi-tool shell UI

## Why this layout fits Render free

- Single web service with a single UI
- Very small dependency surface
- `healthz` endpoint for an external cron ping every 10-14 minutes
- Supports `TG_STRING_SESSION` now, so you do not have to rely on a local `.session` file

## Important limitation

Render free web services do not keep a persistent disk. The default SQLite file in `/tmp/content_hub.db` is fine for testing, but it is not durable across restarts or redeploys.

## Recommended production-ish path

1. Keep Render free only for the web app and UI.
2. Use `TG_STRING_SESSION` in environment variables.
3. Set `DATABASE_URL` to Supabase Postgres.

This app is prepared for that direction by isolating:

- `database.py` for storage wiring
- `tg_client.py` for Telegram session handling
- `modules/mod_content_hub.py` as the only business module

The app now supports both modes:

- `SQLite mode`
  - used when `DATABASE_URL` is empty
  - suitable for quick local testing
- `Postgres mode`
  - auto-enabled when `DATABASE_URL` is set
  - intended for Supabase / Render deployment

## Local run

```bash
cd content_hub_render_free
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

## Render deploy

1. Point Render at the `content_hub_render_free` root directory.
2. Set env vars:
   - `TG_API_ID`
   - `TG_API_HASH`
   - `TG_STRING_SESSION`
   - `DATABASE_URL` for Supabase if you want durable storage
3. Add an external cron ping to:
   - `GET /healthz`
   - every `10-14` minutes

## Supabase now

If you set `DATABASE_URL`, the app switches to Postgres mode automatically.

Recommended Supabase pooler URL format:

```text
postgresql://postgres.xxx:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Keep `TG_STRING_SESSION` in Render environment variables so Telegram login does not depend on a local session file.
