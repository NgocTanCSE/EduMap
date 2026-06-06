#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Schools & Educational Spaces Crawler for Dong Nai Province
Crawls schools, universities, training centers, co-working spaces
"""

import json
import uuid
from typing import List, Dict

class SchoolsCrawler:
    """Crawler để lấy thông tin trường học và không gian giáo dục tại Đông Nái"""

    def get_universities(self) -> List[Dict]:
        """Danh sách đại học tại Đông Nái"""
        universities = [
            {
                "name": "Trường Đại học Công nghệ Đông Nái (DNTU)",
                "description": "Đại học hàng đầu về công nghệ thông tin, kỹ thuật ô tô, điều dưỡng",
                "address": "Đường Nguyễn Khuyến, Phường Trảng Dài, Biên Hòa",
                "lat": 10.9835,
                "lng": 106.8686,
                "contact": "0651-3-xxx-xxx",
                "website": "https://dntu.edu.vn",
                "type": "university",
                "category": "school",
                "faculties": [
                    "Công nghệ thông tin",
                    "Kỹ thuật ô tô",
                    "Điều dưỡng",
                    "Kinh tế",
                    "Quản trị kinh doanh",
                    "Kỹ thuật điện"
                ],
                "facilities": ["Lab STEM", "Thư viện 24/7", "Khu ăn uống", "Ký túc xá", "Sân thể thao"],
                "green_spaces": True,
                "wifi": "500Mbps"
            },
            {
                "name": "Trường Đại học Nông Lâm TPHCM - Chi nhánh Đông Nái",
                "description": "Đại học về nông lâm lâm nghiệp, chuyên đào tạo kỹ sư xanh",
                "address": "Biên Hòa",
                "lat": 10.9200,
                "lng": 106.7500,
                "type": "university",
                "category": "school",
                "faculties": [
                    "Nông học",
                    "Lâm học",
                    "Quản lý tài nguyên thiên nhiên",
                    "Sản xuất nông lâm sạch"
                ],
                "facilities": ["Nông trường thực hành", "Phòng Lab", "Thư viện", "Khu green space"],
                "green_spaces": True
            }
        ]
        return universities

    def get_secondary_schools(self) -> List[Dict]:
        """Danh sách trường trung học tại Biên Hòa"""
        schools = [
            {
                "name": "Trường Tiểu học Lý Thường Kiệt (Cơ sở 2)",
                "description": "Trường tiểu học công lập tại khu vực Biên Hòa",
                "address": "Biên Hòa",
                "lat": 10.9669,
                "lng": 106.8724,
                "type": "primary_school",
                "category": "school",
                "level": "Tiểu học"
            },
            {
                "name": "Trường THPT Thanh Đa",
                "description": "Trường trung học phổ thông",
                "address": "Biên Hòa",
                "lat": 10.9400,
                "lng": 106.8300,
                "type": "secondary_school",
                "category": "school",
                "level": "Trung học phổ thông"
            },
            {
                "name": "Trường THPT Hiệp Hòa",
                "description": "Trường trung học phổ thông",
                "address": "Biên Hòa",
                "lat": 10.9550,
                "lng": 106.8450,
                "type": "secondary_school",
                "category": "school",
                "level": "Trung học phổ thông"
            },
            {
                "name": "Trường THPT Biên Hòa",
                "description": "Trường trung học phổ thông chuyên",
                "address": "Biên Hòa",
                "lat": 10.9300,
                "lng": 106.8250,
                "type": "secondary_school",
                "category": "school",
                "level": "Trung học phổ thông",
                "specialization": "Chuyên"
            },
            {
                "name": "Trường THCS Ngô Quyền",
                "description": "Trường trung học cơ sở",
                "address": "Biên Hòa",
                "lat": 10.9350,
                "lng": 106.8350,
                "type": "middle_school",
                "category": "school",
                "level": "Trung học cơ sở"
            },
        ]
        return schools

    def get_training_centers(self) -> List[Dict]:
        """Danh sách trung tâm đào tạo, khóa học"""
        centers = [
            {
                "name": "Trung tâm Đào tạo Kỹ năng - DNTU",
                "description": "Trung tâm đào tạo kỹ năng mềm, lập trình, ngoại ngữ",
                "address": "DNTU Campus, Biên Hòa",
                "lat": 10.9840,
                "lng": 106.8700,
                "type": "training_center",
                "category": "education",
                "programs": [
                    "Python Programming",
                    "Web Development (React, Next.js)",
                    "Mobile Development",
                    "AI/Machine Learning",
                    "Tiếng Anh",
                    "Leadership & Soft Skills"
                ],
                "facilities": ["Lab máy tính", "Classroom", "Phòng thực hành"],
                "accreditation": "DNTU Certified"
            },
            {
                "name": "Khu Công nghiệp Amata - Tech Hub",
                "description": "Hub công nghệ với các startup, công ty phần mềm, nơi thực tập",
                "address": "Khu công nghiệp Amata, Biên Hòa",
                "lat": 10.8950,
                "lng": 106.9150,
                "type": "tech_hub",
                "category": "innovation_space",
                "companies": [
                    "Fintech Startup",
                    "Software Development Company",
                    "Consulting Firm",
                    "Digital Agency"
                ],
                "services": ["Thực tập", "Tuyển dụng", "Hợp tác nghiên cứu"],
                "networking": True
            },
            {
                "name": "Long Bình Startup Hub",
                "description": "Không gian làm việc chung (coworking) cho startup và freelancer",
                "address": "Khu Long Bình, Biên Hòa",
                "lat": 10.9150,
                "lng": 106.9250,
                "type": "coworking_space",
                "category": "innovation_space",
                "facilities": ["Private Desk", "Shared Workspace", "Meeting Room", "WiFi", "Printer"],
                "target_audience": ["Startup founders", "Freelancers", "Entrepreneurs"]
            },
            {
                "name": "Trung tâm Khởi nghiệp Đông Nái",
                "description": "Trung tâm hỗ trợ khởi nghiệp, mentoring, huy động vốn",
                "address": "Biên Hòa",
                "lat": 10.9300,
                "lng": 106.8300,
                "type": "startup_center",
                "category": "innovation_space",
                "services": [
                    "Business Mentoring",
                    "Funding Assistance",
                    "Networking Events",
                    "Pitch Practice",
                    "Legal Support"
                ],
                "target_audience": ["Startup founders", "Entrepreneurs", "Young professionals"]
            }
        ]
        return centers

    def get_dntu_specific_info(self) -> List[Dict]:
        """Thông tin chi tiết về DNTU và các không gian học tập"""
        dntu_spaces = [
            {
                "name": "DNTU - Phòng Lab STEM",
                "description": "Phòng thí nghiệm hiện đại dành cho sinh viên nghiên cứu Robotics, AI",
                "address": "DNTU Campus, Biên Hòa",
                "lat": 10.9836,
                "lng": 106.8687,
                "type": "research_lab",
                "category": "education",
                "specialization": ["Robotics", "AI/Machine Learning", "IoT"],
                "equipment": ["3D Printers", "Microcontrollers", "Sensors", "AI Workstations"],
                "access": "DNTU Students"
            },
            {
                "name": "DNTU - Thư viện Trung tâm",
                "description": "Thư viện lớn 24/7, hàng ngàn sách công nghệ, khu học tập yên tĩnh",
                "address": "DNTU Campus, Biên Hòa",
                "lat": 10.9835,
                "lng": 106.8686,
                "type": "library",
                "category": "education",
                "collections": [
                    "Sách công nghệ thông tin (2000+ sách)",
                    "E-books và E-journals",
                    "Luận văn, luận án",
                    "Tài liệu kỹ thuật quốc tế"
                ],
                "services": ["WiFi 500Mbps", "Khu học tập riêng", "Phòng thảo luận", "In/Scan"],
                "hours": "24/7"
            },
            {
                "name": "DNTU - Sống Xanh Initiative",
                "description": "Dự án sinh viên trồng cây, bảo vệ môi trường",
                "address": "DNTU Campus, Biên Hòa",
                "lat": 10.9835,
                "lng": 106.8686,
                "type": "green_initiative",
                "category": "sustainability",
                "activities": [
                    "Tree Planting",
                    "Waste Reduction",
                    "Green Energy",
                    "Environmental Education",
                    "Community Cleanup"
                ],
                "engagement": "Open to all students"
            },
            {
                "name": "DNTU - Incubator & Business Center",
                "description": "Trung tâm khởi nghiệp trong DNTU, hỗ trợ sinh viên khởi nghiệp",
                "address": "DNTU Campus, Biên Hòa",
                "lat": 10.9835,
                "lng": 106.8686,
                "type": "incubator",
                "category": "innovation_space",
                "services": [
                    "Mentoring from Industry Experts",
                    "Pitch Events",
                    "Funding Connection",
                    "Workspace",
                    "Consulting"
                ],
                "target": "DNTU Students & Alumni"
            }
        ]
        return dntu_spaces

    def crawl_all_schools(self) -> Dict:
        """Thu thập tất cả dữ liệu trường học"""
        universities = self.get_universities()
        secondary = self.get_secondary_schools()
        training = self.get_training_centers()
        dntu_spaces = self.get_dntu_specific_info()

        all_schools = universities + secondary + training + dntu_spaces

        return {
            "total": len(all_schools),
            "universities": len(universities),
            "secondary_schools": len(secondary),
            "training_centers": len(training),
            "dntu_spaces": len(dntu_spaces),
            "locations": all_schools
        }

    def to_map_points_sql(self, locations: List[Dict]) -> List[str]:
        """Chuyển đổi thành SQL INSERT cho map_points"""
        sql_statements = []

        for loc in locations:
            point_id = str(uuid.uuid4())
            name = loc.get("name", "").replace("'", "''")
            desc = loc.get("category", "school")
            lat = loc.get("lat", 0)
            lng = loc.get("lng", 0)

            sql = f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', '{desc}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);"
            sql_statements.append(sql)

        return sql_statements

    def to_learning_materials_sql(self, locations: List[Dict]) -> List[str]:
        """Tạo tài liệu học tập cho các trường học và không gian"""
        sql_statements = []

        materials = [
            {
                "title": "DNTU Student Guide 2024",
                "description": "Hướng dẫn học tập cho sinh viên DNTU, quy tắc, cơ sở vật chất",
                "subject": "Education",
                "type": "guide"
            },
            {
                "title": "Khởi Nghiệp Thành Công - Kinh Nghiệm từ Đông Nái",
                "description": "Trường hợp học tập từ các startup thành công tại Amata",
                "subject": "Digital Transformation",
                "type": "case_study"
            },
            {
                "title": "Hướng Dẫn Sống Xanh - DNTU Initiative",
                "description": "Tài liệu về bảo vệ môi trường, bền vững",
                "subject": "Environmental Science",
                "type": "guide"
            },
            {
                "title": "Kỹ Năng Mềm cho Sinh Viên Công Nghệ",
                "description": "Phát triển kỹ năng mềm, giao tiếp, lãnh đạo",
                "subject": "Professional Development",
                "type": "course"
            }
        ]

        for mat in materials:
            mat_id = str(uuid.uuid4())
            title = mat.get("title", "").replace("'", "''")
            desc = mat.get("description", "").replace("'", "''")
            subject = mat.get("subject", "")
            type_mat = mat.get("type", "guide")

            sql = f"INSERT INTO learning_materials (id, title, description, subject, type, status) VALUES ('{mat_id}', '{title}', '{desc}', '{subject}', '{type_mat}', 'published');"
            sql_statements.append(sql)

        return sql_statements

if __name__ == "__main__":
    crawler = SchoolsCrawler()
    result = crawler.crawl_all_schools()

    print(f"Total locations: {result['total']}")
    print(f"Universities: {result['universities']}")
    print(f"Secondary schools: {result['secondary_schools']}")
    print(f"Training centers: {result['training_centers']}")
    print(f"DNTU spaces: {result['dntu_spaces']}")

    print("\nSchools & Spaces:")
    for loc in result['locations']:
        print(f"  - {loc['name']}")

    # Tạo SQL
    sql_statements = crawler.to_map_points_sql(result['locations'])
    with open("schools.sql", "w", encoding="utf-8") as f:
        for sql in sql_statements:
            f.write(sql + "\n")

    mat_sql = crawler.to_learning_materials_sql(result['locations'])
    with open("schools_materials.sql", "w", encoding="utf-8") as f:
        for sql in mat_sql:
            f.write(sql + "\n")

    print(f"\nGenerated {len(sql_statements)} map point SQL statements")
    print(f"Generated {len(mat_sql)} learning material SQL statements")
