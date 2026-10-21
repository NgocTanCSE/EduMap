#!/usr/bin/env python3
"""
CA01: DB drift detector (CI check).

Compares the PostgreSQL schema definition (src/database/schema.sql) against
the TypeORM entity definitions (src/modules/**/*.entity.ts) and reports any
drift — tables/columns present in one source but missing from the other.

This is a STATIC analysis tool (no DB connection required, no node_modules
needed).  It parses:
  1. schema.sql  → {table: set(column_names)}   (SQL DDL)
  2. *.entity.ts → {table: set(column_names)}   (TypeORM decorators)

Exit codes:
  0  — no drift (schema ↔ entities aligned)
  1  — drift detected (see stdout for details)

Usage:
  python3 scripts/check-db-drift.py
  python3 scripts/check-db-drift.py --schema src/database/schema.sql
  python3 scripts/check-db-drift.py --entities-dir src/modules

Environment overrides:
  DRIFT_SCHEMA          path to schema.sql (default: src/database/schema.sql)
  DRIFT_ENTITIES_DIR    path to entities dir  (default: src/modules)
  DRIFT_MIGRATIONS_DIR  path to migrations dir (default: src/database/migrations)
  DRIFT_IGNORE_TABLES   comma-separated table names to ignore (info only)
"""
from __future__ import annotations

import glob
import os
import re
import sys


# ── SQL parsing ──────────────────────────────────────────────────────────

_COL_NAME_RE = re.compile(
    r'^\s*(?:"([^"]+)"|(?:"([^"]+)"\s)|`?(\w+)`?|(\w+))\b',
)


def _strip_sql_comments(text: str) -> str:
    """Remove -- line comments and /* block */ comments."""
    text = re.sub(r"--.*?$", "", text, flags=re.MULTILINE)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return text


def parse_sql_tables(path: str) -> dict[str, set[str]]:
    """
    Parse a SQL schema file and return {table_lower: set(column_names)}.

    Handles PostgreSQL + SQLite CREATE TABLE syntax:
      CREATE TABLE [IF NOT EXISTS] "name" (  or  CREATE TABLE name (
    Column lines:  "col_name" TYPE  |  col_name TYPE
    Skips CONSTRAINT, PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, KEY lines.
    """
    with open(path, encoding="utf-8") as fh:
        text = _strip_sql_comments(fh.read())

    table_re = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"
        r'(?:"([^"]+)"|`([^`]+)`|(\w+))\s*\(',
        re.IGNORECASE,
    )

    result: dict[str, set[str]] = {}
    for m in table_re.finditer(text):
        name = (m.group(1) or m.group(2) or m.group(3)).lower()

        # Extract the column block between the outer parens.
        start = m.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            ch = text[i]
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            i += 1
        block = text[start : i - 1]

        cols: set[str] = set()
        for line in block.split("\n"):
            line = line.strip().rstrip(",")
            if not line:
                continue
            # Skip constraint / key declarations.
            if re.match(
                r"(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|KEY|ALTER)",
                line,
                re.IGNORECASE,
            ):
                continue
            # Column definition: [optional quotes] col_name TYPE [constraints...]
            col_m = _COL_NAME_RE.match(line)
            if col_m and col_m.group(0).strip():
                col = col_m.group(1) or col_m.group(2) or col_m.group(3) or col_m.group(4)
                upper = col.upper()
                if upper in ("PRIMARY", "FOREIGN", "UNIQUE", "CONSTRAINT", "CHECK"):
                    continue
                cols.add(col.lower())
        result[name] = cols

    return result


def parse_sql_extra_tables(migration_dir: str) -> dict[str, set[str]] | None:
    """Scan *.sql migration files for CREATE TABLE / ADD COLUMN (informational)."""
    if not os.path.isdir(migration_dir):
        return None
    merged: dict[str, set[str]] = {}
    for sql_file in sorted(glob.glob(os.path.join(migration_dir, "*.sql"))):
        try:
            tables = parse_sql_tables(sql_file)
        except OSError:
            continue
        for tbl, cols in tables.items():
            merged.setdefault(tbl, set()).update(cols)
    return merged if merged else None


# ── Entity parsing ───────────────────────────────────────────────────────

_ENTITY_RE = re.compile(r"""@Entity\(\s*(['"])([^'"]+)\1\s*\)""")

_DECORATOR_RE = re.compile(
    r"""@(PrimaryGeneratedColumn|Column|CreateDateColumn|UpdateDateColumn|JoinColumn)\s*\(([^)]*)\)\s*\n\s*(?:readonly\s+)?(\w+)\s*[\?:]""",
)

_NAME_RE = re.compile(r"name:\s*['\"]([^'\"]+)['\"]")


def _extract_name(args: str) -> str | None:
    """Return the `name` option value from a decorator args string, if present."""
    m = _NAME_RE.search(args)
    return m.group(1) if m else None


def parse_entity_tables(entities_dir: str) -> dict[str, set[str]]:
    """
    Parse TypeORM entity files and return {table_lower: set(column_names)}.

    Maps:
      @PrimaryGeneratedColumn(...)   → 'id'
      @CreateDateColumn()            → property name (e.g. created_at)
      @UpdateDateColumn()            → property name (e.g. updated_at)
      @Column({ name: 'x', ...})     → 'x'
      @Column(...) / @Column()       → property name
      @JoinColumn({ name: 'x' })     → 'x'  (FK relation column)
    """
    result: dict[str, set[str]] = {}
    for path in sorted(glob.glob(os.path.join(entities_dir, "**", "*.entity.ts"), recursive=True)):
        try:
            with open(path, encoding="utf-8") as fh:
                content = fh.read()
        except OSError:
            continue

        ent_m = _ENTITY_RE.search(content)
        if not ent_m:
            continue
        table = ent_m.group(2).lower()

        cols: set[str] = set()
        for dec, args, prop in _DECORATOR_RE.findall(content):
            if dec == "PrimaryGeneratedColumn":
                cols.add("id")
            elif dec in ("CreateDateColumn", "UpdateDateColumn"):
                cols.add(prop.lower())
            else:  # Column or JoinColumn
                name = _extract_name(args)
                cols.add((name or prop).lower())
        result[table] = cols

    return result


# ── Comparison ───────────────────────────────────────────────────────────


def _sorted(items: set[str]) -> list[str]:
    return sorted(items)


def run_drift_check(
    schema_path: str,
    entities_dir: str,
    migrations_dir: str | None = None,
    ignore: set[str] | None = None,
) -> int:
    ignore = ignore or set()

    schema_tables = parse_sql_tables(schema_path)
    entity_tables = parse_entity_tables(entities_dir)

    # --- Table-level drift ---
    schema_set = set(schema_tables)
    entity_set = set(entity_tables)

    schema_only = sorted((schema_set - entity_set) - ignore)
    entity_only = sorted((entity_set - schema_set) - ignore)

    drift_found = False

    print("=" * 64)
    print("CA01 DB DRIFT CHECK — schema.sql ↔ TypeORM entities")
    print("=" * 64)
    print(f"  schema.sql tables : {len(schema_set)}")
    print(f"  entity files      : {len(entity_set)}")

    if schema_only:
        drift_found = True
        print(f"\n⚠️  Tables in schema.sql WITHOUT entity ({len(schema_only)}):")
        for t in schema_only:
            print(f"     - {t} ({len(schema_tables[t])} columns)")
    else:
        print("\n✅ All schema.sql tables have entities.")

    if entity_only:
        drift_found = True
        print(f"\n⚠️  Tables with entity WITHOUT schema.sql ({len(entity_only)}):")
        for t in entity_only:
            print(f"     - {t}")
    else:
        print("✅ All entities have schema.sql tables.")

    # --- Column-level drift (only for tables present in BOTH) ---
    shared = sorted((schema_set & entity_set) - ignore)
    col_issues = 0
    for table in shared:
        s_cols = schema_tables[table]
        e_cols = entity_tables.get(table, set())
        missing_in_entity = s_cols - e_cols
        missing_in_schema = e_cols - s_cols
        if missing_in_entity or missing_in_schema:
            col_issues += 1
            drift_found = True
            print(f"\n⚠️  Column drift in '{table}':")
            if missing_in_entity:
                print(f"     schema → missing entity column(s): {_sorted(missing_in_entity)}")
            if missing_in_schema:
                print(f"     entity → missing schema column(s): {_sorted(missing_in_schema)}")

    if col_issues:
        print(f"\n⚠️  {col_issues} table(s) have column-level drift.")
    else:
        print("\n✅ All shared tables have matching column names.")

    # --- Migration files (informational) ---
    if migrations_dir:
        extra = parse_sql_extra_tables(migrations_dir)
        if extra:
            mig_only = sorted((set(extra) - schema_set - entity_set) - ignore)
            if mig_only:
                print(f"\nℹ️  Migration .sql files define {len(mig_only)} additional table(s) "
                      f"not in schema.sql/entities (informational, not drift):")
                for t in mig_only:
                    print(f"     - {t}")

    # --- Summary ---
    print("\n" + "=" * 64)
    if drift_found:
        print("❌ DRIFT DETECTED — fail (review above).")
        return 1
    print("✅ No drift detected — schema.sql ↔ entities aligned.")
    return 0


def main() -> int:
    schema_path = os.environ.get("DRIFT_SCHEMA", "src/database/schema.sql")
    entities_dir = os.environ.get("DRIFT_ENTITIES_DIR", "src/modules")
    migrations_dir = os.environ.get("DRIFT_MIGRATIONS_DIR", "src/database/migrations")
    ignore_csv = os.environ.get("DRIFT_IGNORE_TABLES", "")
    ignore = {t.strip().lower() for t in ignore_csv.split(",") if t.strip()}

    # Resolve relative to backend/ (script lives in backend/scripts/)
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not os.path.isabs(schema_path):
        schema_path = os.path.join(base, schema_path)
    if not os.path.isabs(entities_dir):
        entities_dir = os.path.join(base, entities_dir)
    if migrations_dir and not os.path.isabs(migrations_dir):
        migrations_dir = os.path.join(base, migrations_dir)

    if not os.path.isfile(schema_path):
        print(f"✗ schema.sql not found: {schema_path}")
        return 2
    if not os.path.isdir(entities_dir):
        print(f"✗ entities dir not found: {entities_dir}")
        return 2

    return run_drift_check(schema_path, entities_dir, migrations_dir, ignore)


if __name__ == "__main__":
    sys.exit(main())
