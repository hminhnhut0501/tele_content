import os
import re
import sqlite3
import threading
from pathlib import Path

try:
    import psycopg
except Exception:  # pragma: no cover - optional until Postgres mode is used
    psycopg = None


DB_PATH = Path(os.getenv("TELEVAULT_DB_PATH") or Path(__file__).parent.resolve() / "televault_v2.db")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DATABASE_MODE = "postgres" if DATABASE_URL else "sqlite"
CONTENT_HUB_BOOTSTRAP_ID = "20260703_content_hub_bootstrap_v1"
DB_WRITE_LOCK = threading.RLock()
WRITE_SQL_PREFIXES = (
    "insert",
    "update",
    "delete",
    "replace",
    "create",
    "alter",
    "drop",
    "reindex",
    "vacuum",
    "pragma",
)
AUTOINC_RE = re.compile(r"\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b", re.I)
STRFTIME_RE = re.compile(r"strftime\('%s','now'\)", re.I)


def _is_write_sql(sql) -> bool:
    text = str(sql or "").strip().lower()
    if not text:
        return False
    while text.startswith("("):
        text = text[1:].lstrip()
    return text.startswith(WRITE_SQL_PREFIXES)


def _replace_qmarks(sql: str) -> str:
    out = []
    in_single = False
    in_double = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'" and not in_double:
            in_single = not in_single
            out.append(ch)
        elif ch == '"' and not in_single:
            in_double = not in_double
            out.append(ch)
        elif ch == "?" and not in_single and not in_double:
            out.append("%s")
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def translate_sql(sql: str) -> str:
    if DATABASE_MODE != "postgres":
        return sql
    text = str(sql or "")
    text = AUTOINC_RE.sub("BIGSERIAL PRIMARY KEY", text)
    text = STRFTIME_RE.sub("EXTRACT(EPOCH FROM NOW())::bigint", text)
    text = _replace_qmarks(text)
    return text


class SerializedCursor:
    def __init__(self, cursor, owner):
        self._cursor = cursor
        self._owner = owner
        self.description = None

    def _run(self, method_name, sql, parameters=None):
        translated = translate_sql(sql)
        self._owner._before_execute(sql)
        fn = getattr(self._cursor, method_name)
        try:
            if parameters is None:
                fn(translated)
            else:
                fn(translated, parameters)
        except Exception:
            self._owner.rollback()
            raise
        self.description = self._cursor.description
        return self

    def execute(self, sql, parameters=()):
        return self._run("execute", sql, parameters)

    def executemany(self, sql, seq_of_parameters):
        translated = translate_sql(sql)
        self._owner._before_execute(sql)
        try:
            self._cursor.executemany(translated, seq_of_parameters)
        except Exception:
            self._owner.rollback()
            raise
        self.description = self._cursor.description
        return self

    def executescript(self, sql_script):
        translated = translate_sql(sql_script)
        self._owner._before_execute(sql_script, force_write=True)
        try:
            if DATABASE_MODE == "postgres":
                for statement in [part.strip() for part in translated.split(";") if part.strip()]:
                    self._cursor.execute(statement)
            else:
                self._cursor.executescript(translated)
        except Exception:
            self._owner.rollback()
            raise
        self.description = self._cursor.description
        return self

    def _map_row(self, row):
        if row is None or not self._owner._row_factory or DATABASE_MODE != "postgres":
            return row
        if not self.description:
            return row
        cols = [item[0] for item in self.description]
        return dict(zip(cols, row))

    def fetchone(self):
        return self._map_row(self._cursor.fetchone())

    def fetchall(self):
        return [self._map_row(row) for row in self._cursor.fetchall()]

    def fetchmany(self, size=None):
        rows = self._cursor.fetchmany(size) if size is not None else self._cursor.fetchmany()
        return [self._map_row(row) for row in rows]

    @property
    def lastrowid(self):
        if DATABASE_MODE == "postgres":
            return None
        return self._cursor.lastrowid

    def __iter__(self):
        for row in self._cursor:
            yield self._map_row(row)

    def __getattr__(self, name):
        return getattr(self._cursor, name)

    def close(self):
        return self._cursor.close()


class SerializedConnection:
    def __init__(self, raw_conn):
        object.__setattr__(self, "_raw_conn", raw_conn)
        object.__setattr__(self, "_write_lock_held", False)
        object.__setattr__(self, "_row_factory", None)

    def _before_execute(self, sql, force_write=False):
        if force_write or _is_write_sql(sql):
            self._acquire_write_lock()

    def _acquire_write_lock(self):
        if not self._write_lock_held:
            DB_WRITE_LOCK.acquire()
            self._write_lock_held = True

    def _release_write_lock(self):
        if self._write_lock_held:
            self._write_lock_held = False
            DB_WRITE_LOCK.release()

    def cursor(self, *args, **kwargs):
        return SerializedCursor(self._raw_conn.cursor(*args, **kwargs), self)

    def execute(self, sql, parameters=()):
        cursor = self.cursor()
        return cursor.execute(sql, parameters)

    def executemany(self, sql, seq_of_parameters):
        cursor = self.cursor()
        return cursor.executemany(sql, seq_of_parameters)

    def executescript(self, sql_script):
        cursor = self.cursor()
        return cursor.executescript(sql_script)

    def commit(self):
        try:
            return self._raw_conn.commit()
        finally:
            self._release_write_lock()

    def rollback(self):
        try:
            return self._raw_conn.rollback()
        finally:
            self._release_write_lock()

    def close(self):
        try:
            if self._write_lock_held:
                try:
                    self._raw_conn.rollback()
                except Exception:
                    pass
            return self._raw_conn.close()
        finally:
            self._release_write_lock()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is not None:
                self.rollback()
            elif self._write_lock_held:
                self.commit()
        finally:
            self.close()
        return False

    def __getattr__(self, name):
        return getattr(self._raw_conn, name)

    def __setattr__(self, name, value):
        if name in {"_raw_conn", "_write_lock_held", "_row_factory"}:
            object.__setattr__(self, name, value)
        elif name == "row_factory":
            object.__setattr__(self, "_row_factory", value)
            if DATABASE_MODE == "sqlite":
                setattr(self._raw_conn, name, value)
        else:
            setattr(self._raw_conn, name, value)


def get_db_connection():
    if DATABASE_MODE == "postgres":
        if psycopg is None:
            raise RuntimeError("DATABASE_URL is set but psycopg is not installed.")
        raw_conn = psycopg.connect(DATABASE_URL)
        return SerializedConnection(raw_conn)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    raw_conn = sqlite3.connect(str(DB_PATH), timeout=120, check_same_thread=False)
    raw_conn.execute("PRAGMA journal_mode=WAL;")
    raw_conn.execute("PRAGMA synchronous=NORMAL;")
    raw_conn.execute("PRAGMA busy_timeout=120000;")
    return SerializedConnection(raw_conn)


def ensure_schema_migrations_table(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            note TEXT DEFAULT '',
            applied_at INTEGER DEFAULT (strftime('%s','now'))
        )"""
    )
    conn.commit()


def migration_applied(conn, migration_id: str) -> bool:
    ensure_schema_migrations_table(conn)
    row = conn.execute("SELECT id FROM schema_migrations WHERE id=? LIMIT 1", (migration_id,)).fetchone()
    return bool(row)


def record_migration(conn, migration_id: str, note: str = ""):
    ensure_schema_migrations_table(conn)
    if migration_applied(conn, migration_id):
        return
    conn.execute(
        "INSERT INTO schema_migrations(id, note) VALUES(?, ?)",
        (str(migration_id or "").strip(), str(note or "").strip()),
    )
    conn.commit()


def init_db():
    conn = get_db_connection()
    conn.execute("""CREATE TABLE IF NOT EXISTS saved_targets (link TEXT PRIMARY KEY)""")
    conn.commit()
    conn.close()
