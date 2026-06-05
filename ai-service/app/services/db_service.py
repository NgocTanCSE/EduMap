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
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM user_events ORDER BY created_at DESC LIMIT %s", (limit,))
            return cur.fetchall()

    def get_education_stats(self, year=2024):
        if not self.conn: return []
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM education_stats WHERE year = %s", (year,))
            return cur.fetchall()

db_service = DBService()
