import psycopg2
import os
import uuid
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_DATABASE", "edumap_db"),
    "user": os.getenv("DB_USERNAME", "admin"),
    "password": os.getenv("DB_PASSWORD", "password123")
}

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def seed_dongnai_unis(cur):
    json_path = os.path.join(os.path.dirname(__file__), '..', 'crawled_data', 'dongnai_unis.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    inserted = 0
    for item in data:
        name = item.get('name', '')
        lat = item.get('lat', 0)
        lng = item.get('lng', 0)
        uni_type = item.get('type', 'university')
        operator = item.get('operator') or ''
        
        type_id = 1 if uni_type == 'university' else 2
        point_id = str(uuid.uuid4())
        description = f'Type: {uni_type}, Operator: {operator}' if operator else f'Type: {uni_type}'
        
        cur.execute("""
            INSERT INTO map_points (id, name, description, type_id, city, address, location, status)
            VALUES (%s, %s, %s, %s, %s, %s, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                type_id = EXCLUDED.type_id
        """, (point_id, name, description, type_id, 'Đồng Nai', 'Đang cập nhật', lng, lat, 'active'))
        inserted += 1
    
    print(f"Seeded {inserted} university/college records from dongnai_unis.json")

def main():
    conn = get_db_connection()
    if not conn:
        return
    
    cur = conn.cursor()
    try:
        print("Seeding Dong Nai Universities/Colleges...")
        seed_dongnai_unis(cur)
        conn.commit()
        print("Seeding completed successfully!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        conn.rollback()
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    main()