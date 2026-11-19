import uuid
import random
import json
from datetime import datetime, timedelta

def gen_id():
    return str(uuid.uuid4())

def escape(s):
    if s is None: return "NULL"
    if isinstance(s, dict) or isinstance(s, list):
        return "'" + json.dumps(s).replace("'", "''") + "'"
    return "'" + str(s).replace("'", "''") + "'"

event_types = ['page_view', 'click_career', 'search_scholarship', 'view_ai_trends', 'mentor_booking', 'apply_internship']
pages = ['/dashboard', '/map', '/career', '/scholarships', '/analytics/trends', '/mentor', '/internships']

sql = []

user_ids = [gen_id() for _ in range(50)]

print("-- Seeding user_events")
for i in range(1000):
    uid = random.choice(user_ids)
    etype = random.choice(event_types)
    page = random.choice(pages)
    metadata = {
        "page": page,
        "duration": random.randint(10, 300),
        "device": random.choice(['desktop', 'mobile', 'tablet']),
        "ip": f"192.168.1.{random.randint(1, 255)}"
    }

    created_at = datetime.now() - timedelta(days=random.randint(0, 90), minutes=random.randint(0, 1440))

    sql.append(f"INSERT INTO user_events (id, user_id, event_type, metadata, created_at) VALUES ({escape(gen_id())}, {escape(uid)}, {escape(etype)}, {escape(metadata)}, {escape(created_at.strftime('%Y-%m-%d %H:%M:%S'))});")

with open('backend/src/database/migrations/seed_analytics.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql))

print(f"Successfully generated 1000+ seed records in backend/src/database/migrations/seed_analytics.sql")
