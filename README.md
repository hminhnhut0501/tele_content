# Tele Content Hub

`content_hub_render_free/` is now a standalone app, not just a stripped tab.

It keeps only the content workflow and is prepared for:

- Render free web deploy
- local Alpine/Tailwind assets
- `TG_STRING_SESSION`
- SQLite quick start
- Supabase/Postgres upgrade path

## Product structure

The UI is split into 3 surfaces:

- `Dashboard`
  - operational readiness
  - storage/session/deploy overview
- `Workspace`
  - group, topic, campaign, queue, logs
- `Settings`
  - env readiness and deploy checklist

## What stays

- FastAPI app
- Content Hub UI
- Telegram client layer
- isolated `modules/mod_content_hub.py`
- SQLite runtime for quick start
- Postgres mode when `DATABASE_URL` is present

## What is removed

- mirror, drip, outreach and other modules
- old multi-tab shell
- dependency on Tailwind CDN

## Asset pipeline

This app now builds CSS locally and serves all core UI assets from `/static`.

Useful commands:

```bash
npm run build:assets
```

This does:

- build Tailwind CSS into `static/dist/app.css`
- copy Alpine runtime into `static/vendor/alpine.min.js`

## Local run

```bash
cd content_hub_render_free
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
npm run build:assets
cp .env.example .env
uvicorn main:app --reload --port 8000
```

## Health and status

- `GET /healthz`
  - lightweight ping endpoint for external cron
- `GET /api/app/status`
  - app mode, env readiness, storage counts, bootstrap migration state

## Database bootstrap and migration path

The clear path for Supabase/Postgres is now:

1. Put `DATABASE_URL` into your environment.
2. Run the bootstrap script once:

```bash
python3 scripts/bootstrap_db.py
```

3. Verify state any time:

```bash
python3 scripts/bootstrap_db.py --check
```

What this does:

- creates `schema_migrations` if missing
- applies the current baseline Content Hub schema
- records bootstrap id `20260703_content_hub_bootstrap_v1`

The web app also reports this in `/api/app/status` through:

- `schema_bootstrap_id`
- `schema_bootstrap_applied`

## Render deploy

1. Point Render at the `content_hub_render_free` root directory.
2. Render build command:
   - `npm install && npm run build:assets && pip install -r requirements.txt`
3. Render start command:
   - `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Set env vars:
   - `TG_API_ID`
   - `TG_API_HASH`
   - `TG_STRING_SESSION`
   - `DATABASE_URL` if you want Supabase durability
   - `RENDER_EXTERNAL_URL` optional, but useful for status/debug
5. Bootstrap the database once against Supabase:
   - `python3 scripts/bootstrap_db.py`
6. Add an external cron ping:
   - `GET /healthz`
   - every `10-14` minutes

## Supabase handoff

1. Create a Supabase project.
2. Copy the pooler `DATABASE_URL`.
3. Put `DATABASE_URL` into Render env vars.
4. Run `python3 scripts/bootstrap_db.py` against that database.
5. Redeploy Render so the app switches to Postgres mode automatically.
5. Open `/api/app/status` and confirm:
   - `db_mode=postgres`
   - `database_url_set=true`
   - `schema_bootstrap_applied=true`

## Important limitation

If `DATABASE_URL` is empty, the app uses SQLite. That is fine for local use or quick tests, but Render free disk is not durable across restart/redeploy.

## Recommended durable path

1. Keep Render free only for app/UI.
2. Store Telegram auth in `TG_STRING_SESSION`.
3. Point `DATABASE_URL` to Supabase pooler.

Recommended Supabase pooler URL:

```text
postgresql://postgres.xxx:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```
