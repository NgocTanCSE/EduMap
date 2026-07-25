import random

regions = ['Đồng Nai', 'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ']

sql = []
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
            sql.append(f"INSERT INTO education_stats (region, province, metric_type, metric_value, year) VALUES ('{region}', '{region}', '{metric_name}', {val}, {year});")

with open('backend/src/database/migrations/seed_education_stats.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql))
print(f'Created {len(sql)} education_stats records')