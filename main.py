import asyncio
import importlib
import os

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from database import DATABASE_MODE, DATABASE_URL, get_db_connection


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

app = FastAPI(title="Content Hub Only")
templates = Jinja2Templates(directory="templates")
db_conn = get_db_connection()
module = importlib.import_module("modules.mod_content_hub")

if hasattr(module, "router"):
    app.include_router(module.router, prefix="/api/content_hub", tags=["content_hub"])
if hasattr(module, "init_db"):
    module.init_db(db_conn)

db_conn.close()


@app.on_event("startup")
async def startup_module_hooks():
    hook = getattr(module, "on_startup", None)
    if hook is None:
        return
    result = hook()
    if asyncio.iscoroutine(result):
        await result


@app.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"request": request},
    )


@app.get("/healthz")
async def healthz():
    return JSONResponse(
        {
            "ok": True,
            "service": "content_hub_only",
            "db_mode": DATABASE_MODE,
            "db_path": os.getenv("TELEVAULT_DB_PATH", "/tmp/content_hub.db") if DATABASE_MODE == "sqlite" else "",
            "database_url_set": bool(DATABASE_URL),
            "string_session": bool(os.getenv("TG_STRING_SESSION")),
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("TELEVAULT_RELOAD", "0") == "1",
    )
