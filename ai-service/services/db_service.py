import os
import uuid
import psycopg2
import time
from psycopg2.extras import RealDictCursor, Json
from psycopg2 import sql as pg_sql
import json as _json
from dotenv import load_dotenv

load_dotenv()


class DBService:
    def __init__(self):
        self.conn = None
        self._connect_with_retry()

    @staticmethod
    def _coerce_user_id(user_id):
        """chat_histories.user_id la UUID. Bien ky tu sang UUID hop le
        (UUID that rang chi -> dung thang; chuoi khac -> uuid5 on dinh).
        Trach loi 'invalid input syntax for type uuid' khi client gui user_id khong phai UUID."""
        if user_id is None or user_id == "":
            return None
        if isinstance(user_id, uuid.UUID):
            return user_id
        try:
            return uuid.UUID(str(user_id))
        except (ValueError, TypeError, AttributeError):
            return uuid.uuid5(uuid.NAMESPACE_DNS, str(user_id))

    def _connect_with_retry(self, max_retries=3, delay=1):
        for i in range(max_retries):
            try:
                self.conn = psycopg2.connect(
                    host=os.getenv("DB_HOST", "localhost"),
                    port=os.getenv("DB_PORT", "5432"),
                    database=os.getenv("DB_DATABASE", "edumap_db"),
                    user=os.getenv("DB_USERNAME", "admin"),
                    password=os.getenv("DB_PASSWORD", "password123")
                )
                print("DB connection successful")
                return
            except Exception as e:
                print(f"DB connection attempt {i+1}/{max_retries} failed: {e}")
                if i < max_retries - 1:
                    time.sleep(delay)
        print("DB connection FAILED after all retries")

    # Mapping type_id (DB column) -> type label (entity getter semantics).
    # map_points stores the category as the integer column `type_id`; the
    # TypeORM entity exposes a `type` getter derived from it. Raw SQL in this
    # service must use the physical column `type_id` (and `verified`, not
    # `is_verified`) to match the actual schema.
    TYPE_NAME_MAP = {
        1: 'university', 2: 'school', 3: 'library', 4: 'bookstore',
        5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe', 9: 'restaurant',
    }

    def _rollback(self):
        """Reset an aborted PostgreSQL transaction on the shared connection.

        A failed statement leaves the connection's transaction in an aborted
        state, which makes EVERY subsequent statement fail with
        'current transaction is aborted'. Rolling back clears that state so a
        single bad query does not take the whole request down.
        """
        try:
            if self.conn:
                self.conn.rollback()
        except Exception:
            pass

    def _category_to_type_id(self, category):
        """Map a category name/string to the map_points.type_id integer."""
        if category is None:
            return None
        key = str(category).strip().lower()
        for tid, name in self.TYPE_NAME_MAP.items():
            if key == name:
                return tid
        # Numeric category passed directly?
        try:
            val = int(key)
            return val if val in self.TYPE_NAME_MAP else None
        except (TypeError, ValueError):
            return None

    def get_user_events(self, limit=1000):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM user_events ORDER BY created_at DESC LIMIT %s", (limit,))
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching user events: {e}")
            self._rollback()
            return []

    def get_education_stats(self, year=2024):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM education_stats WHERE year = %s", (year,))
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching education stats: {e}")
            self._rollback()
            return []

    def get_education_stats_all(self):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM education_stats ORDER BY year DESC")
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching all education stats: {e}")
            self._rollback()
            return []

    def get_nearby_locations(self, lat, lng, radius_km=5.0, category=None, limit=50):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT id, name, description, type_id, address, city, district,
                           ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
                           rating_avg, rating_count, verified
                    FROM map_points 
                    WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, %s)
                """
                params = [lng, lat, radius_km * 1000]

                type_filter = self._category_to_type_id(category) if category else None
                if type_filter is not None:
                    query += " AND type_id = %s"
                    params.append(type_filter)

                query += " ORDER BY ST_Distance(location, ST_MakePoint(%s, %s)::geography) LIMIT %s"
                params.extend([lng, lat, limit])

                cur.execute(query, params)
                rows = cur.fetchall()
                # Expose the legacy keys the routers read (type / category_id /
                # is_verified) so callers don't break after the schema fix.
                for row in rows:
                    row['type'] = self.TYPE_NAME_MAP.get(row.get('type_id'), 'other')
                    row['category_id'] = row.get('type_id')
                    row['is_verified'] = row.get('verified')
                return rows
        except Exception as e:
            print(f"Error fetching nearby locations: {e}")
            self._rollback()
            return []

    def get_locations_for_analysis(self):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, type_id as type, 
                           ST_X(location) as lng, ST_Y(location) as lat
                    FROM map_points 
                    WHERE location IS NOT NULL
                """)
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching locations for analysis: {e}")
            self._rollback()
            return []

    def save_chat_history(self, user_id: str, message: str, response: str, sources: list, context: dict = None):
        if not self.conn: return None
        try:
            ctx = dict(context or {})
            if sources:
                ctx["sources"] = sources
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO chat_histories (user_id, message, response, context)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (str(self._coerce_user_id(user_id)), message, response, Json(ctx)))
                self.conn.commit()
                return cur.fetchone()
        except Exception as e:
            print(f"Error saving chat history: {e}")
            self.conn.rollback()
            return None

    def get_chat_history(self, user_id: str, limit: int = 50):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, message, response, context, created_at
                    FROM chat_histories
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (str(self._coerce_user_id(user_id)), limit))
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching chat history: {e}")
            self._rollback()
            return []

db_service = DBService()
