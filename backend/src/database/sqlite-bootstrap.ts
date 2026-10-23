import { Logger } from '@nestjs/common';
import * as fs from 'fs';

/**
 * SQLite bootstrap / schema self-healing for HF Spaces.
 *
 * WHY THIS EXISTS
 * On HF Spaces the backend runs against a *pre-built* SQLite file
 * (`DB_SQLITE_PATH=/app/frontend/public/edumap.db`) with
 * `DB_SYNC=false`, so TypeORM never creates or alters anything. That file can
 * lag behind the entities (it still carried `role_id` and camelCase auth
 * columns after the CA02 role refactor), which makes every user query fail.
 *
 * This runs once at boot, before Nest/TypeORM initialize, and is idempotent:
 *   • adds `users.role` and backfills it from `role_id` when missing
 *   • renames legacy camelCase auth columns to the snake_case names the
 *     entities expect
 *   • adds `comments.status`, required by AI-only comment moderation
 *
 * It is a no-op on Postgres, in-memory DBs, and DBs that are already current.
 */

/** roles.id → UserRole, matching backend/src/database/migrations/1830000000000-CreateUserRoleEnum.ts */
const ROLE_BY_ROLE_ID: Record<number, string> = {
  1: 'super_admin',
  2: 'admin',
  3: 'moderator',
  4: 'school_rep',
  5: 'university_rep',
  6: 'business_partner',
  7: 'sponsor',
  8: 'teacher',
  9: 'mentor',
  10: 'volunteer',
  11: 'student',
  12: 'guest',
};

/** Legacy camelCase column → snake_case column expected by the entities. */
const COLUMN_RENAMES: Array<[string, string]> = [
  ['twoFactorSecret', 'two_factor_secret'],
  ['isTwoFactorEnabled', 'is_two_factor_enabled'],
  ['refreshTokenHash', 'refresh_token_hash'],
];

function openDb(path: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite3 = require('sqlite3');
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, (err: Error | null) =>
      err ? reject(err) : resolve(db),
    );
  });
}

function exec(db: any, sql: string): Promise<void> {
  return new Promise((resolve, reject) =>
    db.exec(sql, (err: Error | null) => (err ? reject(err) : resolve())),
  );
}

function all(db: any, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) =>
    db.all(sql, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows || []))),
  );
}

function close(db: any): Promise<void> {
  return new Promise((resolve) => db.close(() => resolve()));
}

export async function ensureSqliteSchema(): Promise<void> {
  if (process.env.DB_TYPE === 'postgres') return;

  const dbPath = process.env.DB_SQLITE_PATH || ':memory:';
  if (dbPath === ':memory:' || !fs.existsSync(dbPath)) return;

  const logger = new Logger('SqliteBootstrap');
  let db: any;

  try {
    db = await openDb(dbPath);

    const tables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    );
    if (tables.length === 0) return;

    const columns: any[] = await all(db, 'PRAGMA table_info(users)');
    const names = new Set<string>(columns.map((c) => String(c.name)));
    const changes: string[] = [];

    // 1. Legacy camelCase → snake_case (only when the new name is absent).
    for (const [from, to] of COLUMN_RENAMES) {
      if (names.has(from) && !names.has(to)) {
        await exec(db, `ALTER TABLE users RENAME COLUMN "${from}" TO "${to}"`);
        names.delete(from);
        names.add(to);
        changes.push(`${from} → ${to}`);
      }
    }

    // 2. `role` column (CA02). Postgres gets it from a migration; SQLite needs it here.
    let roleWasAdded = false;
    if (!names.has('role')) {
      await exec(db, "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'");
      names.add('role');
      roleWasAdded = true;
      changes.push('added role');
    }

    if (names.has('role_id')) {
      const cases = Object.entries(ROLE_BY_ROLE_ID)
        .map(([id, role]) => `WHEN ${Number(id)} THEN '${role}'`)
        .join(' ');
      // A freshly added column is 'student' for every row, so backfill all of
      // them once. On later boots only fill genuinely empty values, so manual
      // role changes are never overwritten.
      const where = roleWasAdded ? '' : "WHERE role IS NULL OR role = ''";
      const result: any = await new Promise((resolve, reject) =>
        db.run(
          `UPDATE users SET role = CASE CAST(role_id AS INTEGER) ${cases} ELSE 'student' END ${where}`,
          function (this: any, err: Error | null) {
            return err ? reject(err) : resolve({ changes: this?.changes ?? 0 });
          },
        ),
      );
      if (result.changes > 0) changes.push(`backfilled ${result.changes} role(s) from role_id`);
    }

    // 3. `comments.status` (AI-only moderation). The shipped SQLite file predates
    // the entity column, so inserting a comment fails without this heal.
    const commentTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='comments'",
    );
    if (commentTables.length > 0) {
      const commentColumns: any[] = await all(db, 'PRAGMA table_info(comments)');
      const commentNames = new Set<string>(commentColumns.map((c) => String(c.name)));
      if (!commentNames.has('status')) {
        await exec(db, "ALTER TABLE comments ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
        changes.push('added comments.status');
      }
    }

    if (changes.length > 0) {
      logger.log(`SQLite schema updated (${dbPath}): ${changes.join(', ')}`);
    }
  } catch (error: any) {
    // Never block boot on a best-effort heal — surface it loudly instead.
    logger.error(`SQLite bootstrap failed (${dbPath}): ${error?.message || error}`);
  } finally {
    if (db) await close(db);
  }
}
