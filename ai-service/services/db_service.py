import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

class DBService:
    def __init__(self):
        self.conn = None
        try:
            self.conn = psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                port=os.getenv("DB_PORT", "5432"),
                database=os.getenv("DB_DATABASE", "edumap_db"),
                user=os.getenv("DB_USERNAME", "admin"),
                password=os.getenv("DB_PASSWORD", "password123")
            )
        except Exception as e:
            print(f"Error connecting to DB: {e}")

    def get_user_events(self, limit=1000):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM user_events ORDER BY created_at DESC LIMIT %s", (limit,))
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching user events: {e}")
            return []

    def get_education_stats(self, year=2024):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM education_stats WHERE year = %s", (year,))
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching education stats: {e}")
            return []

    def get_nearby_locations(self, lat, lng, radius_km=5.0, category=None, limit=50):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT id, name, description, category_id, address, city, district, 
                           ST_X(location) as lng, ST_Y(location) as lat,
                           rating_avg, rating_count, is_verified
                    FROM map_points 
                    WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, %s)
                """
                params = [lng, lat, radius_km * 1000]
                
                if category:
                    query += " AND LOWER(type) LIKE LOWER(%s)"
                    params.append(f"%{category}%")
                
                query += " ORDER BY ST_Distance(location, ST_MakePoint(%s, %s)::geography) LIMIT %s"
                params.extend([lng, lat, limit])
                
                cur.execute(query, params)
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching nearby locations: {e}")
            return []

    def get_locations_for_analysis(self):
        if not self.conn: return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, type, 
                           ST_X(location) as lng, ST_Y(location) as lat
                    FROM map_points 
                    WHERE location IS NOT NULL
                """)
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching locations for analysis: {e}")
            return []

    def save_chat_history(self, user_id: str, message: str, response: str, sources: list, context: dict = None):
        if not self.conn: return None
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO chat_histories (user_id, message, response, context)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (user_id, message, response, context or {}))
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
                """, (user_id, limit))
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching chat history: {e}")
            return []

db_service = DBService()
