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

# Mock data for seeding
event_types = ['page_view', 'click_career', 'search_scholarship', 'view_ai_trends', 'mentor_booking', 'apply_internship']
pages = ['/dashboard', '/map', '/career', '/scholarships', '/analytics/trends', '/mentor', '/internships']
regions = ['Đồng Nai', 'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ']

sql = []

# Fetch some user IDs if they exist in the system, otherwise generate mock ones
# Note: In a real scenario, you'd query the DB first. Here we generate new ones for the script.
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
    
    # Random date within the last 3 months
    created_at = datetime.now() - timedelta(days=random.randint(0, 90), minutes=random.randint(0, 1440))
    
    sql.append(f"INSERT INTO user_events (id, user_id, event_type, metadata, created_at) VALUES ({escape(gen_id())}, {escape(uid)}, {escape(etype)}, {escape(metadata)}, {escape(created_at.strftime('%Y-%m-%d %H:%M:%S'))});")

print("-- Seeding education_stats")
metrics = [
    ('Enrollment Rate', 92, 98),
    ('Graduation Rate', 85, 95),
    ('STEM Lab Usage', 40, 90),
    ('Online Learning Adoption', 60, 95)
]

for year in [2022, 2023, 2024]:
    for region in regions:
        for metric_name, min_v, max_v in metrics:
            val = random.uniform(min_v, max_v)
            sql.append(f"INSERT INTO education_stats (region, province, metric_type, value, year) VALUES ({escape(region)}, {escape(region)}, {escape(metric_name)}, {val}, {year});")

# Write to file
with open('backend/src/database/migrations/seed_analytics.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql))

print(f"Successfully generated 1000+ seed records in backend/src/database/migrations/seed_analytics.sql")
