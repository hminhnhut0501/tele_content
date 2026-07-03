import asyncio
import importlib
import os
from contextlib import closing

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from database import CONTENT_HUB_BOOTSTRAP_ID, DATABASE_MODE, DATABASE_URL, get_db_connection, migration_applied, record_migration


def raise_open_file_limit(min_soft_limit: int = 4096):
    try:
        import resource

        soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
        target = min(max(soft, min_soft_limit), hard)
        if soft < target:
            resource.setrlimit(resource.RLIMIT_NOFILE, (target, hard))
            print(f"Raised open file limit: {soft} -> {target}")
    except Exception as exc:
        print(f"Could not raise open file limit: {exc}")


raise_open_file_limit()

app = FastAPI(title="Content Hub API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
if os.path.isdir("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")
module = importlib.import_module("modules.mod_content_hub")

if hasattr(module, "router"):
    app.include_router(module.router, prefix="/api/content_hub", tags=["content_hub"])


@app.on_event("startup")
async def startup_module_hooks():
    db_conn = get_db_connection()
    try:
        if hasattr(module, "init_db"):
            module.init_db(db_conn)
        record_migration(db_conn, CONTENT_HUB_BOOTSTRAP_ID, note="Baseline schema bootstrap for content_hub_render_free")
    finally:
        db_conn.close()
    hook = getattr(module, "on_startup", None)
    if hook is None:
        return
    result = hook()
    if asyncio.iscoroutine(result):
        await result


@app.get("/")
async def home_page():
    return JSONResponse(
        {
            "ok": True,
            "service": "content_hub_api",
            "message": "Backend is running. Use /admin to open the UI redirect target.",
            "render_external_url": os.getenv("RENDER_EXTERNAL_URL", "").strip(),
            "admin_ui_url_set": bool(os.getenv("ADMIN_UI_URL", "").strip()),
        }
    )


@app.get("/admin")
async def admin_page():
    admin_ui_url = os.getenv("ADMIN_UI_URL", "").strip()
    return JSONResponse(
        {
            "ok": bool(admin_ui_url),
            "service": "content_hub_api",
            "message": "Admin landing page. Open the UI URL below if it is set.",
            "admin_ui_url_set": bool(admin_ui_url),
            "admin_ui_url": admin_ui_url or None,
        },
        status_code=200 if admin_ui_url else 400,
    )


@app.get("/healthz")
async def healthz():
    return JSONResponse(
        {
            "ok": True,
            "service": "content_hub_api",
            "db_mode": DATABASE_MODE,
            "db_path": os.getenv("TELEVAULT_DB_PATH", "/tmp/content_hub.db") if DATABASE_MODE == "sqlite" else "",
            "database_url_set": bool(DATABASE_URL),
            "string_session": bool(os.getenv("TG_STRING_SESSION")),
        }
    )


@app.get("/api/app/status")
async def app_status():
    summary = {
        "ok": True,
        "service": "content_hub_api",
        "db_mode": DATABASE_MODE,
        "db_path": os.getenv("TELEVAULT_DB_PATH", "/tmp/content_hub.db") if DATABASE_MODE == "sqlite" else "",
        "database_url_set": bool(DATABASE_URL),
        "string_session": bool(os.getenv("TG_STRING_SESSION")),
        "tg_api_id_set": bool(os.getenv("TG_API_ID")),
        "tg_api_hash_set": bool(os.getenv("TG_API_HASH")),
        "render_external_url": os.getenv("RENDER_EXTERNAL_URL", "").strip(),
        "televault_reload": os.getenv("TELEVAULT_RELOAD", "0") == "1",
        "schema_bootstrap_id": CONTENT_HUB_BOOTSTRAP_ID,
        "schema_bootstrap_applied": False,
        "storage": {
            "groups": 0,
            "topics": 0,
            "items": 0,
            "events": 0,
        },
    }
    try:
        with closing(get_db_connection()) as conn:
            summary["schema_bootstrap_applied"] = migration_applied(conn, CONTENT_HUB_BOOTSTRAP_ID)
            summary["storage"]["groups"] = int(conn.execute("SELECT COUNT(*) FROM content_groups").fetchone()[0] or 0)
            summary["storage"]["topics"] = int(conn.execute("SELECT COUNT(*) FROM content_topics").fetchone()[0] or 0)
            summary["storage"]["items"] = int(conn.execute("SELECT COUNT(*) FROM content_items").fetchone()[0] or 0)
            summary["storage"]["events"] = int(conn.execute("SELECT COUNT(*) FROM content_events").fetchone()[0] or 0)
    except Exception as exc:
        summary["ok"] = False
        summary["error"] = str(exc)
    return JSONResponse(summary)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("TELEVAULT_RELOAD", "0") == "1",
    )
