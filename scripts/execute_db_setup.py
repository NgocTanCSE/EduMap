import os
import psycopg2
from dotenv import load_dotenv

# Load .env file from the project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

def run():
    db_params = {
        'host': os.getenv("DB_HOST", "localhost"),
        'port': os.getenv("DB_PORT", os.getenv("POSTGRES_PORT_EXTERNAL", "5432")),
        'database': os.getenv("DB_DATABASE", "edumap_db"),
        'user': os.getenv("DB_USERNAME", "admin"),
        'password': os.getenv("DB_PASSWORD", "password123")
    }
    
    print(f"Connecting to PostgreSQL database at {db_params['host']}:{db_params['port']}...")
    conn = psycopg2.connect(**db_params)
    conn.autocommit = True
    cur = conn.cursor()
    
    # 1. Drop all tables in the public schema to ensure a clean start
    print("Dropping existing tables in the database...")
    cur.execute("""
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO admin;
        GRANT ALL ON SCHEMA public TO public;
    """)
    
    # 2. Read and execute schema.sql
    schema_path = os.path.join('backend', 'src', 'database', 'schema.sql')
    print(f"Reading {schema_path}...")
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
        
    print("Executing schema.sql...")
    cur.execute(schema_sql)
    print("Schema created successfully.")
    
    # 3. Read and execute seed.sql
    seed_path = os.path.join('backend', 'src', 'database', 'seed.sql')
    print(f"Reading {seed_path}...")
    with open(seed_path, 'r', encoding='utf-8') as f:
        seed_sql = f.read()
        
    print("Executing seed.sql...")
    cur.execute(seed_sql)
    print("Database seeded successfully.")

    # 4. Read and execute seed_crawled_data.sql
    crawled_data_path = 'seed_crawled_data.sql'
    if os.path.exists(crawled_data_path):
        print(f"Reading {crawled_data_path}...")
        with open(crawled_data_path, 'r', encoding='utf-8') as f:
            crawled_sql = f.read()
        print("Executing seed_crawled_data.sql...")
        cur.execute(crawled_sql)
        print("Crawled data seeded successfully.")

    # 5. Read and execute init_analytics_db.sql

    analytics_path = os.path.join('scripts', 'init_analytics_db.sql')
    if os.path.exists(analytics_path):
        print(f"Reading {analytics_path}...")
        with open(analytics_path, 'r', encoding='utf-8') as f:
            analytics_sql = f.read()
            
        print("Executing init_analytics_db.sql (Analytics + Seed)...")
        cur.execute(analytics_sql)
        print("Analytics database initialized successfully.")
    
    cur.close()
    conn.close()
    print("Setup completed successfully!")

if __name__ == "__main__":
    run()
