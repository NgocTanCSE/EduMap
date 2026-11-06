"""Create Supabase tables that exist in SQLite but not in Postgres.

Derives column definitions from the SQLite schema (PRAGMA table_info) with
type mapping: TEXT->TEXT, INTEGER->INTEGER/SERIAL, REAL->DOUBLE PRECISION.
Primary-key columns named 'id' with TEXT values become UUID (matching the
backend entities); integer 'id' PKs become SERIAL.

Foreign-key constraints are intentionally omitted (application-level integrity)
to avoid ordering/dependency issues. Run after migrations, before data migration.

Usage:
    DB_TYPE=postgres DB_HOST=... ... python3 scripts/create_missing_tables.py
"""
import os
import sqlite3
import sys

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not available")
    sys.exit(1)

SKIP = {"sqlite_sequence", "sqlite_stat1", "sqlite_master"}


def pg_conn():
    host = os.getenv("DB_HOST", "localhost")
    kwargs = dict(
        host=host,
        port=int(os.getenv("DB_PORT", "6543" if "supabase" in host else "5432")),
        user=os.getenv("DB_USERNAME", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        dbname=os.getenv("DB_DATABASE", "postgres"),
    )
    if host not in ("localhost", "127.0.0.1"):
        kwargs["sslmode"] = os.getenv("DB_SSLMODE", "require")
    return psycopg2.connect(**kwargs)


def is_uuid_text(conn, table, col):
    """Check if a TEXT column contains UUID-like values."""
    try:
        cur = conn.cursor()
        cur.execute(f'SELECT "{col}" FROM "{table}" WHERE "{col}" IS NOT NULL')
        vals = [r[0] for r in cur.fetchall()]
        cur.close()
        if not vals:
            return False
        import re
        return all(isinstance(v, str) and len(v) == 36 and v.count("-") == 4 for v in vals)
    except Exception:
        return False


def sqlite_tables(sconn):
    return [r[0] for r in sconn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()]


def pg_tables(pconn):
    cur = pconn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
    res = {r[0] for r in cur.fetchall()}
    cur.close()
    return res


def build_create_sql(table, sconn, pconn):
    info = sconn.execute(f'PRAGMA table_info("{table}")').fetchall()
    pk_cols = [c[1] for c in info if c[5] > 0]
    col_defs = []
    for cid, name, ctype, notnull, dflt, pk in info:
        ctype_up = (ctype or "").upper()
        if name == "id" and pk:
            if ctype_up == "INTEGER":
                pg_type = "SERIAL"
            elif is_uuid_text(sconn, table, name):
                pg_type = "UUID NOT NULL DEFAULT uuid_generate_v4()"
            else:
                pg_type = "TEXT"
        elif name.endswith("_id") or name.endswith("Id"):
            if ctype_up == "TEXT" and is_uuid_text(sconn, table, name):
                pg_type = "UUID"
            elif ctype_up == "INTEGER":
                pg_type = "INTEGER"
            else:
                pg_type = "TEXT"
        elif ctype_up in ("TEXT", ""):
            pg_type = "TEXT"
        elif ctype_up in ("INTEGER", "INT", "BOOLEAN"):
            pg_type = "INTEGER"
        elif ctype_up in ("REAL", "FLOAT", "DOUBLE"):
            pg_type = "DOUBLE PRECISION"
        elif ctype_up in ("BLOB",):
            pg_type = "BYTEA"
        else:
            pg_type = "TEXT"

        if pk and name == "id" and "SERIAL" in pg_type:
            not_null = "NOT NULL"
        elif notnull and pk == 0:
            not_null = "NOT NULL"
        elif notnull and pk > 0:
            not_null = "NOT NULL"
        else:
            not_null = ""

        default = ""
        if dflt is not None and "SERIAL" not in pg_type and "uuid_generate_v4" not in pg_type:
            if "(" in str(dflt):
                expr = str(dflt).replace("datetime('now')", "now()").replace('datetime("now")', "now()")
                default = f"DEFAULT {expr}"
            elif ctype_up in ("TEXT", ""):
                if str(dflt).startswith("'"):
                    default = f"DEFAULT {dflt}"
                else:
                    default = f"DEFAULT '{dflt}'"
            elif ctype_up in ("INTEGER", "INT", "REAL", "FLOAT", "DOUBLE"):
                default = f"DEFAULT {dflt}"

        parts = [f'"{name}" {pg_type}']
        if not_null:
            parts.append(not_null)
        if default:
            parts.append(default)
        col_defs.append(" ".join(parts))

    if pk_cols:
        pk_sql = ", ".join(f'"{c}"' for c in pk_cols)
        col_defs.append(f'CONSTRAINT "PK_{table}" PRIMARY KEY ({pk_sql})')

    sql = f'CREATE TABLE IF NOT EXISTS "{table}" (\n    ' + ",\n    ".join(col_defs) + "\n)"
    return sql


def main():
    sqlite_path = os.getenv("DB_SQLITE_PATH", "frontend/public/edumap.db")
    if len(sys.argv) > 1 and sys.argv[1].startswith("--sqlite="):
        sqlite_path = sys.argv[1].split("=", 1)[1]
    elif len(sys.argv) > 2 and sys.argv[1] == "--sqlite":
        sqlite_path = sys.argv[2]

    sconn = sqlite3.connect(sqlite_path)
    pconn = pg_conn()
    pcur = pconn.cursor()
    existing = pg_tables(pconn)

    created = 0
    for table in sqlite_tables(sconn):
        if table in SKIP or table in existing:
            continue
        sql = build_create_sql(table, sconn, pconn)
        try:
            pcur.execute(sql)
            pconn.commit()
            created += 1
            print(f"  CREATED: {table}")
        except Exception as e:
            pconn.rollback()
            print(f"  FAILED {table}: {e}")
            print(f"    SQL: {sql[:200]}")

    pcur.close()
    pconn.close()
    sconn.close()
    print(f"\nDone. Created {created} tables.")


if __name__ == "__main__":
    main()