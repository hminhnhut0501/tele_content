from fastapi import APIRouter
from pydantic import BaseModel, Field
from contextlib import closing
from collections import deque, defaultdict
from datetime import datetime, timedelta
import asyncio
import time
import json
import re
import random
import sqlite3
import threading
from zoneinfo import ZoneInfo
from database import get_db_connection
from tg_client import get_tg_client
from telethon.tl.functions.messages import GetForumTopicsRequest, ForwardMessagesRequest
try:
    from telethon.tl.functions.messages import GetForumTopicsByIDRequest
except Exception:
    GetForumTopicsByIDRequest = None
try:
    from telethon.tl.types import MessageActionTopicCreate
except Exception:
    MessageActionTopicCreate = None


class QueuePolicyReq(BaseModel):
    max_concurrency: int = Field(1, ge=1, le=2)


class GroupReq(BaseModel):
    name: str = ""
    source_key: str = ""
    source_link: str = ""
    target_link: str = ""


class GroupAutoReq(BaseModel):
    auto_enabled: bool = False
    auto_slots: str = ""
    auto_pick_count: int = 1
    auto_strategy: str = "round_robin"


class TopicReq(BaseModel):
    name: str = ""
    topic_link: str = ""
    source_topic_id: int = 0
    target_topic_id: int = 0
    last_msg_id: int = 0
    sort_order: int = 0


class TopicRenameReq(BaseModel):
    name: str = ""


class ItemReq(BaseModel):
    title: str = ""
    source_start_link: str = ""
    source_end_link: str = ""
    follow_latest: bool = True
    target_link: str = ""
    caption: str = ""
    group_mode: str = "keep"
    order_mode: str = "auto"
    batch_size: int = 1
    delay_min: int = 1
    delay_max: int = 7

router = APIRouter()
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

MODULE_INFO = {
    "id": "content_hub",
    "name": "🧭 Content Hub",
    "html_file": "tab_content_hub.html",
    "color": "teal",
    "order": 2,
}


def now_ts() -> int:
    return int(time.time())


def init_db(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS content_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            source_key TEXT NOT NULL,
            source_link TEXT DEFAULT '',
            target_link TEXT DEFAULT '',
            rr_cursor_topic_id INTEGER DEFAULT 0,
            auto_enabled INTEGER DEFAULT 0,
            auto_slots TEXT DEFAULT '',
            auto_pick_count INTEGER DEFAULT 1,
            auto_strategy TEXT DEFAULT 'round_robin',
            auto_next_run_at INTEGER DEFAULT 0,
            auto_last_run_at INTEGER DEFAULT 0,
            auto_last_slot_key TEXT DEFAULT '',
            auto_last_result TEXT DEFAULT '',
            auto_last_error TEXT DEFAULT '',
            status INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            updated_at INTEGER DEFAULT (strftime('%s','now'))
        )"""
    )
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_content_groups_source_key ON content_groups(source_key)")
    conn.commit()
    for column_def in (
        "rr_cursor_topic_id INTEGER DEFAULT 0",
        "auto_enabled INTEGER DEFAULT 0",
        "auto_slots TEXT DEFAULT ''",
        "auto_pick_count INTEGER DEFAULT 1",
        "auto_strategy TEXT DEFAULT 'round_robin'",
        "auto_next_run_at INTEGER DEFAULT 0",
        "auto_last_run_at INTEGER DEFAULT 0",
        "auto_last_slot_key TEXT DEFAULT ''",
        "auto_last_result TEXT DEFAULT ''",
        "auto_last_error TEXT DEFAULT ''",
    ):
        try:
            conn.execute(f"ALTER TABLE content_groups ADD COLUMN {column_def}")
        except Exception:
            pass

    conn.execute(
        """CREATE TABLE IF NOT EXISTS content_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            source_topic_id INTEGER DEFAULT 0,
            target_topic_id INTEGER DEFAULT 0,
            target_link_seed TEXT DEFAULT '',
            last_msg_id INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            status INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            updated_at INTEGER DEFAULT (strftime('%s','now'))
        )"""
    )
    try:
        conn.execute("ALTER TABLE content_topics ADD COLUMN target_link_seed TEXT DEFAULT ''")
    except Exception:
        pass
    conn.execute("CREATE INDEX IF NOT EXISTS idx_content_topics_group ON content_topics(group_id, sort_order, id)")
    conn.commit()

    conn.execute(
        """CREATE TABLE IF NOT EXISTS content_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            topic_id INTEGER NOT NULL,
            title TEXT DEFAULT '',
            body TEXT DEFAULT '',
            source_start_link TEXT DEFAULT '',
            source_end_link TEXT DEFAULT '',
            follow_latest INTEGER DEFAULT 1,
            target_link TEXT DEFAULT '',
            caption TEXT DEFAULT '',
            group_mode TEXT DEFAULT 'keep',
            order_mode TEXT DEFAULT 'auto',
            batch_size INTEGER DEFAULT 0,
            delay_min INTEGER DEFAULT 1,
            delay_max INTEGER DEFAULT 7,
            enabled INTEGER DEFAULT 1,
            status TEXT DEFAULT 'Nháp',
            schedule_enabled INTEGER DEFAULT 0,
            schedule_slots TEXT DEFAULT '',
            next_run_at INTEGER DEFAULT 0,
            last_run_at INTEGER DEFAULT 0,
            last_result TEXT DEFAULT '',
            last_msg_id INTEGER DEFAULT 0,
            sent_count INTEGER DEFAULT 0,
            sent_units_count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            updated_at INTEGER DEFAULT (strftime('%s','now'))
        )"""
    )
    try:
        conn.execute("ALTER TABLE content_items ADD COLUMN sent_units_count INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE content_items ADD COLUMN follow_latest INTEGER DEFAULT 1")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE content_items ADD COLUMN last_msg_id INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        rows = conn.execute(
            """SELECT id, source_start_link
               FROM content_items
               WHERE COALESCE(last_msg_id,0)=0 AND COALESCE(sent_count,0)>0"""
        ).fetchall()
        for item_id, source_start_link in rows:
            _, _, start_msg_id = parse_topic_msg_link(source_start_link)
            if int(start_msg_id or 0) > 0:
                conn.execute("UPDATE content_items SET last_msg_id=? WHERE id=?", (int(start_msg_id), int(item_id)))
    except Exception:
        pass
    conn.execute("CREATE INDEX IF NOT EXISTS idx_content_items_topic ON content_items(topic_id, id DESC)")
    conn.commit()

    conn.execute(
        """CREATE TABLE IF NOT EXISTS content_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER DEFAULT 0,
            topic_id INTEGER DEFAULT 0,
            group_id INTEGER DEFAULT 0,
            level TEXT DEFAULT 'info',
            code TEXT DEFAULT '',
            message TEXT DEFAULT '',
            payload TEXT DEFAULT '',
            created_at INTEGER DEFAULT (strftime('%s','now'))
        )"""
    )
    try:
        conn.execute("ALTER TABLE content_events ADD COLUMN group_id INTEGER DEFAULT 0")
    except Exception:
        pass
    conn.execute("CREATE INDEX IF NOT EXISTS idx_content_events_item ON content_events(item_id, id DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_content_events_group ON content_events(group_id, id DESC)")
    conn.commit()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS content_group_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            slot_key TEXT NOT NULL,
            scheduled_at INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            strategy TEXT DEFAULT 'round_robin',
            pick_count INTEGER DEFAULT 1,
            selected_topic_ids TEXT DEFAULT '',
            queued_items INTEGER DEFAULT 0,
            last_error TEXT DEFAULT '',
            created_at INTEGER DEFAULT (strftime('%s','now')),
            updated_at INTEGER DEFAULT (strftime('%s','now')),
            started_at INTEGER DEFAULT 0,
            finished_at INTEGER DEFAULT 0,
            UNIQUE(group_id, slot_key)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_content_group_runs_group ON content_group_runs(group_id, status, created_at DESC)")
    conn.commit()


# ---------------- queue + scheduler ----------------
content_queue = deque()
content_queued_ids = set()
content_running_ids = set()
content_item_tasks = {}
content_queue_task = None
content_queue_lock = asyncio.Lock()
content_scheduler_task = None
content_scheduler_lock = asyncio.Lock()
content_auto_queue = deque()
content_auto_queued_keys = set()
content_auto_running_keys = set()
content_auto_queue_task = None
content_auto_queue_lock = asyncio.Lock()
content_auto_scheduler_task = None
content_auto_scheduler_lock = asyncio.Lock()
CONTENT_MAX_CONCURRENCY = 1
CONTENT_AUTO_MAX_CONCURRENCY = 1
CONTENT_DB_WRITE_LOCK = threading.Lock()
CONTENT_DB_WRITE_ATTEMPTS = 8
CONTENT_DB_LOCK_RETRY_SECONDS = 0.35


def _is_locked_error(exc: Exception) -> bool:
    return "database is locked" in str(exc or "").lower()


def db_write_retry(work, *, attempts: int = CONTENT_DB_WRITE_ATTEMPTS):
    last_exc = None
    for attempt in range(1, max(1, int(attempts)) + 1):
        try:
            with CONTENT_DB_WRITE_LOCK:
                with closing(get_db_connection()) as conn:
                    result = work(conn)
                    conn.commit()
                    return result
        except sqlite3.OperationalError as exc:
            last_exc = exc
            if not _is_locked_error(exc) or attempt >= attempts:
                raise
            time.sleep(CONTENT_DB_LOCK_RETRY_SECONDS * attempt)
    if last_exc:
        raise last_exc
    raise RuntimeError("db_write_retry_failed")


def add_event(
    item_id: int,
    topic_id: int,
    code: str,
    message: str = "",
    level: str = "info",
    payload=None,
    group_id: int = 0,
):
    payload_text = ""
    if payload is not None:
        try:
            payload_text = json.dumps(payload, ensure_ascii=False)[:2000]
        except Exception:
            payload_text = str(payload)[:2000]
    try:
        db_write_retry(
            lambda conn: conn.execute(
                """INSERT INTO content_events (item_id, topic_id, group_id, level, code, message, payload, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item_id,
                    topic_id,
                    int(group_id or 0),
                    level[:20],
                    code[:80],
                    str(message)[:300],
                    payload_text,
                    now_ts(),
                ),
            )
        )
    except Exception:
        # Event logging must not break the worker flow.
        return


def _fetch_all_dicts(sql: str, params=()):
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute(sql, params)
        cols = [d[0] for d in c.description]
        return [dict(zip(cols, row)) for row in c.fetchall()]


def _fetch_one_dict(sql: str, params=()):
    rows = _fetch_all_dicts(sql, params)
    return rows[0] if rows else None


def _group_stats(group_row: dict) -> dict:
    group_id = int(group_row["id"])
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM content_topics WHERE group_id=?", (group_id,))
        topic_count = int((c.fetchone() or [0])[0] or 0)
        c.execute("SELECT id, status, enabled, last_result FROM content_items WHERE group_id=?", (group_id,))
        items = c.fetchall()
        next_run_at = int(group_row.get("auto_next_run_at") or 0)
    item_count = len(items)
    done_count = sum(1 for _, status, _, _ in items if str(status or "") == "Đã gửi Telegram")
    running_count = sum(1 for iid, _, _, _ in items if int(iid or 0) in content_running_ids)
    error_count = sum(1 for _, status, _, _ in items if str(status or "") == "Lỗi")
    queued_count = sum(
        1
        for iid, status, _, _ in items
        if int(iid or 0) in content_queued_ids or str(status or "") == "Đang xếp hàng"
    )
    enabled_items = [(iid, status, last_result) for iid, status, enabled, last_result in items if int(enabled or 0) == 1]
    exhausted_count = sum(
        1
        for _, status, last_result in enabled_items
        if str(status or "") == "Không có message phù hợp" or str(last_result or "").strip() == "no_messages"
    )
    auto_enabled = int(group_row.get("auto_enabled") or 0) == 1
    auto_attention = ""
    if auto_enabled and running_count == 0 and queued_count == 0:
        if not enabled_items:
            auto_attention = "no_campaign"
        elif exhausted_count == len(enabled_items):
            auto_attention = "content_exhausted"
    auto_slots = [s.strip() for s in str(group_row.get("auto_slots") or "").split(",") if s.strip()]
    now_value = now_ts()
    next_run_in_sec = max(0, next_run_at - now_value) if next_run_at else 0
    return {
        **group_row,
        "topic_count": topic_count,
        "item_count": item_count,
        "done_count": done_count,
        "running_count": running_count,
        "error_count": error_count,
        "queued_count": queued_count,
        "enabled_item_count": len(enabled_items),
        "exhausted_item_count": exhausted_count,
        "auto_attention": auto_attention,
        "auto_slots_count": len(auto_slots),
        "auto_next_run_in_sec": next_run_in_sec,
    }


def _group_query():
    rows = _fetch_all_dicts("SELECT * FROM content_groups WHERE status=1 ORDER BY id DESC")
    return [_group_stats(row) for row in rows]


def _topic_query(group_id: int):
    rows = _fetch_all_dicts(
        """SELECT t.*,
                  (SELECT COUNT(*) FROM content_items i WHERE i.topic_id=t.id) AS item_count,
                  (SELECT COUNT(*) FROM content_items i WHERE i.topic_id=t.id AND i.status='Đã gửi Telegram') AS done_count,
                  (SELECT COUNT(*) FROM content_items i WHERE i.topic_id=t.id AND i.status='Lỗi') AS error_count
           FROM content_topics t
           WHERE t.group_id=?
           ORDER BY t.sort_order ASC, t.id ASC""",
        (int(group_id),),
    )
    for row in rows:
        topic_id = int(row["id"])
        topic_items = _fetch_all_dicts("SELECT id, status FROM content_items WHERE topic_id=?", (topic_id,))
        row["is_running_topic"] = any(int(it.get("id") or 0) in content_running_ids for it in topic_items)
        row["queued_count"] = sum(
            1
            for it in topic_items
            if int(it.get("id") or 0) in content_queued_ids or str(it.get("status") or "") == "Đang xếp hàng"
        )
    return rows


def _item_query(topic_id: int):
    return _fetch_all_dicts("SELECT * FROM content_items WHERE topic_id=? ORDER BY id DESC", (int(topic_id),))


def parse_schedule_slots(raw: str):
    import re
    text = str(raw or "").strip()
    if not text:
        return []
    slots = []
    for token in re.split(r"[,\n;]+", text):
        token = token.strip()
        if not token:
            continue
        m = re.match(r"^(\d{1,2}):(\d{2})$", token)
        if not m:
            continue
        h, mm = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mm <= 59:
            slots.append(f"{h:02d}:{mm:02d}")
    return sorted(set(slots))


def compute_next_run_at(slot_list, now_value=None):
    if not slot_list:
        return 0
    now_dt = datetime.fromtimestamp(int(now_value or now_ts()), tz=VN_TZ).replace(second=0, microsecond=0)
    candidates = []
    for slot in slot_list:
        h, m = [int(x) for x in slot.split(":")]
        dt = now_dt.replace(hour=h, minute=m, second=0, microsecond=0)
        if dt < now_dt:
            dt += timedelta(days=1)
        candidates.append(int(dt.timestamp()))
    return min(candidates) if candidates else 0


def format_slot_key(ts_value: int, group_id: int) -> str:
    dt = datetime.fromtimestamp(int(ts_value or 0), tz=VN_TZ)
    return f"{dt:%Y%m%d_%H%M}_g{int(group_id or 0)}"


def format_slot_label(ts_value: int) -> str:
    dt = datetime.fromtimestamp(int(ts_value or 0), tz=VN_TZ)
    return dt.strftime("%d/%m %H:%M")


def next_slot_after(slots, base_ts):
    return compute_next_run_at(slots, int(base_ts or now_ts()))


def normalize_auto_strategy(raw: str) -> str:
    val = str(raw or "round_robin").strip().lower()
    return val if val in {"round_robin", "random"} else "round_robin"


def clamp_auto_pick_count(value):
    try:
        return max(1, min(50, int(value or 1)))
    except Exception:
        return 1


def ensure_future_slot(slots, base_ts: int, fallback_ts: int | None = None):
    slots = parse_schedule_slots(",".join(slots)) if isinstance(slots, (list, tuple)) else parse_schedule_slots(slots or "")
    if not slots:
        return 0
    now_value = int(base_ts or now_ts())
    next_run_at = compute_next_run_at(slots, now_value)
    if next_run_at > now_value:
        return next_run_at
    if fallback_ts is not None:
        next_run_at = compute_next_run_at(slots, int(fallback_ts))
        if next_run_at > now_value:
            return next_run_at
    for delta in (60, 3600, 86400):
        next_run_at = compute_next_run_at(slots, now_value + delta)
        if next_run_at > now_value:
            return next_run_at
    return next_run_at


async def normalize_schedule_timezones():
    now_value = now_ts()
    with closing(get_db_connection()) as conn:
        c = conn.cursor()

        c.execute("SELECT id, schedule_slots FROM content_items WHERE schedule_enabled=1")
        item_rows = c.fetchall()
        for item_id, slots_raw in item_rows:
            slots = parse_schedule_slots(slots_raw or "")
            next_run_at = compute_next_run_at(slots, now_value) if slots else 0
            conn.execute(
                "UPDATE content_items SET next_run_at=?, updated_at=? WHERE id=?",
                (int(next_run_at), now_ts(), int(item_id)),
            )

        c.execute("SELECT id, auto_slots FROM content_groups WHERE auto_enabled=1")
        group_rows = c.fetchall()
        for group_id, slots_raw in group_rows:
            slots = parse_schedule_slots(slots_raw or "")
            c.execute("SELECT auto_next_run_at FROM content_groups WHERE id=?", (int(group_id),))
            current_next = int(((c.fetchone() or [0])[0]) or 0)
            if slots and current_next <= 0:
                next_run_at = ensure_future_slot(slots, now_value)
                conn.execute(
                    "UPDATE content_groups SET auto_next_run_at=?, updated_at=? WHERE id=?",
                    (int(next_run_at), now_ts(), int(group_id)),
                )

        conn.execute("DELETE FROM content_group_runs WHERE status IN ('pending', 'queued')")
        conn.commit()


async def ensure_content_worker():
    global content_queue_task
    async with content_queue_lock:
        await recover_content_queue_from_db()
        if content_queue_task is None or content_queue_task.done():
            content_queue_task = asyncio.create_task(process_content_queue())


async def ensure_content_scheduler():
    global content_scheduler_task
    async with content_scheduler_lock:
        if content_scheduler_task is None or content_scheduler_task.done():
            content_scheduler_task = asyncio.create_task(process_content_scheduler())


async def ensure_content_auto_worker():
    global content_auto_queue_task
    async with content_auto_queue_lock:
        if content_auto_queue_task is None or content_auto_queue_task.done():
            content_auto_queue_task = asyncio.create_task(process_content_auto_queue())


async def ensure_content_auto_scheduler():
    global content_auto_scheduler_task
    async with content_auto_scheduler_lock:
        if content_auto_scheduler_task is None or content_auto_scheduler_task.done():
            content_auto_scheduler_task = asyncio.create_task(process_content_auto_scheduler())


async def process_content_queue():
    while True:
        try:
            if not content_queue:
                await asyncio.sleep(2)
                continue

            item_id = int(content_queue.popleft() or 0)
            content_queued_ids.discard(item_id)
            if item_id <= 0:
                continue
            if item_id in content_running_ids:
                continue

            item = await _load_item_row(item_id)
            if not item:
                db_write_retry(
                    lambda conn: conn.execute(
                        "UPDATE content_items SET status=?, updated_at=? WHERE id=?",
                        ("Lỗi", now_ts(), item_id),
                    )
                )
                continue

            await run_item(item, mode="one_shot")
        except asyncio.CancelledError:
            raise
        except Exception:
            await asyncio.sleep(2)


async def process_content_scheduler():
    while True:
        try:
            now_value = now_ts()
            with closing(get_db_connection()) as conn:
                c = conn.cursor()
                c.execute(
                    """SELECT *
                       FROM content_items
                       WHERE schedule_enabled=1
                       ORDER BY COALESCE(next_run_at, 0) ASC, id ASC"""
                )
                items = [dict(zip([d[0] for d in c.description], row)) for row in c.fetchall()]

            for item in items:
                item_id = int(item.get("id") or 0)
                slots = parse_schedule_slots(item.get("schedule_slots") or "")
                if not slots:
                    continue
                next_run_at = int(item.get("next_run_at") or 0)
                if next_run_at <= 0:
                    next_run_at = ensure_future_slot(slots, now_value, fallback_ts=next_run_at)
                    db_write_retry(
                        lambda conn: conn.execute(
                            "UPDATE content_items SET next_run_at=?, updated_at=? WHERE id=?",
                            (int(next_run_at), now_ts(), item_id),
                        )
                    )
                    continue
                if next_run_at > now_value:
                    continue
                if item_id in content_running_ids or item_id in content_queued_ids:
                    continue
                await enqueue_item(item_id)
                next_slot = ensure_future_slot(slots, now_value + 60, fallback_ts=next_run_at + 60)
                db_write_retry(
                    lambda conn: conn.execute(
                        """UPDATE content_items
                           SET last_run_at=?, next_run_at=?, updated_at=?
                           WHERE id=?""",
                        (int(now_value), int(next_slot or 0), now_ts(), item_id),
                    )
                )
            await asyncio.sleep(15)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            add_event(0, 0, "CONTENT_SCHEDULER_ERROR", str(e)[:300], "error", {
                "error": str(e)[:500],
            })
            await asyncio.sleep(15)


async def _run_group_auto_cycle(group_row: dict, slot_ts: int, slot_key: str):
    group_id = int(group_row.get("id") or 0)
    pick_count = clamp_auto_pick_count(group_row.get("auto_pick_count") or 1)
    strategy = normalize_auto_strategy(group_row.get("auto_strategy") or "round_robin")
    add_event(0, 0, "GROUP_AUTO_START", f"group={group_id} slot={slot_key}", "info", {
        "group_id": group_id,
        "slot_key": slot_key,
        "slot_ts": int(slot_ts or 0),
        "pick_count": int(pick_count),
        "strategy": strategy,
    }, group_id=group_id)
    def _create_group_run(conn):
        c = conn.cursor()
        c.execute(
            "SELECT id FROM content_group_runs WHERE group_id=? AND slot_key=? LIMIT 1",
            (group_id, slot_key),
        )
        row = c.fetchone()
        if row:
            return ("exists", int(row[0] or 0))
        c.execute(
            """INSERT INTO content_group_runs
               (group_id, slot_key, scheduled_at, status, strategy, pick_count, selected_topic_ids, queued_items, last_error, created_at, updated_at, started_at, finished_at)
               VALUES (?, ?, ?, 'queued', ?, ?, '', 0, '', ?, ?, 0, 0)""",
            (group_id, slot_key, int(slot_ts or 0), strategy, int(pick_count), now_ts(), now_ts()),
        )
        return ("created", int(c.lastrowid or 0))

    state, run_id = db_write_retry(_create_group_run)
    if state == "exists":
        add_event(0, 0, "GROUP_AUTO_SKIP", f"group={group_id} slot={slot_key} reason=slot_already_exists", "warn", {
            "group_id": group_id,
            "slot_key": slot_key,
            "reason": "slot_already_exists",
        }, group_id=group_id)
        return {"ok": True, "skipped": True, "reason": "slot_already_exists", "slot_key": slot_key}
    await ensure_content_auto_worker()
    return {"ok": True, "queued": True, "run_id": run_id, "slot_key": slot_key}


async def process_content_auto_scheduler():
    while True:
        try:
            now_value = now_ts()
            with closing(get_db_connection()) as conn:
                c = conn.cursor()
                c.execute(
                    """SELECT *
                       FROM content_groups
                       WHERE auto_enabled=1
                       ORDER BY COALESCE(auto_next_run_at, 0) ASC, id ASC"""
                )
                groups = [dict(zip([d[0] for d in c.description], row)) for row in c.fetchall()]

            for group_row in groups:
                group_id = int(group_row.get("id") or 0)
                slots = parse_schedule_slots(group_row.get("auto_slots") or "")
                if not slots:
                    continue
                next_run_at = int(group_row.get("auto_next_run_at") or 0)
                if next_run_at <= 0:
                    next_run_at = ensure_future_slot(slots, now_value, fallback_ts=next_run_at)
                    db_write_retry(
                        lambda conn: conn.execute(
                            "UPDATE content_groups SET auto_next_run_at=?, updated_at=? WHERE id=?",
                            (int(next_run_at), now_ts(), group_id),
                        )
                    )
                    add_event(0, 0, "GROUP_AUTO_SKIP", f"group={group_id} reason=next_run_initialized", "info", {
                        "group_id": group_id,
                        "reason": "next_run_initialized",
                        "next_run_at": int(next_run_at),
                    }, group_id=group_id)
                    continue
                if next_run_at > now_value:
                    continue
                slot_key = format_slot_key(next_run_at, group_id)
                await _run_group_auto_cycle(group_row, next_run_at, slot_key)
                next_slot = ensure_future_slot(slots, now_value + 60, fallback_ts=next_run_at + 60)
                db_write_retry(
                    lambda conn: conn.execute(
                        """UPDATE content_groups
                           SET auto_last_run_at=?, auto_last_slot_key=?, auto_next_run_at=?, updated_at=?
                           WHERE id=?""",
                        (int(next_run_at), slot_key, int(next_slot or 0), now_ts(), group_id),
                    )
                )
            await asyncio.sleep(15)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            add_event(0, 0, "GROUP_AUTO_SKIP", f"scheduler_error={str(e)[:180]}", "error", {
                "reason": "scheduler_error",
                "error": str(e)[:500],
            })
            await asyncio.sleep(15)


async def process_content_auto_queue():
    while True:
        try:
            with closing(get_db_connection()) as conn:
                c = conn.cursor()
                c.execute(
                    """SELECT *
                       FROM content_group_runs
                       WHERE status IN ('queued', 'pending')
                       ORDER BY created_at ASC, id ASC
                       LIMIT 1"""
                )
                row = c.fetchone()
                cols = [d[0] for d in c.description] if c.description else []
                run_row = dict(zip(cols, row)) if row else None
            if not run_row:
                await asyncio.sleep(3)
                continue

            run_id = int(run_row.get("id") or 0)
            group_id = int(run_row.get("group_id") or 0)
            slot_key = str(run_row.get("slot_key") or "")
            strategy = normalize_auto_strategy(run_row.get("strategy") or "round_robin")
            pick_count = clamp_auto_pick_count(run_row.get("pick_count") or 1)

            with CONTENT_DB_WRITE_LOCK:
                with closing(get_db_connection()) as conn:
                    conn.execute(
                        "UPDATE content_group_runs SET status='running', started_at=?, updated_at=? WHERE id=?",
                        (now_ts(), now_ts(), run_id),
                    )
                    conn.commit()
                    c = conn.cursor()
                    c.execute("SELECT * FROM content_groups WHERE id=? LIMIT 1", (group_id,))
                    g_row = c.fetchone()
                    g_cols = [d[0] for d in c.description] if c.description else []
                    group_row = dict(zip(g_cols, g_row)) if g_row else None

            if not group_row:
                raise RuntimeError("Group không tồn tại")
            if int(group_row.get("status") or 0) != 1:
                raise RuntimeError("Group đã bị tắt")

            select_out = await select_group_topics(group_id, pick_count, strategy)
            if not select_out.get("ok"):
                raise RuntimeError(str(select_out.get("error") or "Không chọn được topic"))
            topic_ids = [int(x) for x in select_out.get("selected_topic_ids") or [] if int(x or 0) > 0]
            if not topic_ids:
                add_event(0, 0, "GROUP_AUTO_SKIP", f"group={group_id} slot={slot_key} reason=no_topics", "warn", {
                    "group_id": group_id,
                    "slot_key": slot_key,
                    "reason": "no_topics",
                }, group_id=group_id)
                raise RuntimeError("Group chưa có topic bật để chạy")

            enqueue_out = await enqueue_items_for_topics(group_id, topic_ids)
            queued_items = int(enqueue_out.get("queued") or 0)
            selected_text = ",".join(str(x) for x in topic_ids)
            db_write_retry(
                lambda conn: conn.execute(
                    """UPDATE content_group_runs
                       SET status='done', selected_topic_ids=?, queued_items=?, finished_at=?, updated_at=?, last_error=''
                       WHERE id=?""",
                    (selected_text, queued_items, now_ts(), now_ts(), run_id),
                )
            )
            db_write_retry(
                lambda conn: conn.execute(
                    """UPDATE content_groups
                       SET auto_last_result=?, auto_last_error='', updated_at=?
                       WHERE id=?""",
                    (f"queued={queued_items},topics={len(topic_ids)},strategy={strategy}", now_ts(), group_id),
                )
            )
            add_event(0, 0, "GROUP_AUTO_OK", f"group={group_id} topics={selected_text} queued={queued_items}", "ok", {
                "group_id": group_id,
                "slot_key": slot_key,
                "topics": topic_ids,
                "queued_items": queued_items,
                "strategy": strategy,
            }, group_id=group_id)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            try:
                run_id = int(run_row.get("id") or 0) if 'run_row' in locals() and run_row else 0
                group_id = int(run_row.get("group_id") or 0) if 'run_row' in locals() and run_row else 0
                add_event(0, 0, "GROUP_AUTO_SKIP", f"group={group_id} slot={slot_key} reason={str(e)[:180]}", "warn", {
                    "group_id": group_id,
                    "slot_key": slot_key,
                    "reason": str(e)[:300],
                }, group_id=group_id)
                if run_id:
                    db_write_retry(
                        lambda conn: conn.execute(
                            "UPDATE content_group_runs SET status='error', last_error=?, finished_at=?, updated_at=? WHERE id=?",
                            (str(e)[:300], now_ts(), now_ts(), run_id),
                        )
                    )
                if group_id:
                    db_write_retry(
                        lambda conn: conn.execute(
                            "UPDATE content_groups SET auto_last_error=?, updated_at=? WHERE id=?",
                            (str(e)[:300], now_ts(), group_id),
                        )
                    )
            except Exception:
                pass
            await asyncio.sleep(3)


async def on_startup():
    try:
        await normalize_schedule_timezones()
        await ensure_content_worker()
        await ensure_content_scheduler()
        await ensure_content_auto_worker()
        await ensure_content_auto_scheduler()
    except Exception as e:
        print(f"⚠️ Content Hub startup lỗi: {e}")


async def recover_content_queue_from_db():
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute(
            """SELECT id
               FROM content_items
               WHERE status='Đang xếp hàng'
               ORDER BY updated_at ASC, id ASC"""
        )
        rows = [int(r[0]) for r in c.fetchall()]
    for iid in rows:
        if iid in content_running_ids or iid in content_queued_ids:
            continue
        content_queue.append(iid)
        content_queued_ids.add(iid)


def parse_topic_msg_link(link: str):
    txt = str(link or "").strip().replace("https://", "").replace("http://", "").rstrip("/")
    m3 = re.search(r"t\.me/c/(\d+)/(\d+)/(\d+)", txt)
    if m3:
        return int("-100" + m3.group(1)), int(m3.group(2)), int(m3.group(3))
    m2 = re.search(r"t\.me/c/(\d+)/(\d+)", txt)
    if m2:
        return int("-100" + m2.group(1)), int(m2.group(2)), 0
    m3u = re.search(r"t\.me/([A-Za-z0-9_]{3,})/(\d+)/(\d+)", txt)
    if m3u and m3u.group(1) not in ("c", "s"):
        return m3u.group(1), int(m3u.group(2)), int(m3u.group(3))
    m2u = re.search(r"t\.me/([A-Za-z0-9_]{3,})/(\d+)", txt)
    if m2u and m2u.group(1) not in ("c", "s"):
        return m2u.group(1), int(m2u.group(2)), 0
    if re.match(r"^@?[A-Za-z0-9_]{3,}$", txt):
        return txt.lstrip("@"), 0, 0
    return None, 0, 0


def parse_target_link(link: str):
    txt = str(link or "").strip().replace("https://", "").replace("http://", "").rstrip("/")
    m3 = re.search(r"t\.me/c/(\d+)/(\d+)/\d+", txt)
    if m3:
        return int("-100" + m3.group(1)), int(m3.group(2))
    m2 = re.search(r"t\.me/c/(\d+)/(\d+)", txt)
    if m2:
        return int("-100" + m2.group(1)), int(m2.group(2))
    m1 = re.search(r"t\.me/c/(\d+)", txt)
    if m1:
        return int("-100" + m1.group(1)), 0
    m3u = re.search(r"t\.me/([A-Za-z0-9_]{3,})/(\d+)/(\d+)", txt)
    if m3u and m3u.group(1) not in ("c", "s"):
        return m3u.group(1), int(m3u.group(2))
    m2u = re.search(r"t\.me/([A-Za-z0-9_]{3,})/(\d+)", txt)
    if m2u and m2u.group(1) not in ("c", "s"):
        return m2u.group(1), int(m2u.group(2))
    if re.match(r"^@?[A-Za-z0-9_]{3,}$", txt):
        return txt.lstrip("@"), 0
    return txt, 0


def normalize_target_link(link: str):
    raw = str(link or "").strip()
    if not raw:
        return ""
    raw = raw.replace("https://", "").replace("http://", "")
    m_bad = re.search(r"^t\.me/c/([A-Za-z0-9_]{3,})/(\d+)(?:/(\d+))?$", raw)
    if m_bad:
        uname = m_bad.group(1)
        topic_id = m_bad.group(2)
        msg_id = m_bad.group(3) or "1"
        return f"https://t.me/{uname}/{topic_id}/{msg_id}"
    return str(link).strip()


def build_target_link_from_base(base_link: str, topic_id: int):
    base = str(base_link or "").strip()
    tid = int(topic_id or 0)
    if tid <= 0:
        return base
    if not base:
        return ""
    if str(base).lstrip("-").isdigit():
        cid_num = str(base).replace("-100", "")
        return f"https://t.me/c/{cid_num}/{tid}/1"
    norm = base.replace("https://", "").replace("http://", "")
    m = re.search(r"^t\.me/c/(\d+)(?:/(\d+))?(?:/(\d+))?$", norm)
    if m:
        cid = m.group(1)
        msg = m.group(3) or m.group(2) or "1"
        return f"https://t.me/c/{cid}/{tid}/{msg}"
    m_pub = re.search(r"^t\.me/([A-Za-z0-9_]{3,})(?:/(\d+))?(?:/(\d+))?$", norm)
    if m_pub and m_pub.group(1) not in ("c", "s"):
        uname = m_pub.group(1)
        msg = m_pub.group(3) or m_pub.group(2) or "1"
        return f"https://t.me/{uname}/{tid}/{msg}"
    if re.match(r"^@?[A-Za-z0-9_]{3,}$", base):
        uname = base.lstrip("@")
        return f"https://t.me/{uname}/{tid}/1"
    return base


def normalize_topic_seed(channel_id: int | None, topic_id: int, msg_id: int = 1):
    if not channel_id or topic_id <= 0:
        return ""
    cid = str(channel_id).replace("-100", "")
    mid = max(1, int(msg_id or 1))
    return f"https://t.me/c/{cid}/{int(topic_id)}/{mid}"


async def get_safe_entity(client, identifier):
    if not identifier:
        return None
    val = int(identifier) if str(identifier).lstrip("-").isdigit() else identifier
    try:
        return await client.get_entity(val)
    except Exception:
        await client.get_dialogs(limit=500)
        return await client.get_entity(val)


def resolve_direction(start_id: int, end_id: int, order_mode: str):
    mode = str(order_mode or "auto")
    if mode == "oldest":
        low = min(start_id, end_id) if end_id else start_id
        high = max(start_id, end_id) if end_id else 0
        return True, low, high
    if mode == "newest":
        low = min(start_id, end_id) if end_id else 0
        high = max(start_id, end_id) if end_id else start_id
        return False, low, high
    is_forward = start_id <= end_id if end_id else True
    low = min(start_id, end_id) if end_id else start_id
    high = max(start_id, end_id) if end_id else 0
    return is_forward, low, high


async def resolve_topic_title(channel_id: int, topic_id: int):
    try:
        client = await get_tg_client()
        ent = await client.get_entity(channel_id)
        if GetForumTopicsByIDRequest is not None:
            try:
                res = await client(GetForumTopicsByIDRequest(channel=ent, topics=[int(topic_id)]))
                for t in getattr(res, "topics", []):
                    if int(getattr(t, "id", 0) or 0) == int(topic_id or 0):
                        title = str(getattr(t, "title", "") or "").strip()
                        if title:
                            return title
            except Exception:
                pass
        offset_topic = 0
        while True:
            res = await client(GetForumTopicsRequest(channel=ent, q="", offset_date=0, offset_id=0, offset_topic=offset_topic, limit=100))
            topics = list(getattr(res, "topics", []) or [])
            if not topics:
                break
            for t in topics:
                if int(getattr(t, "id", 0) or 0) == int(topic_id or 0):
                    title = str(getattr(t, "title", "") or "").strip()
                    if title:
                        return title
            last_id = int(getattr(topics[-1], "id", 0) or 0)
            if last_id <= 0 or last_id == offset_topic:
                break
            offset_topic = last_id
        try:
            msg = await client.get_messages(ent, ids=int(topic_id))
            if msg:
                action = getattr(msg, "action", None)
                if MessageActionTopicCreate is not None and isinstance(action, MessageActionTopicCreate):
                    tname = str(getattr(action, "title", "") or "").strip()
                    if tname:
                        return tname
                tname2 = str(getattr(msg, "text", "") or "").strip()
                if tname2 and len(tname2) <= 120 and "Topic #" not in tname2:
                    return tname2
        except Exception:
            pass
    except Exception:
        pass
    return f"Topic #{int(topic_id or 0)}"


async def select_group_topics(group_id: int, pick_count: int, strategy: str = "round_robin"):
    pick_count = clamp_auto_pick_count(pick_count)
    strategy = normalize_auto_strategy(strategy)
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute("SELECT rr_cursor_topic_id FROM content_groups WHERE id=? LIMIT 1", (group_id,))
        row_cursor = c.fetchone()
        rr_cursor_topic_id = int(row_cursor[0] or 0) if row_cursor else 0
        c.execute(
            """SELECT t.id
               FROM content_topics t
               WHERE t.group_id=?
                 AND EXISTS (SELECT 1 FROM content_items i WHERE i.topic_id=t.id AND i.enabled=1)
               ORDER BY t.sort_order ASC, t.id ASC""",
            (group_id,),
        )
        topic_ids = [int(r[0]) for r in c.fetchall()]

    total_topics = len(topic_ids)
    if total_topics <= 0:
        return {
            "ok": False,
            "error": "Group chưa có topic có campaign bật để chạy.",
            "available_topics": 0,
            "selected_topic_ids": [],
            "strategy": strategy,
        }

    if strategy == "round_robin":
        ordered = topic_ids[:]
        if rr_cursor_topic_id in ordered:
            start_idx = (ordered.index(rr_cursor_topic_id) + 1) % len(ordered)
        else:
            start_idx = 0
        rotated = ordered[start_idx:] + ordered[:start_idx]
        selected_topics = rotated[:min(pick_count, total_topics)]
        if selected_topics:
            db_write_retry(
                lambda conn: conn.execute(
                    "UPDATE content_groups SET rr_cursor_topic_id=?, updated_at=? WHERE id=?",
                    (int(selected_topics[-1]), now_ts(), group_id),
                )
            )
    else:
        if pick_count >= total_topics:
            selected_topics = topic_ids[:]
            random.shuffle(selected_topics)
        else:
            selected_topics = random.sample(topic_ids, pick_count)

    return {
        "ok": True,
        "available_topics": total_topics,
        "selected_topic_ids": selected_topics,
        "strategy": strategy,
    }


async def enqueue_items_for_topics(group_id: int, topic_ids: list[int]):
    total_items = 0
    queued = 0
    skipped_running = 0
    skipped_queued = 0
    skipped_disabled = 0
    for tid in topic_ids:
        with closing(get_db_connection()) as conn:
            c = conn.cursor()
            c.execute("SELECT id, enabled FROM content_items WHERE topic_id=? ORDER BY id ASC", (tid,))
            rows = c.fetchall()
        for iid, enabled in rows:
            total_items += 1
            if not int(enabled or 0):
                skipped_disabled += 1
                continue
            out = await enqueue_item(int(iid))
            if out.get("queued"):
                queued += 1
            elif out.get("running"):
                skipped_running += 1
            elif out.get("already_queued"):
                skipped_queued += 1

    return {
        "ok": True,
        "group_id": int(group_id),
        "total_items": total_items,
        "queued": queued,
        "skipped_running": skipped_running,
        "skipped_queued": skipped_queued,
        "skipped_disabled": skipped_disabled,
    }


async def enqueue_item(item_id: int):
    if item_id in content_running_ids:
        return {"ok": True, "running": True}
    if item_id in content_queued_ids:
        return {"ok": True, "queued": False, "already_queued": True}
    content_queue.append(item_id)
    content_queued_ids.add(item_id)
    db_write_retry(
        lambda conn: conn.execute(
            "UPDATE content_items SET status=?, updated_at=? WHERE id=?",
            ("Đang xếp hàng", now_ts(), item_id),
        )
    )
    await ensure_content_worker()
    return {"ok": True, "queued": True, "position": len(content_queue)}






async def _load_item_row(item_id: int):
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM content_items WHERE id=? LIMIT 1", (int(item_id),))
        row = c.fetchone()
        if not row:
            return None
        cols = [d[0] for d in c.description]
        return dict(zip(cols, row))


@router.post("/run_item/{item_id}")
async def run_item_api(item_id: int):
    return await run_item_api_mode(item_id, mode="one_shot")


@router.post("/run_item_full/{item_id}")
async def run_item_full_api(item_id: int):
    return await run_item_api_mode(item_id, mode="full")


async def run_item_api_mode(item_id: int, mode: str = "one_shot"):
    item_id = int(item_id or 0)
    if item_id <= 0:
        return {"ok": False, "error": "item_id_invalid"}
    if item_id in content_running_ids:
        return {"ok": True, "running": True}
    row = await _load_item_row(item_id)
    if not row:
        return {"ok": False, "error": "item_not_found"}
    task = asyncio.create_task(run_item(row, mode=mode))
    content_item_tasks[item_id] = task
    try:
        await task
    finally:
        content_item_tasks.pop(item_id, None)
    return {"ok": True}


async def run_item(item: dict, mode: str = "one_shot"):
    item_id = int(item["id"])
    topic_id = int(item["topic_id"])
    mode = "full" if str(mode or "").strip().lower() in {"full", "until_empty", "all"} else "one_shot"
    content_running_ids.add(item_id)
    add_event(item_id, topic_id, "ITEM_START", "Bắt đầu chạy item")
    try:
        db_write_retry(
            lambda conn: conn.execute(
                "UPDATE content_items SET status=?, last_run_at=?, updated_at=? WHERE id=?",
                (f"Running {mode}", now_ts(), now_ts(), item_id),
            )
        )

        source_start_link = str(item.get("source_start_link") or "").strip()
        source_end_link = str(item.get("source_end_link") or "").strip()
        target_link = str(item.get("target_link") or "").strip()
        if not source_start_link:
            raise RuntimeError("Thiếu source_start_link")
        if not target_link:
            with closing(get_db_connection()) as conn:
                c = conn.cursor()
                c.execute(
                    """SELECT g.target_link, g.source_key, t.target_topic_id, t.target_link_seed
                       FROM content_items i
                       JOIN content_groups g ON g.id=i.group_id
                       JOIN content_topics t ON t.id=i.topic_id
                       WHERE i.id=? LIMIT 1""",
                    (item_id,),
                )
                row = c.fetchone()
                if row:
                    seed = str(row[3] or "").strip()
                    base = str(row[0] or "").strip() if str(row[0] or "").strip() else str(row[1] or "").strip()
                    from_group = build_target_link_from_base(base, int(row[2] or 0))
                    target_link = seed or from_group
                    if target_link:
                        db_write_retry(
                            lambda write_conn: write_conn.execute(
                                "UPDATE content_items SET target_link=?, updated_at=? WHERE id=?",
                                (target_link, now_ts(), item_id),
                            )
                        )
        target_link = normalize_target_link(target_link)
        if not target_link:
            raise RuntimeError("Thiếu target_link (item/topic/group đều rỗng)")

        src_channel, src_topic, start_id = parse_topic_msg_link(source_start_link)
        if not src_channel or int(start_id or 0) <= 0:
            raise RuntimeError("Link nguồn bắt đầu không hợp lệ")
        end_channel, end_topic, end_id = parse_topic_msg_link(source_end_link) if source_end_link else (src_channel, src_topic, 0)
        if end_channel and int(end_channel) != int(src_channel):
            raise RuntimeError("Link kết thúc khác channel nguồn")
        if end_topic and src_topic and int(end_topic) != int(src_topic):
            raise RuntimeError("Link kết thúc khác topic nguồn")
        dst_channel, dst_topic = parse_target_link(target_link)
        if int(dst_topic or 0) <= 0:
            with closing(get_db_connection()) as conn:
                c = conn.cursor()
                c.execute("SELECT target_topic_id FROM content_topics WHERE id=? LIMIT 1", (topic_id,))
                trow = c.fetchone()
                if trow and int(trow[0] or 0) > 0:
                    dst_topic = int(trow[0])
        if not dst_channel:
            raise RuntimeError("Link đích không hợp lệ")

        client = await get_tg_client()
        src_ent = await get_safe_entity(client, src_channel)
        dst_ent = await get_safe_entity(client, dst_channel)
        add_event(item_id, topic_id, "RESOLVE_OK", f"src={src_channel}/{src_topic} dst={dst_channel}/{dst_topic}", "info")

        group_mode = str(item.get("group_mode") or "keep").strip().lower()
        keep_album = group_mode == "keep"
        batch_size = max(0, int(item.get("batch_size") or 0))
        while True:
            with closing(get_db_connection()) as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM content_items WHERE id=? LIMIT 1", (item_id,))
                row = c.fetchone()
                if not row:
                    raise RuntimeError("Campaign không tồn tại")
                cols = [d[0] for d in c.description]
                item = dict(zip(cols, row))

            if not int(item.get("enabled") or 0):
                raise RuntimeError("Campaign đã tắt")

            cursor_id = int(item.get("last_msg_id") or 0)
            is_forward, low_id, high_id = resolve_direction(int(start_id), int(end_id or 0), item.get("order_mode") or "auto")
            iter_kwargs = {"entity": src_ent}
            if src_topic:
                iter_kwargs["reply_to"] = int(src_topic)
            if is_forward:
                iter_kwargs["reverse"] = True
                iter_kwargs["min_id"] = max(0, int(low_id) - 1, cursor_id)
            else:
                iter_kwargs["reverse"] = False
                iter_kwargs["max_id"] = min(int(high_id) + 1, cursor_id) if cursor_id > 0 else int(high_id) + 1

            picked_ids = []
            seen_units = []
            seen_unit_set = set()
            unit_to_ids = {}
            unit_to_msgs = {}
            async for msg in client.iter_messages(**iter_kwargs):
                if src_topic:
                    top_id = getattr(msg.reply_to, "reply_to_top_id", None) or getattr(msg.reply_to, "reply_to_msg_id", None)
                    if int(top_id or 0) != int(src_topic) and int(msg.id or 0) != int(src_topic):
                        continue
                mid = int(msg.id or 0)
                if high_id > 0:
                    if is_forward and mid > int(high_id):
                        break
                    if (not is_forward) and low_id > 0 and mid < int(low_id):
                        break
                grouped_id = int(getattr(msg, "grouped_id", 0) or 0)
                unit_key = f"g:{grouped_id}" if keep_album and grouped_id > 0 else f"m:{mid}"
                is_new_unit = unit_key not in seen_unit_set
                if batch_size > 0 and is_new_unit and len(seen_units) >= batch_size:
                    break
                if is_new_unit:
                    seen_unit_set.add(unit_key)
                    seen_units.append(unit_key)
                    unit_to_ids[unit_key] = []
                    unit_to_msgs[unit_key] = []
                unit_to_ids[unit_key].append(mid)
                unit_to_msgs[unit_key].append(msg)

            for unit_key in seen_units:
                picked_ids.extend(unit_to_ids.get(unit_key, []))

            if not picked_ids:
                db_write_retry(
                    lambda conn: conn.execute(
                        "UPDATE content_items SET status=?, last_result=?, updated_at=? WHERE id=?",
                        ("Không có message phù hợp", "no_messages", now_ts(), item_id),
                    )
                )
                add_event(item_id, topic_id, "NO_MESSAGES", "Không có message phù hợp để gửi", "warn")
                break

            add_event(item_id, topic_id, "COLLECT_OK", f"Thu được {len(picked_ids)} msg / {len(seen_units)} unit ({'keep' if keep_album else 'raw'})", "info", {"ids_head": picked_ids[:10], "unit_count": len(seen_units), "group_mode": group_mode, "cursor_before": cursor_id, "mode": mode})
            caption = str(item.get("caption") or "").strip()
            sent_count = 0
            sent_units_count = 0
            if caption:
                for unit_key in seen_units:
                    msgs = unit_to_msgs.get(unit_key, [])
                    if not msgs:
                        continue
                    msgs = sorted(msgs, key=lambda m: int(getattr(m, "id", 0) or 0))
                    medias = [m.media for m in msgs if getattr(m, "media", None) is not None]
                    if medias:
                        if len(medias) == 1:
                            await client.send_file(dst_ent, medias[0], caption=caption, reply_to=(int(dst_topic) if int(dst_topic or 0) > 0 else None))
                        else:
                            caps = [caption] + [""] * (len(medias) - 1)
                            await client.send_file(dst_ent, medias, caption=caps, reply_to=(int(dst_topic) if int(dst_topic or 0) > 0 else None))
                    else:
                        await client.send_message(dst_ent, caption, reply_to=(int(dst_topic) if int(dst_topic or 0) > 0 else None))
                    sent_count += len(msgs)
                    sent_units_count += 1
                add_event(item_id, topic_id, "CAPTION_OVERRIDE_OK", f"Đã copy với caption mặc định cho {len(seen_units)} unit", "ok")
            else:
                batch_unit_keys = []
                batch_msg_ids = []
                batch_count = 0

                async def flush_forward_batch():
                    nonlocal batch_unit_keys, batch_msg_ids, batch_count, sent_count
                    if not batch_msg_ids:
                        return
                    await client(
                        ForwardMessagesRequest(
                            from_peer=await client.get_input_entity(src_ent),
                            id=list(batch_msg_ids),
                            to_peer=await client.get_input_entity(dst_ent),
                            top_msg_id=(int(dst_topic) if int(dst_topic or 0) > 0 else None),
                            drop_author=True,
                            random_id=[random.getrandbits(63) for _ in batch_msg_ids],
                        )
                    )
                    sent_count += len(batch_msg_ids)
                    add_event(item_id, topic_id, "SEND_CHUNK_OK", f"Đã copy ẩn danh {len(batch_msg_ids)} msg / {len(batch_unit_keys)} unit", "ok", {"first": batch_msg_ids[0], "last": batch_msg_ids[-1], "units": list(batch_unit_keys), "mode": mode})
                    batch_unit_keys = []
                    batch_msg_ids = []
                    batch_count = 0

                for unit_key in seen_units:
                    ids = list(unit_to_ids.get(unit_key, []))
                    if not ids:
                        continue
                    if batch_msg_ids and batch_count + len(ids) > 100:
                        await flush_forward_batch()
                    batch_unit_keys.append(unit_key)
                    batch_msg_ids.extend(ids)
                    batch_count += len(ids)
                await flush_forward_batch()
                sent_units_count = len(seen_units)

            next_cursor_id = max(picked_ids) if is_forward else min(picked_ids)
            db_write_retry(
                lambda conn: conn.execute(
                    """UPDATE content_items
                       SET status=?, sent_count=COALESCE(sent_count,0)+?, sent_units_count=COALESCE(sent_units_count,0)+?,
                           last_msg_id=?, last_result=?, updated_at=?
                       WHERE id=?""",
                    (
                        "Đã gửi Telegram" if mode == "one_shot" else "Running full",
                        sent_count,
                        sent_units_count,
                        next_cursor_id,
                        f"sent={sent_count},units={sent_units_count},last_msg_id={next_cursor_id},mode={mode} @{now_ts()}",
                        now_ts(),
                        item_id,
                    ),
                )
            )
            add_event(item_id, topic_id, "ITEM_DONE", f"Đã gửi {sent_count} message sang Telegram, cursor={next_cursor_id}, mode={mode}", "ok")
            if mode != "full":
                break
            fresh_row = await _load_item_row(item_id)
            if not fresh_row:
                break
            if not int(fresh_row.get("enabled") or 0):
                break
            sleep_min = max(0.0, float(fresh_row.get("delay_min") or 1))
            sleep_max = max(sleep_min, float(fresh_row.get("delay_max") or sleep_min))
            sleep_for = random.uniform(sleep_min, sleep_max) if sleep_max > 0 else 0
            if sleep_for > 0:
                slept = 0.0
                while slept < sleep_for:
                    await asyncio.sleep(min(1.0, sleep_for - slept))
                    slept += min(1.0, sleep_for - slept)
    except asyncio.CancelledError:
        db_write_retry(
            lambda conn: conn.execute(
                "UPDATE content_items SET status=?, last_result=?, updated_at=? WHERE id=?",
                ("Đã dừng", "cancelled", now_ts(), item_id),
            )
        )
        add_event(item_id, topic_id, "ITEM_STOPPED", "Đã dừng chiến dịch đang chạy", "warn")
        raise
    except Exception as e:
        db_write_retry(
            lambda conn: conn.execute(
                "UPDATE content_items SET status=?, last_result=?, updated_at=? WHERE id=?",
                ("Lỗi", str(e)[:160], now_ts(), item_id),
            )
        )
        add_event(item_id, topic_id, "ITEM_ERROR", str(e), "error")
    finally:
        content_item_tasks.pop(item_id, None)
        content_running_ids.discard(item_id)


@router.post("/stop_item/{item_id}")
async def stop_item(item_id: int):
    item_id = int(item_id or 0)
    task = content_item_tasks.pop(item_id, None)
    if task and not task.done():
        task.cancel()
    if item_id in content_queued_ids:
        content_queued_ids.discard(item_id)
        try:
            content_queue.remove(item_id)
        except ValueError:
            pass
    if item_id in content_running_ids:
        content_running_ids.discard(item_id)
    db_write_retry(
        lambda conn: conn.execute(
            "UPDATE content_items SET status=?, updated_at=? WHERE id=?",
            ("Đã dừng", now_ts(), item_id),
        )
    )
    return {"ok": True}


@router.post("/reset_item/{item_id}")
async def reset_item(item_id: int):
    if item_id in content_queued_ids:
        content_queued_ids.discard(item_id)
        try:
            content_queue.remove(item_id)
        except ValueError:
            pass
    db_write_retry(
        lambda conn: conn.execute(
            """UPDATE content_items
               SET status='Nháp', sent_count=0, sent_units_count=0, last_result='', last_run_at=0, updated_at=?
                   , last_msg_id=0
               WHERE id=?""",
            (now_ts(), item_id),
        )
    )
    add_event(item_id, 0, "ITEM_RESET", "Đã reset campaign để chạy lại từ đầu", "info")
    return {"ok": True}


@router.get("/events/{item_id}")
async def get_item_events(item_id: int, limit: int = 120):
    safe_limit = max(20, min(500, int(limit or 120)))
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM content_events WHERE item_id=? ORDER BY id DESC LIMIT ?", (item_id, safe_limit))
        cols = [d[0] for d in c.description]
        return [dict(zip(cols, row)) for row in c.fetchall()]


@router.get("/group_progress/{group_id}")
async def get_group_progress(group_id: int):
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM content_topics WHERE group_id=?", (group_id,))
        total_topics = int((c.fetchone() or [0])[0] or 0)
        c.execute("SELECT id, status, enabled FROM content_items WHERE group_id=?", (group_id,))
        rows = c.fetchall()

    total_items = len(rows)
    enabled_items = 0
    done_items = 0
    error_items = 0
    queued_items = 0
    for iid, status, enabled in rows:
        if int(enabled or 0) == 1:
            enabled_items += 1
        st = str(status or "")
        if st == "Đã gửi Telegram":
            done_items += 1
        elif st == "Lỗi":
            error_items += 1
        if int(iid or 0) in content_queued_ids or st == "Đang xếp hàng":
            queued_items += 1
    running_items = sum(1 for iid, _, _ in rows if int(iid or 0) in content_running_ids)
    completed_ratio = (done_items / total_items * 100.0) if total_items > 0 else 0.0
    return {
        "group_id": int(group_id),
        "total_topics": total_topics,
        "total_items": total_items,
        "enabled_items": enabled_items,
        "running_items": running_items,
        "queued_items": queued_items,
        "done_items": done_items,
        "error_items": error_items,
        "completed_ratio": round(completed_ratio, 1),
    }


@router.get("/group_events/{group_id}")
async def get_group_events(group_id: int, limit: int = 120):
    safe_limit = max(20, min(500, int(limit or 120)))
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute(
            """SELECT e.*, i.title AS item_title, t.name AS topic_name
               FROM content_events e
               LEFT JOIN content_items i ON i.id=e.item_id
               LEFT JOIN content_topics t ON t.id=i.topic_id
               WHERE COALESCE(NULLIF(e.group_id, 0), i.group_id)=?
               ORDER BY e.id DESC
               LIMIT ?""",
            (group_id, safe_limit),
        )
        cols = [d[0] for d in c.description]
        return [dict(zip(cols, row)) for row in c.fetchall()]


@router.post("/group_runs/{run_id}/clear_error")
async def clear_group_run_error(run_id: int):
    run_id = int(run_id or 0)
    if run_id <= 0:
        return {"ok": False, "error": "run_id_invalid"}

    def _clear(conn):
        c = conn.cursor()
        c.execute("SELECT id, group_id, slot_key, status FROM content_group_runs WHERE id=? LIMIT 1", (run_id,))
        row = c.fetchone()
        if not row:
            return None
        group_id = int(row[1] or 0)
        slot_key = str(row[2] or "")
        status = str(row[3] or "")
        c.execute(
            "UPDATE content_group_runs SET last_error='' WHERE id=?",
            (run_id,),
        )
        if group_id > 0:
            c.execute(
                """UPDATE content_groups
                   SET auto_last_error='',
                       updated_at=CASE
                           WHEN COALESCE(auto_last_error, '') <> '' THEN ?
                           ELSE updated_at
                       END
                   WHERE id=?""",
                (now_ts(), group_id),
            )
        return {
            "id": run_id,
            "group_id": group_id,
            "slot_key": slot_key,
            "status": status,
        }

    run_row = db_write_retry(_clear)
    if not run_row:
        return {"ok": False, "error": "run_not_found"}
    add_event(
        0,
        0,
        "GROUP_RUN_ERROR_CLEARED",
        f"group={run_row['group_id']} slot={run_row['slot_key']} run_id={run_row['id']}",
        "info",
        {"run_id": run_row["id"], "status": run_row["status"]},
        group_id=run_row["group_id"],
    )
    return {"ok": True, "run": run_row}


@router.get("/groups")
async def get_groups():
    return _group_query()


@router.post("/groups")
async def create_group(req: GroupReq):
    data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute(
            """INSERT INTO content_groups
               (name, source_key, source_link, target_link, rr_cursor_topic_id, auto_enabled, auto_slots, auto_pick_count, auto_strategy,
                auto_next_run_at, auto_last_run_at, auto_last_slot_key, auto_last_result, auto_last_error, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, 0, 0, '', 1, 'round_robin', 0, 0, '', '', '', 1, ?, ?)""",
            (
                str(data.get("name") or "").strip(),
                str(data.get("source_key") or "").strip(),
                str(data.get("source_link") or "").strip(),
                str(data.get("target_link") or "").strip(),
                now_ts(),
                now_ts(),
            ),
        )
        conn.commit()
        group_id = c.lastrowid
    group = _fetch_one_dict("SELECT * FROM content_groups WHERE id=?", (group_id,))
    return {"ok": True, "group": _group_stats(group) if group else None}


@router.delete("/groups/{group_id}")
async def delete_group(group_id: int):
    group_id = int(group_id or 0)
    with closing(get_db_connection()) as conn:
        conn.execute("DELETE FROM content_events WHERE item_id IN (SELECT id FROM content_items WHERE group_id=?)", (group_id,))
        conn.execute("DELETE FROM content_group_runs WHERE group_id=?", (group_id,))
        conn.execute("DELETE FROM content_items WHERE group_id=?", (group_id,))
        conn.execute("DELETE FROM content_topics WHERE group_id=?", (group_id,))
        conn.execute("DELETE FROM content_groups WHERE id=?", (group_id,))
        conn.commit()
    return {"ok": True}


@router.post("/groups/{group_id}/auto")
async def save_group_auto(group_id: int, req: GroupAutoReq):
    data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
    auto_enabled = 1 if bool(data.get("auto_enabled")) else 0
    auto_slots = str(data.get("auto_slots") or "").strip()
    auto_pick_count = max(1, int(data.get("auto_pick_count") or 1))
    auto_strategy = str(data.get("auto_strategy") or "round_robin").strip() or "round_robin"
    slots = parse_schedule_slots(auto_slots)
    next_run_at = ensure_future_slot(slots, now_ts()) if auto_enabled and slots else 0
    with closing(get_db_connection()) as conn:
        conn.execute(
            """UPDATE content_groups
               SET auto_enabled=?, auto_slots=?, auto_pick_count=?, auto_strategy=?, auto_next_run_at=?, updated_at=?
               WHERE id=?""",
            (auto_enabled, auto_slots, auto_pick_count, auto_strategy, int(next_run_at), now_ts(), int(group_id)),
        )
        conn.commit()
    group = _fetch_one_dict("SELECT * FROM content_groups WHERE id=?", (int(group_id),))
    await ensure_content_auto_worker()
    await ensure_content_auto_scheduler()
    return {"ok": True, **(_group_stats(group) if group else {})}


@router.get("/topics/{group_id}")
async def get_topics(group_id: int):
    return _topic_query(group_id)


@router.post("/topics/{group_id}")
async def create_topic(group_id: int, req: TopicReq):
    data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
    topic_link = str(data.get("topic_link") or "").strip()
    parsed_channel, parsed_topic_id, parsed_msg_id = parse_topic_msg_link(topic_link) if topic_link else (None, 0, 0)
    name = str(data.get("name") or "").strip()
    if not name:
        if topic_link:
            if isinstance(parsed_channel, str) and parsed_channel:
                name = f"Topic {parsed_topic_id or parsed_msg_id or 'new'}"
            else:
                name = f"Topic {parsed_topic_id or parsed_msg_id or 'new'}"
        else:
            raise RuntimeError("Thiếu tên topic hoặc link topic")
    source_topic_id = int(data.get("source_topic_id") or 0) or int(parsed_topic_id or 0)
    target_topic_id = int(data.get("target_topic_id") or 0) or int(parsed_topic_id or 0)
    last_msg_id = int(data.get("last_msg_id") or 0) or int(parsed_msg_id or 0)
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute(
            """INSERT INTO content_topics
               (group_id, name, source_topic_id, target_topic_id, target_link_seed, last_msg_id, sort_order, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            (
                int(group_id),
                name,
                source_topic_id,
                target_topic_id,
                topic_link,
                last_msg_id,
                int(data.get("sort_order") or 0),
                now_ts(),
                now_ts(),
            ),
        )
        conn.commit()
        topic_id = c.lastrowid
    return {"ok": True, "topic": _fetch_one_dict("SELECT * FROM content_topics WHERE id=?", (topic_id,))}


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: int):
    topic_id = int(topic_id or 0)
    with closing(get_db_connection()) as conn:
        conn.execute("DELETE FROM content_events WHERE topic_id=?", (topic_id,))
        conn.execute("DELETE FROM content_items WHERE topic_id=?", (topic_id,))
        conn.execute("DELETE FROM content_topics WHERE id=?", (topic_id,))
        conn.commit()
    return {"ok": True}


@router.post("/topics_rename/{topic_id}")
async def rename_topic(topic_id: int, req: TopicRenameReq):
    data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
    name = str(data.get("name") or "").strip()
    if not name:
        raise RuntimeError("Thiếu tên topic")
    with closing(get_db_connection()) as conn:
        conn.execute("UPDATE content_topics SET name=?, updated_at=? WHERE id=?", (name, now_ts(), int(topic_id)))
        conn.commit()
    return {"ok": True}


@router.get("/items/{topic_id}")
async def get_items(topic_id: int):
    return _item_query(topic_id)


@router.post("/items/{group_id}/{topic_id}")
async def create_item(group_id: int, topic_id: int, req: ItemReq):
    data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
    source_end_link = "" if bool(data.get("follow_latest")) else str(data.get("source_end_link") or "").strip()
    with closing(get_db_connection()) as conn:
        c = conn.cursor()
        c.execute(
            """INSERT INTO content_items
               (group_id, topic_id, title, body, source_start_link, source_end_link, follow_latest, target_link, caption, group_mode, order_mode, batch_size, delay_min, delay_max, enabled, status, schedule_enabled, schedule_slots, next_run_at, last_run_at, last_result, last_msg_id, sent_count, sent_units_count, created_at, updated_at)
               VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Nháp', 0, '', 0, 0, '', 0, 0, 0, ?, ?)""",
            (
                int(group_id),
                int(topic_id),
                str(data.get("title") or "").strip(),
                str(data.get("source_start_link") or "").strip(),
                source_end_link,
                1 if bool(data.get("follow_latest")) else 0,
                str(data.get("target_link") or "").strip(),
                str(data.get("caption") or "").strip(),
                str(data.get("group_mode") or "keep").strip() or "keep",
                str(data.get("order_mode") or "auto").strip() or "auto",
                int(data.get("batch_size") or 0),
                int(data.get("delay_min") or 1),
                int(data.get("delay_max") or 7),
                now_ts(),
                now_ts(),
            ),
        )
        conn.commit()
        item_id = c.lastrowid
    return {"ok": True, "item": _fetch_one_dict("SELECT * FROM content_items WHERE id=?", (item_id,))}


@router.put("/items/{item_id}")
async def update_item(item_id: int, req: ItemReq):
    data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
    source_end_link = "" if bool(data.get("follow_latest")) else str(data.get("source_end_link") or "").strip()
    with closing(get_db_connection()) as conn:
        conn.execute(
            """UPDATE content_items
               SET title=?, source_start_link=?, source_end_link=?, follow_latest=?, target_link=?, caption=?, group_mode=?, order_mode=?, batch_size=?, delay_min=?, delay_max=?, updated_at=?
               WHERE id=?""",
            (
                str(data.get("title") or "").strip(),
                str(data.get("source_start_link") or "").strip(),
                source_end_link,
                1 if bool(data.get("follow_latest")) else 0,
                str(data.get("target_link") or "").strip(),
                str(data.get("caption") or "").strip(),
                str(data.get("group_mode") or "keep").strip() or "keep",
                str(data.get("order_mode") or "auto").strip() or "auto",
                int(data.get("batch_size") or 0),
                int(data.get("delay_min") or 1),
                int(data.get("delay_max") or 7),
                now_ts(),
                int(item_id),
            ),
        )
        conn.commit()
    return {"ok": True, "item": _fetch_one_dict("SELECT * FROM content_items WHERE id=?", (int(item_id),))}


@router.delete("/items/{item_id}")
async def delete_item(item_id: int):
    item_id = int(item_id or 0)
    with closing(get_db_connection()) as conn:
        conn.execute("DELETE FROM content_events WHERE item_id=?", (item_id,))
        conn.execute("DELETE FROM content_items WHERE id=?", (item_id,))
        conn.commit()
    return {"ok": True}


@router.post("/run_topic/{topic_id}")
async def run_topic(topic_id: int):
    topic_id = int(topic_id or 0)
    rows = _item_query(topic_id)
    queued = 0
    for item in rows:
        if int(item.get("enabled") or 0) != 1:
            continue
        out = await enqueue_item(int(item["id"]))
        if out.get("queued"):
            queued += 1
    return {"ok": True, "topic_id": topic_id, "queued": queued, "total": len(rows)}


@router.get("/queue")
async def get_queue():
    now_value = now_ts()
    q = list(content_queue)
    return {
        "queue_size": len(q),
        "active_workers": len(content_running_ids),
        "max_concurrency": int(CONTENT_MAX_CONCURRENCY),
        "items": [{"item_id": iid, "position": i + 1, "wait_sec": 0} for i, iid in enumerate(q)],
        "now": now_value,
    }


@router.get("/queue_policy")
async def get_queue_policy():
    return {"max_concurrency": int(CONTENT_MAX_CONCURRENCY)}


@router.post("/queue_policy")
async def set_queue_policy(req: QueuePolicyReq):
    global CONTENT_MAX_CONCURRENCY
    CONTENT_MAX_CONCURRENCY = max(1, min(2, int(req.max_concurrency or 1)))
    return {"ok": True, "max_concurrency": int(CONTENT_MAX_CONCURRENCY)}
