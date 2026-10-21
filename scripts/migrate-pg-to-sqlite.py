#!/usr/bin/env python3
"""
PostgreSQL → SQLite migration for EduMap HF Spaces deployment.
Simplified, robust version using information_schema.
"""
import argparse
import json
import os
import re
import sys
import struct
import sqlite3
import psycopg2

SKIP_TABLES = {
    'audit_logs', 'crawl_history', 'ai_conversations', 'ai_messages',
    'chat_histories', 'chat_messages', 'bookings', 'cart_items',
    'spatial_ref_sys', 'geography_columns', 'geometry_columns',
}

def decode_wkb(wkb_hex):
    if not wkb_hex or not isinstance(wkb_hex, str) or len(wkb_hex) < 42:
        return None
    try:
        raw = bytes.fromhex(wkb_hex)
        if len(raw) < 21:
            return None
        byte_order = raw[0]
        fmt = '<' if byte_order == 1 else '>'
        geom_type = struct.unpack(f'{fmt}I', raw[1:5])[0]

        # PostGIS EWKB flags: 0x20000000 = SRID, 0x80000000 = Z
        has_srid = bool(geom_type & 0x20000000)
        has_z = bool(geom_type & 0x80000000)
        geom_clean = geom_type & 0xFF  # lower 8 bits = geometry type

        off = 5
        if has_srid:
            off += 4  # skip 4-byte SRID
        # Skip bounding box if present (EWKB bbox flag 0x100)
        if geom_type & 0x100:
            off += 32  # skip bbox (2 doubles)

        if geom_clean == 1:  # Point
            x, y = struct.unpack(f'{fmt}dd', raw[off:off+16])
            return {"type": "Point", "coordinates": [round(x, 7), round(y, 7)]}
        return None
    except Exception:
        return None

def convert_value(col_type, val):
    if val is None:
        return None
    t = (col_type or '').lower().strip()
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    if 'geography' in t or 'geometry' in t:
        if isinstance(val, str) and len(val) > 40 and re.match(r'^[0-9a-f]+$', val.lower()):
            g = decode_wkb(val)
            return json.dumps(g) if g else None
        return json.dumps(val)
    if 'uuid' in t:
        return str(val)
    if 'json' in t or isinstance(val, (dict, list)):
        return json.dumps(val)
    if 'bool' in t:
        return 1 if val else 0
    if 'numeric' in t or 'decimal' in t or 'real' in t or 'double' in t:
        return float(val)
    if '[]' in t:
        return json.dumps(val) if isinstance(val, list) else str(val)
    if 'timestamp' in t or 'date' in t or 'time' in t:
        if hasattr(val, 'isoformat'):
            return val.isoformat()
        return str(val)
    return val

import re

def pg_type_to_sqlite(t):
    t = (t or '').lower().strip()
    if 'serial' in t or 'uuid' in t:
        return 'INTEGER' if 'serial' in t else 'TEXT'
    if 'geography' in t or 'geometry' in t:
        return 'TEXT'
    if 'json' in t:
        return 'TEXT'
    if 'bool' in t:
        return 'INTEGER'
    if 'smallint' in t or 'integer' in t or 'bigint' in t:
        return 'INTEGER'
    if 'numeric' in t or 'decimal' in t or 'real' in t or 'double' in t:
        return 'REAL'
    if 'char' in t or 'text' in t:
        return 'TEXT'
    if 'timestamp' in t or 'date' in t or 'time' in t:
        return 'TEXT'
    return 'TEXT'

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--output', default='/app/public/edumap.db')
    p.add_argument('--pg-host', default='localhost')
    p.add_argument('--pg-port', type=int, default=5433)
    p.add_argument('--pg-db', default='edumap_db')
    p.add_argument('--pg-user', default='edumap')
    p.add_argument('--pg-password', default='edumap_password')
    args = p.parse_args()

    # Connect to PostgreSQL
    for host in ['postgres', 'localhost']:
        try:
            pg = psycopg2.connect(
                host=host, port=args.pg_port, dbname=args.pg_db,
                user=args.pg_user, password=args.pg_password, connect_timeout=5)
            print(f"✅ Connected to PG at {host}:{args.pg_port}")
            break
        except Exception as e:
            print(f"  trying {host}: {e}")
    else:
        print("❌ Cannot connect to PostgreSQL"); sys.exit(1)

    cur = pg.cursor()

    # Get tables
    cur.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN %s
        ORDER BY tablename
    """, (tuple(SKIP_TABLEs),)) if False else cur.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    """)
    all_tables = [r[0] for r in cur.fetchall()]
    tables = [t for t in all_tables if t not in SKIP_TABLES]
    print(f"📊 {len(tables)} tables to migrate (skipped {len(all_tables)-len(tables)})")

    # Create SQLite
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    if os.path.exists(args.output):
        os.remove(args.output)
    sq = sqlite3.connect(args.output)
    sq.execute('PRAGMA journal_mode=WAL')
    sq.execute('PRAGMA synchronous=NORMAL')
    sq.execute('PRAGMA cache_size=-20000')
    scur = sq.cursor()

    for table in tables:
        try:
            # Get column info from information_schema (include udt_name for geography)
            cur.execute("""
                SELECT column_name, data_type, udt_name, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table,))
            col_info = cur.fetchall()
            if not col_info:
                print(f"  ⚠️ {table}: no columns")
                continue

            # Get PK columns
            cur.execute("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                JOIN pg_class c ON c.oid = i.indrelid
                WHERE i.indisprimary AND c.relname = %s
            """, (table,))
            pk_cols = set(r[0] for r in cur.fetchall())

            # Build CREATE TABLE
            col_defs = []
            for col_name, data_type, udt_name, is_nullable, col_default in col_info:
                is_serial = col_default and 'nextval' in str(col_default)
                col_type = udt_name or data_type  # udt_name has the real type (geography, uuid, jsonb)
                if is_serial:
                    sqlite_type = 'INTEGER'
                elif col_type in ('geography', 'geometry'):
                    sqlite_type = 'TEXT'
                else:
                    sqlite_type = pg_type_to_sqlite(col_type)
                is_pk = col_name in pk_cols
                parts = [f'"{col_name}"', sqlite_type]
                if is_pk and is_serial:
                    parts.append('PRIMARY KEY AUTOINCREMENT')
                if is_nullable == 'NO':
                    parts.append('NOT NULL')
                col_defs.append(' '.join(parts))

            scur.execute(f'DROP TABLE IF EXISTS "{table}"')
            scur.execute(f'CREATE TABLE "{table}" ({", ".join(col_defs)})')

            # Get data
            cur.execute(f'SELECT * FROM "{table}"')
            rows = cur.fetchall()
            col_names = [d[0] for d in cur.description]
            # Use udt_name for type detection (geography, uuid, jsonb)
            col_types = [info[2] or info[1] for info in col_info]

            if not rows:
                print(f"  {table}: 0 rows")
                continue

            # Convert and insert
            placeholders = ','.join(['?'] * len(col_names))
            cols_quoted = ', '.join(f'"{c}"' for c in col_names)
            insert_sql = f'INSERT INTO "{table}" ({cols_quoted}) VALUES ({placeholders})'

            for row in rows:
                converted = []
                for i, val in enumerate(row):
                    converted.append(convert_value(col_types[i], val))
                try:
                    scur.execute(insert_sql, converted)
                except Exception as e:
                    print(f"  warn: {table} row insert fail: {e}")
            sq.commit()
            print(f"  ✅ {table}: {len(rows)} rows")

        except Exception as e:
            print(f"  ❌ {table}: {e}")
            sq.rollback()

    pg.close()
    sq.close()
    size = os.path.getsize(args.output) / (1024*1024)
    print(f"\n✅ SQLite DB: {args.output} ({size:.1f} MB)")

if __name__ == '__main__':
    import sys
    main()
