"""Migrate data from the shipped SQLite DB into a Supabase/Postgres DB.

Usage:
    DB_TYPE=postgres DB_HOST=... DB_PORT=5432 DB_USERNAME=postgres \
      DB_PASSWORD=... DB_DATABASE=postgres \
      python3 scripts/migrate_sqlite_to_postgres.py --sqlite frontend/public/edumap.db

Idempotent: uses INSERT ... ON CONFLICT DO NOTHING on the table's primary key,
so re-running will not duplicate rows. Tables that do not exist in Postgres
(or are SQLite-internal) are skipped with a warning.

Dependencies: psycopg2 (available in the ai-deps stage / ai-service venv).
"""
import argparse
import os
import sqlite3
import sys

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError as e:  
    print(f"ERROR: psycopg2 not available: {e}")
    sys.exit(1)

SKIP_TABLES = {"sqlite_sequence", "sqlite_master", "sqlite_stat1"}


def pg_conn():
    host = os.getenv("DB_HOST", "localhost")
    kwargs = dict(
        host=host,
        port=int(os.getenv("DB_PORT", "6543" if "supabase" in host else "5432")),
        user=os.getenv("DB_USERNAME", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        dbname=os.getenv("DB_DATABASE", "postgres"),
    )
    if host and host != "localhost" and host != "127.0.0.1":
        kwargs["sslmode"] = os.getenv("DB_SSLMODE", "require")
    return psycopg2.connect(**kwargs)


def pg_tables(cur):
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' AND table_type='BASE TABLE'"
    )
    return {r[0] for r in cur.fetchall()}


def pg_columns(cur, table):
    cur.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=%s",
        (table,),
    )
    return [r[0] for r in cur.fetchall()]


_PG_COL_TYPE_CACHE = {}

def pg_col_type(cur, table, col):
    key = (table, col)
    if key in _PG_COL_TYPE_CACHE:
        return _PG_COL_TYPE_CACHE[key]
    cur.execute(
        "SELECT data_type, udt_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=%s AND column_name=%s",
        (table, col),
    )
    r = cur.fetchone()
    if not r:
        _PG_COL_TYPE_CACHE[key] = None
        return None
    val = r[1] if r[0] == "USER-DEFINED" else r[0]
    _PG_COL_TYPE_CACHE[key] = val
    return val


def pg_pk(cur, table):
    cur.execute(
        """
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = %s::regclass AND i.indisprimary
        """,
        (table,),
    )
    rows = cur.fetchall()
    return rows[0][0] if rows else None


def migrate(sqlite_path):
    if not os.path.exists(sqlite_path):
        print(f"ERROR: sqlite file not found: {sqlite_path}")
        sys.exit(1)

    sconn = sqlite3.connect(sqlite_path)
    sconn.row_factory = sqlite3.Row
    pconn = pg_conn()
    pcur = pconn.cursor()

    pg_tbls = pg_tables(pcur)
    sqlite_tbls = [
        r[0]
        for r in sconn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
    ]

    fk_deps = {}
    for t in sqlite_tbls:
        if t not in pg_tbls:
            continue
        pcur.execute(
            "SELECT ccu.table_name FROM information_schema.table_constraints tc "
            "JOIN information_schema.key_column_usage kcu "
            "  ON tc.constraint_name = kcu.constraint_name "
            "JOIN information_schema.constraint_column_usage ccu "
            "  ON ccu.constraint_name = tc.constraint_name "
            "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s",
            (t,),
        )
        deps = {r[0] for r in pcur.fetchall() if r[0] in sqlite_tbls and r[0] != t}
        fk_deps[t] = deps

    ordered = []
    remaining = set(t for t in sqlite_tbls if t in pg_tbls)
    while remaining:
        progressed = False
        for t in sorted(remaining):
            if fk_deps.get(t, set()).issubset(set(ordered)):
                ordered.append(t)
                remaining.discard(t)
                progressed = True
        if not progressed:
            ordered.extend(sorted(remaining))
            break
    sqlite_tbls = ordered + [t for t in sqlite_tbls if t not in pg_tbls]

    total_rows = 0
    for table in sqlite_tbls:
        print(f"  processing {table}...", flush=True)
        if table in SKIP_TABLES:
            continue
        if table not in pg_tbls:
            print(f"  SKIP (no PG table): {table}")
            continue

        cols = pg_columns(pcur, table)
        pk = pg_pk(pcur, table)

        s_cols = [r[1] for r in sconn.execute(f"PRAGMA table_info({table})").fetchall()]
        s_col_types = {r[1]: r[2].upper() for r in sconn.execute(f"PRAGMA table_info({table})").fetchall()}

        common = [c for c in cols if c in s_cols]
        if not common:
            print(f"  SKIP (no common columns): {table}")
            continue

        if pk and pk in common:
            if pg_col_type(pcur, table, pk) == "uuid" and s_col_types.get(pk) in ("INTEGER", "INT", None):
                common = [c for c in common if c != pk]

        print(f"  fetching {table}...", flush=True)
        rows = sconn.execute(
            f"SELECT {', '.join(common)} FROM {table}"
        ).fetchall()
        if not rows:
            print(f"  {table}: 0 rows (empty)")
            continue

        all_null = {c for c in common if all(r[c] is None for r in rows)}
        if all_null:
            common = [c for c in common if c not in all_null]
            if not common:
                print(f"  SKIP (all columns null): {table}")
                continue
            rows = sconn.execute(
                f"SELECT {', '.join(common)} FROM {table}"
            ).fetchall()

        pcur.execute(
            "SELECT kcu.column_name, ccu.table_name, ccu.column_name "
            "FROM information_schema.table_constraints tc "
            "JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name "
            "JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name "
            "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s",
            (table,),
        )
        fks = pcur.fetchall()

        parent_ids = {}
        for _, ptable, pcol in fks:
            if ptable not in parent_ids:
                try:
                    pcur.execute(f'SELECT "{pcol}" FROM "{ptable}"')
                    parent_ids[ptable] = {str(r[0]) for r in pcur.fetchall() if r[0] is not None}
                except Exception:
                    parent_ids[ptable] = set()

        if fks:
            fk_map = {child: (ptable, pcol) for child, ptable, pcol in fks}
            cleaned = []
            for r in rows:
                r = dict(r)
                for child, (ptable, pcol) in fk_map.items():
                    if child in r and r[child] is not None:
                        if str(r[child]) not in parent_ids.get(ptable, set()):
                            r[child] = None
                cleaned.append(r)
            rows = cleaned

        def coerce(col, val):
            if val is None:
                return None
            pt = pg_col_type(pcur, table, col)
            if pt == "uuid":
                s = str(val).strip()
                if len(s) == 36 and s.count("-") == 4:
                    return s
                return None
            if pt in ("geometry", "geography"):
                import json as _j
                try:
                    parsed = val if not isinstance(val, str) else _j.loads(val)
                except Exception:
                    return None
                if isinstance(parsed, dict) and "type" in parsed and "coordinates" in parsed:
                    geojson = parsed
                elif isinstance(parsed, list):
                    if parsed and isinstance(parsed[0], (int, float)):
                        geojson = {"type": "Point", "coordinates": parsed}
                    elif parsed and isinstance(parsed[0], list) and parsed[0] and isinstance(parsed[0][0], (int, float)):
                        geojson = {"type": "LineString", "coordinates": parsed}
                    elif parsed and isinstance(parsed[0], list) and parsed[0] and isinstance(parsed[0][0], list):
                        geojson = {"type": "Polygon", "coordinates": parsed}
                    else:
                        return None
                else:
                    return None
                geojson_str = _j.dumps(geojson)
                from psycopg2.extensions import AsIs
                cast = "::geography" if pt == "geography" else ""
                return AsIs(f"ST_GeomFromGeoJSON('{geojson_str.replace(chr(39), chr(39)+chr(39))}'){cast}")
            if pt == "boolean":
                if isinstance(val, bool):
                    return val
                if isinstance(val, (int, float)):
                    return bool(val)
                if isinstance(val, str):
                    low = val.strip().lower()
                    if low in ("1", "true", "t", "yes"):
                        return True
                    if low in ("0", "false", "f", "no", ""):
                        return False
                return None
            if pt in ("json", "jsonb") and isinstance(val, str):
                try:
                    import json as _j
                    _j.loads(val)
                    return val
                except Exception:
                    return None
            if pt == "ARRAY" and isinstance(val, str):
                try:
                    import json as _j
                    parsed = _j.loads(val)
                    if isinstance(parsed, list):
                        return parsed
                except Exception:
                    return [x.strip() for x in val.strip("[]").split(",") if x.strip()]
            return val

        values = [tuple(coerce(c, r[c]) for c in common) for r in rows]
        col_sql = ", ".join(f'"{c}"' for c in common)

        if pk and pk in common:
            conflict = f' ON CONFLICT ("{pk}") DO NOTHING'
        else:
            conflict = ""

        sql = f'INSERT INTO "{table}" ({col_sql}) VALUES %s{conflict}'
        chunk_size = 200
        for i in range(0, len(values), chunk_size):
            chunk = values[i:i + chunk_size]
            print(f"    {table}: inserting chunk {i//chunk_size + 1}...", flush=True)
            execute_values(pcur, sql, chunk, page_size=100)
            pconn.commit()
            print(f"    {table}: chunk {i//chunk_size + 1} done ({min(i+chunk_size, len(values))}/{len(values)})", flush=True)
        total_rows += len(values)
        print(f"  {table}: {len(values)} rows migrated", flush=True)

    pcur.close()
    pconn.close()
    sconn.close()
    print(f"\nDONE: {total_rows} rows migrated.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", default=os.getenv("DB_SQLITE_PATH", "frontend/public/edumap.db"))
    args = ap.parse_args()
    print(f"Migrating {args.sqlite} -> Postgres ({os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_DATABASE')})")
    migrate(args.sqlite)


if __name__ == "__main__":
    main()
