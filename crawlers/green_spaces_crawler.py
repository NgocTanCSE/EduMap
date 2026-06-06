#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Green Spaces & Parks Crawler for Dong Nai Province
Crawls parks, gardens, green areas, environmental spaces
"""

import json
import uuid
from typing import List, Dict

class GreenSpacesCrawler:
    """Crawler để lấy không gian xanh từ Đông Nái"""

    def get_parks_bienhoa(self) -> List[Dict]:
        """Công viên, không gian xanh tại Biên Hòa"""
        parks = [
            {
                "name": "Công viên Biên Hùng",
                "description": "Công viên lớn với cây xanh, sân chơi, khu tập thể dục",
                "category": "park",
                "area": "Biên Hòa - Quận Biên Hòa",
                "lat": 10.9155,
                "lng": 106.8245,
                "size": "15 hectares",
                "features": ["Sân chơi trẻ em", "Khu tập thể dục", "Hồ nước", "Đường đi bộ"],
                "opening_hours": "5:00 - 21:00",
                "free_entry": True,
                "environmental_features": ["Cây xanh", "Hồ cân bằng sinh thái", "Cỏ sạch"]
            },
            {
                "name": "Công viên Dương Tử Giang",
                "description": "Công viên giải trí kết hợp không gian xanh, phục vụ cộng đồng",
                "category": "park",
                "area": "Biên Hòa - Quận Biên Hòa",
                "lat": 10.9485,
                "lng": 106.8350,
                "size": "8 hectares",
                "features": ["Quán cà phê", "Sân chơi", "Khu picnic"],
                "opening_hours": "6:00 - 22:00",
                "free_entry": True,
                "environmental_features": ["Cây xanh", "Vệ sinh tốt"]
            },
            {
                "name": "Hồ Trữ Nước Tươi - Khu Công viên Sinh thái",
                "description": "Hệ thống hồ nước với không gian sinh thái giáo dục",
                "category": "ecological_park",
                "area": "Biên Hòa",
                "lat": 10.9200,
                "lng": 106.8500,
                "features": ["Đường bộ quanh hồ", "Khu ngồi nghỉ", "Điểm quan sát"],
                "environmental_features": ["Cân bằng sinh thái", "Khu bảo vệ động thực vật"],
                "educational_value": "Giáo dục về bảo tồn tự nhiên"
            },
            {
                "name": "Khu Vườn Cây Xanh Nguyễn Khuyến",
                "description": "Vườn cây công cộng, giáo dục về cây trồng, nông nghiệp đô thị",
                "category": "botanical_garden",
                "area": "Biên Hòa",
                "lat": 10.9800,
                "lng": 106.8700,
                "features": ["Vườn cây quý hiếm", "Khu học tập", "Khu thực hành"],
                "opening_hours": "7:00 - 17:00",
                "entrance_fee": "Free for students",
                "educational_value": "Nghiên cứu sinh học, cây trồng"
            },
            {
                "name": "Công viên Tây Thạnh",
                "description": "Khu công viên mới với cây xanh, sân tập yoga, thiền",
                "category": "wellness_park",
                "area": "Biên Hòa - Quận Biên Hòa",
                "lat": 10.9350,
                "lng": 106.8600,
                "features": ["Sân yoga", "Cây xanh", "Khu thiền định"],
                "opening_hours": "5:00 - 20:00",
                "services": ["Lớp yoga", "Thiền"]
            },
            {
                "name": "Vườn Nho Biên Hòa",
                "description": "Vườn nho nông nghiệp sạch, tham quan và mua trái cây",
                "category": "agro_tourism",
                "area": "Biên Hòa - Ngoại thành",
                "lat": 10.8850,
                "lng": 106.9300,
                "features": ["Vườn nho", "Quán trái cây", "Khu mua sắm"],
                "services": ["Tour tham quan", "Pick your own grapes"]
            },
            {
                "name": "Công viên Quốc gia Tây Ninh (gần biên giới Đông Nái)",
                "description": "Khu bảo tồn thiên nhiên lớn, trekking, sinh thái học",
                "category": "national_park",
                "area": "Ranh giới Đông Nái - Tây Ninh",
                "lat": 10.8200,
                "lng": 106.7000,
                "features": ["Rừng", "Tuyến trek", "Vùng bảo tồn"],
                "educational_value": "Sinh học, sinh thái"
            },
            {
                "name": "Ven sông Sài Gòn - Khu dạo bộ sinh thái",
                "description": "Tuyến dạo bộ dọc sông với cây xanh, quan sát chim, sinh thái",
                "category": "riverside_park",
                "area": "Biên Hòa",
                "lat": 10.9100,
                "lng": 106.8200,
                "features": ["Đường dạo bộ", "Điểm quan sát chim", "Cây xanh"],
                "free_entry": True,
                "environmental_features": ["Bảo vệ sông suối", "Khu bảo tồn chim"]
            },
        ]
        return parks

    def get_green_initiatives(self) -> List[Dict]:
        """Các chương trình, dự án xanh tại Đông Nái"""
        initiatives = [
            {
                "name": "Dự án Sống Xanh - DNTU",
                "description": "Chương trình sinh viên DNTU trồng cây, bảo vệ môi trường",
                "category": "green_initiative",
                "type": "university_program",
                "area": "DNTU Campus",
                "lat": 10.9835,
                "lng": 106.8686,
                "focus": ["Trồng cây", "Tái chế", "Năng lượng xanh"],
                "participants": "DNTU Students"
            },
            {
                "name": "Hội Bảo Vệ Môi Trường Biên Hòa",
                "description": "Tổ chức bảo vệ môi trường địa phương",
                "category": "environmental_org",
                "type": "NGO",
                "area": "Biên Hòa",
                "lat": 10.9300,
                "lng": 106.8300,
                "activities": ["Clean up sông", "Trồng cây", "Giáo dục"]
            },
            {
                "name": "Chương trình Rác thải Zero - Biên Hòa",
                "description": "Thành phố xanh - Chương trình giảm rác thải, tái chế",
                "category": "sustainability_program",
                "type": "city_program",
                "area": "Biên Hòa - City-wide",
                "focus": ["Tái chế", "Giảm nhựa", "Xử lý rác"]
            },
        ]
        return initiatives

    def crawl_all_green_spaces(self) -> Dict:
        """Thu thập tất cả dữ liệu không gian xanh"""
        parks = self.get_parks_bienhoa()
        initiatives = self.get_green_initiatives()
        all_data = parks + initiatives

        return {
            "total": len(all_data),
            "parks": len(parks),
            "initiatives": len(initiatives),
            "locations": all_data
        }

    def to_map_points_sql(self, locations: List[Dict]) -> List[str]:
        """Chuyển đổi thành SQL INSERT cho map_points"""
        sql_statements = []
        for loc in locations:
            point_id = str(uuid.uuid4())
            name = loc.get("name", "").replace("'", "''")
            desc = loc.get("category", "park")
            lat = loc.get("lat", 0)
            lng = loc.get("lng", 0)

            sql = f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', '{desc}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);"
            sql_statements.append(sql)

        return sql_statements

    def to_learning_materials_sql(self, initiatives: List[Dict]) -> List[str]:
        """Tạo tài liệu học tập cho các dự án xanh"""
        sql_statements = []

        materials_data = [
            {
                "title": "Hướng dẫn Xây dựng Thành phố Xanh",
                "description": "Tài liệu về quy hoạch và phát triển bền vững",
                "subject": "Environmental Science",
                "type": "guide"
            },
            {
                "title": "Sinh Thái Học Đô Thị - Ứng dụng tại Đông Nái",
                "description": "Nghiên cứu về sinh thái đô thị và bảo tồn",
                "subject": "Ecology",
                "type": "research"
            },
            {
                "title": "Quản Lý Rác Thải Bền Vững",
                "description": "Chiến lược quản lý rác thải hiệu quả",
                "subject": "Environmental Management",
                "type": "guide"
            },
        ]

        for mat in materials_data:
            mat_id = str(uuid.uuid4())
            title = mat.get("title", "").replace("'", "''")
            desc = mat.get("description", "").replace("'", "''")
            subject = mat.get("subject", "")
            type_mat = mat.get("type", "guide")

            sql = f"INSERT INTO learning_materials (id, title, description, subject, type, status) VALUES ('{mat_id}', '{title}', '{desc}', '{subject}', '{type_mat}', 'published');"
            sql_statements.append(sql)

        return sql_statements

if __name__ == "__main__":
    crawler = GreenSpacesCrawler()
    result = crawler.crawl_all_green_spaces()

    print(f"Total locations: {result['total']}")
    print(f"Parks: {result['parks']}")
    print(f"Initiatives: {result['initiatives']}")

    print("\nGreen Spaces:")
    for loc in result['locations']:
        print(f"  - {loc['name']} ({loc['area']})")

    # Tạo SQL
    sql_statements = crawler.to_map_points_sql(result['locations'])
    with open("green_spaces.sql", "w", encoding="utf-8") as f:
        for sql in sql_statements:
            f.write(sql + "\n")

    mat_sql = crawler.to_learning_materials_sql(result['locations'])
    with open("green_materials.sql", "w", encoding="utf-8") as f:
        for sql in mat_sql:
            f.write(sql + "\n")

    print(f"\nGenerated {len(sql_statements)} map point SQL statements")
    print(f"Generated {len(mat_sql)} learning material SQL statements")
