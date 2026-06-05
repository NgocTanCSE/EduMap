import pandas as pd
import psycopg2
from psycopg2 import sql
import sys
import re
import os
from dotenv import load_dotenv

# Load .env file from the project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- Database Configuration ---
DB_CONFIG = {
    "host": "localhost",
    "port": os.getenv("POSTGRES_PORT_EXTERNAL", "5432"), # Use POSTGRES_PORT_EXTERNAL from .env
    "dbname": os.getenv("DB_DATABASE", "edumap_db"),
    "user": os.getenv("DB_USERNAME", "admin"),
    "password": os.getenv("DB_PASSWORD", "password123")
}

EXCEL_FILE_PATH = 'EduMap_Documentation.xlsx'

def slugify(text):
    if not isinstance(text, str):
        return str(text)
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip('-')

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"FATAL: Could not connect to database: {e}", file=sys.stderr)
        sys.exit(1)

def seed_modules(conn):
    try:
        df = pd.read_excel(EXCEL_FILE_PATH, sheet_name='2. Danh Sách Module')
        col_id = 'MĂ£ Module' if 'MĂ£ Module' in df.columns else 'Mã Module'
        col_name = 'TĂªn Module' if 'TĂªn Module' in df.columns else 'Tên Module'
        col_desc = 'MĂ´ táº£' if 'MĂ´ táº£' in df.columns else 'Mô tả'

        with conn.cursor() as cur:
            for _, row in df.iterrows():
                if pd.notna(row[col_id]):
                    cur.execute("INSERT INTO modules (id, name, description) VALUES (%s, %s, %s) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;",
                                (str(row[col_id]), str(row[col_name]), str(row[col_desc]) if pd.notna(row[col_desc]) else ""))
        conn.commit()
        print("Seeded modules.")
    except Exception as e:
        print(f"Error seeding modules: {e}")

def seed_features(conn):
    try:
        df = pd.read_excel(EXCEL_FILE_PATH, sheet_name='3. Chi Tiết Chức Năng')
        col_module = 'Module'
        col_name = 'TĂªn chá»©c nÄƒng' if 'TĂªn chá»©c nÄƒng' in df.columns else 'Tên chức năng'
        col_desc = 'MĂ´ táº£ chi tiáº¿t' if 'MĂ´ táº£ chi tiáº¿t' in df.columns else 'Mô tả chi tiết'

        with conn.cursor() as cur:
            for _, row in df.iterrows():
                if pd.notna(row[col_name]):
                    f_name = str(row[col_name])
                    f_id = slugify(f_name)[:50] # Limit to 50 chars as per schema
                    m_id = str(row[col_module]) if pd.notna(row[col_module]) else None
                    # Verify if module exists
                    cur.execute("SELECT id FROM modules WHERE id = %s", (m_id,))
                    if cur.fetchone():
                        cur.execute("INSERT INTO features (id, name, description, module_id) VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, module_id = EXCLUDED.module_id;",
                                    (f_id, f_name, str(row[col_desc]) if pd.notna(row[col_desc]) else "", m_id))
        conn.commit()
        print("Seeded features.")
    except Exception as e:
        print(f"Error seeding features: {e}")

def main():
    conn = get_db_connection()
    seed_modules(conn)
    seed_features(conn)
    # seed_roles(conn) # Removed to avoid conflict with seed.sql
    # seed_admin(conn) # Removed to avoid conflict with seed.sql
    print("Database seeding completed successfully for the new schema!")
    conn.close()

if __name__ == "__main__":
    main()
