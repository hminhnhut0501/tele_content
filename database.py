import os
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(os.getenv("TELEVAULT_DB_PATH") or Path(__file__).parent.resolve() / "televault_v2.db")
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


def _is_write_sql(sql) -> bool:
    text = str(sql or "").strip().lower()
    if not text:
        return False
    while text.startswith("("):
        text = text[1:].lstrip()
    return text.startswith(WRITE_SQL_PREFIXES)


class SerializedCursor:
    def __init__(self, cursor, owner):
        self._cursor = cursor
        self._owner = owner

    def execute(self, sql, parameters=()):
        self._owner._before_execute(sql)
        self._cursor.execute(sql, parameters)
        return self

    def executemany(self, sql, seq_of_parameters):
        self._owner._before_execute(sql)
        self._cursor.executemany(sql, seq_of_parameters)
        return self

    def executescript(self, sql_script):
        self._owner._before_execute(sql_script, force_write=True)
        self._cursor.executescript(sql_script)
        return self

    def __iter__(self):
        return iter(self._cursor)

    def __getattr__(self, name):
        return getattr(self._cursor, name)

    def close(self):
        return self._cursor.close()


class SerializedConnection:
    def __init__(self, raw_conn):
        object.__setattr__(self, "_raw_conn", raw_conn)
        object.__setattr__(self, "_write_lock_held", False)

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
        if name in {"_raw_conn", "_write_lock_held"}:
            object.__setattr__(self, name, value)
        else:
            setattr(self._raw_conn, name, value)


def get_db_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    raw_conn = sqlite3.connect(str(DB_PATH), timeout=120, check_same_thread=False)
    raw_conn.execute("PRAGMA journal_mode=WAL;")
    raw_conn.execute("PRAGMA synchronous=NORMAL;")
    raw_conn.execute("PRAGMA busy_timeout=120000;")
    return SerializedConnection(raw_conn)


def init_db():
    conn = get_db_connection()
    conn.execute("""CREATE TABLE IF NOT EXISTS saved_targets (link TEXT PRIMARY KEY)""")
    conn.commit()
    conn.close()


init_db()
