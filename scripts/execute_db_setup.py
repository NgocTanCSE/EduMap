import os
import psycopg2

def run():
    db_params = {
        'host': 'localhost',
        'port': 5432,
        'database': 'edumap_db',
        'user': 'admin',
        'password': 'password123'
    }
    
    print("Connecting to PostgreSQL database...")
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
    
    cur.close()
    conn.close()
    print("Setup completed successfully!")

if __name__ == "__main__":
    run()
