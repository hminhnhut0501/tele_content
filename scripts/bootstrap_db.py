#!/usr/bin/env python3
import argparse
import importlib
import sys
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import (
    CONTENT_HUB_BOOTSTRAP_ID,
    DATABASE_MODE,
    DATABASE_URL,
    ensure_schema_migrations_table,
    get_db_connection,
    migration_applied,
    record_migration,
)


def bootstrap_schema():
    module = importlib.import_module("modules.mod_content_hub")
    with closing(get_db_connection()) as conn:
        ensure_schema_migrations_table(conn)
        module.init_db(conn)
        record_migration(
            conn,
            CONTENT_HUB_BOOTSTRAP_ID,
            note="Baseline schema bootstrap for content_hub_render_free",
        )


def verify_schema():
    checks = {}
    with closing(get_db_connection()) as conn:
        ensure_schema_migrations_table(conn)
        checks["bootstrap_applied"] = migration_applied(conn, CONTENT_HUB_BOOTSTRAP_ID)
        for table in (
            "content_groups",
            "content_topics",
            "content_items",
            "content_events",
            "content_group_runs",
            "schema_migrations",
        ):
            row = conn.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_name=%s LIMIT 1",
                (table,),
            ).fetchone() if DATABASE_MODE == "postgres" else conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
                (table,),
            ).fetchone()
            checks[table] = bool(row)
    return checks


def main():
    parser = argparse.ArgumentParser(description="Bootstrap or verify Content Hub database schema.")
    parser.add_argument("--check", action="store_true", help="Only verify schema state without applying bootstrap.")
    args = parser.parse_args()

    print(f"DATABASE_MODE={DATABASE_MODE}")
    if DATABASE_URL:
        print("DATABASE_URL_SET=true")
    else:
        print("DATABASE_URL_SET=false")

    if not args.check:
        bootstrap_schema()
        print(f"BOOTSTRAP_APPLIED={CONTENT_HUB_BOOTSTRAP_ID}")

    checks = verify_schema()
    for key, value in checks.items():
        print(f"{key}={str(bool(value)).lower()}")


if __name__ == "__main__":
    main()
