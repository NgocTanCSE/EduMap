import os
import threading
from typing import Any, Dict, List, Optional, Sequence

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2.pool import ThreadedConnectionPool
    _HAS_PSYCOPG = True
except ImportError:
    psycopg2 = None
    RealDictCursor = None
    ThreadedConnectionPool = None
    _HAS_PSYCOPG = False


_POOL_LOCK = threading.Lock()
_POOL: Optional["ThreadedConnectionPool"] = None


def is_postgres() -> bool:
    """True when the shared database is Postgres (production default)."""
    return (os.getenv("DB_TYPE", "postgres") or "postgres").strip().lower() != "sqlite"


def configured() -> bool:
    """True when DB host/credentials are present and psycopg2 is importable."""
    return _cfg() is not None


def _cfg() -> Optional[Dict[str, Any]]:
    if not _HAS_PSYCOPG:
        return None
    host = (os.getenv("DB_HOST") or "").strip()
    if not host:
        return None
    try:
        port = int(os.getenv("DB_PORT", "5432"))
        timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "10"))
    except ValueError:
        port, timeout = 5432, 10
    return {
        "host": host,
        "port": port,
        "user": os.getenv("DB_USERNAME") or None,
        "password": os.getenv("DB_PASSWORD") or None,
        "dbname": os.getenv("DB_DATABASE") or None,
        "connect_timeout": timeout,
        "sslmode": os.getenv("DB_SSLMODE", "prefer"),
    }


def _pool() -> Optional["ThreadedConnectionPool"]:
    global _POOL
    cfg = _cfg()
    if cfg is None:
        return None
    if _POOL is not None:
        return _POOL
    with _POOL_LOCK:
        if _POOL is None:
            try:
                max_conn = int(os.getenv("AI_DB_POOL_MAX", "4"))
            except ValueError:
                max_conn = 4
            _POOL = ThreadedConnectionPool(1, max(1, max_conn), **cfg)
    return _POOL


def borrow():
    """Return the shared connection pool (``None`` when not configured)."""
    return _pool()


def _reset_pool() -> None:
    """Drop the pool after a connection-level failure so the next call retries."""
    global _POOL
    with _POOL_LOCK:
        pool, _POOL = _POOL, None
    if pool is not None:
        try:
            pool.closeall()
        except Exception:
            pass


def query(sql: str, params: Optional[Sequence[Any]] = None) -> List[Dict[str, Any]]:
    """Run a read-only query against Postgres and return rows as plain dicts.

    Returns ``[]`` (never raises) when the database is not configured, the
    connection is refused, or the SQL fails — every caller is an AI fallback
    that must degrade to an empty result instead of a 500. Statements are sent
    unnamed, so Supabase's transaction-mode PgBouncer never sees a reused
    prepared statement.
    """
    pool = _pool()
    if pool is None:
        return []
    conn = None
    broken = False
    try:
        conn = pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, tuple(params) if params else None)
            rows = [dict(r) for r in cur.fetchall()]
        conn.rollback()
        return rows
    except Exception as exc:
        broken = bool(_HAS_PSYCOPG) and isinstance(
            exc, (psycopg2.OperationalError, psycopg2.InterfaceError)
        )
        try:
            if conn is not None:
                conn.rollback()
        except Exception:
            pass
        return []
    finally:
        if conn is not None:
            try:
                pool.putconn(conn)
            except Exception:
                broken = True
        if broken:
            _reset_pool()


def scalar(sql: str, params: Optional[Sequence[Any]] = None) -> Any:
    rows = query(sql, params)
    if not rows:
        return None
    return next(iter(rows[0].values()), None)