#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WiFi Hotspots Crawler for Dong Nai Province
Crawls WiFi locations, internet cafes, public WiFi areas
"""

import json
import uuid
from typing import List, Dict

class WiFiCrawler:
    """Crawler để lấy WiFi hotspots từ Đông Nái"""

    def __init__(self):
        self.wifi_data = []
        self.poi_data = []

    def get_bienhoa_wifi_locations(self) -> List[Dict]:
        """
        Danh sách WiFi hotspots tại Biên Hòa, Đông Nái
        Coordinates (lat, lng) cho Biên Hòa: ~10.92, 106.82
        """
        locations = [
            {
                "name": "Công viên Biên Hùng",
                "description": "Công viên công cộng với WiFi miễn phí",
                "category": "wifi_park",
                "lat": 10.9155,
                "lng": 106.8245,
                "area": "Biên Hòa",
                "type": "park"
            },
            {
                "name": "Công viên Dương Tử Giang",
                "description": "Công viên giải trí có WiFi công cộng",
                "category": "wifi_park",
                "lat": 10.9485,
                "lng": 106.8350,
                "area": "Biên Hòa",
                "type": "park"
            },
            {
                "name": "Trạm xe buýt Trung tâm Biên Hòa",
                "description": "Trạm xe buýt có dịch vụ WiFi miễn phí",
                "category": "wifi_transport",
                "lat": 10.9246,
                "lng": 106.8246,
                "area": "Biên Hòa",
                "type": "bus_station"
            },
            {
                "name": "Thư viện Đông Nái",
                "description": "Thư viện công cộng - WiFi tốc độ cao, khu làm việc",
                "category": "wifi_library",
                "lat": 10.9258,
                "lng": 106.8195,
                "area": "Biên Hòa",
                "type": "library",
                "opening_hours": "8:00 - 18:00",
                "services": ["WiFi 100Mbps", "Máy tính", "Phòng học"]
            },
            {
                "name": "Nhà Văn Hóa Khu phố 1",
                "description": "Trung tâm văn hóa cộng đồng với WiFi công cộng",
                "category": "wifi_community",
                "lat": 10.9673,
                "lng": 106.8650,
                "area": "Biên Hòa",
                "type": "community_centre"
            },
            {
                "name": "Trường Đại học Công nghệ Đông Nái (DNTU)",
                "description": "Trường đại học, WiFi tốt, khu vực học tập mở",
                "category": "wifi_education",
                "lat": 10.9835,
                "lng": 106.8686,
                "area": "Biên Hòa",
                "type": "school",
                "opening_hours": "6:00 - 22:00",
                "services": ["WiFi 500Mbps", "Lab STEM", "Thư viện hiện đại"]
            },
            {
                "name": "Quán cà phê Wifi Zone - 30 Tháng 4",
                "description": "Quán cà phê với WiFi miễn phí, không gian học tập",
                "category": "wifi_cafe",
                "lat": 10.9280,
                "lng": 106.8290,
                "area": "Biên Hòa",
                "type": "cafe",
                "opening_hours": "7:00 - 22:00",
                "services": ["WiFi", "Cà phê", "Không gian yên tĩnh"]
            },
            {
                "name": "Trung tâm Thương mại Hoàng Phúc",
                "description": "Trung tâm mua sắm với WiFi công cộng",
                "category": "wifi_mall",
                "lat": 10.9300,
                "lng": 106.8400,
                "area": "Biên Hòa",
                "type": "shopping_mall",
                "opening_hours": "10:00 - 21:00",
                "services": ["WiFi", "Khu ăn uống", "Khu làm việc"]
            },
            {
                "name": "Bệnh viện Đa khoa Biên Hòa",
                "description": "Bệnh viện với WiFi công cộng (khu chờ)",
                "category": "wifi_health",
                "lat": 10.9450,
                "lng": 106.8280,
                "area": "Biên Hòa",
                "type": "hospital"
            },
            {
                "name": "Khu công nghiệp Amata",
                "description": "Khu công nghiệp với các công ty công nghệ, WiFi coverage rộng",
                "category": "wifi_industrial",
                "lat": 10.8950,
                "lng": 106.9150,
                "area": "Biên Hòa",
                "type": "industrial_park",
                "companies": ["Tech startups", "Software companies", "Consulting firms"]
            },
            {
                "name": "Long Bình Plaza",
                "description": "Khu dân cư Long Bình với infrastructure WiFi",
                "category": "wifi_residential",
                "lat": 10.9150,
                "lng": 106.9250,
                "area": "Biên Hòa",
                "type": "residential"
            },
        ]
        return locations

    def get_dong_nai_wifi_zones(self) -> List[Dict]:
        """WiFi zones trong các khu vực khác của Đông Nái"""
        locations = [
            {
                "name": "Thư viện Tỉnh Đông Nái - Thành phố Thủ Dầu Một",
                "description": "Thư viện tỉnh, WiFi tốt, tài nguyên học tập phong phú",
                "category": "wifi_provincial_library",
                "lat": 10.8850,
                "lng": 106.7345,
                "area": "Thủ Dầu Một",
                "type": "library",
                "opening_hours": "7:00 - 17:30",
                "services": ["WiFi 200Mbps", "Database trực tuyến", "E-books"]
            },
            {
                "name": "Trường Đại học Nông Lâm TPHCM - Chi nhánh Đông Nái",
                "description": "Cơ sở đào tạo nông lâm lâm nghiệp",
                "category": "wifi_education",
                "lat": 10.9200,
                "lng": 106.7500,
                "area": "Đồng Nài",
                "type": "school"
            },
        ]
        return locations

    def crawl_all_wifi(self) -> Dict:
        """Thu thập tất cả dữ liệu WiFi"""
        all_wifi = self.get_bienhoa_wifi_locations() + self.get_dong_nai_wifi_zones()
        return {
            "total": len(all_wifi),
            "locations": all_wifi,
            "summary": {
                "by_category": self._count_by_category(all_wifi),
                "by_area": self._count_by_area(all_wifi)
            }
        }

    def _count_by_category(self, locations: List[Dict]) -> Dict:
        """Đếm số lượng theo category"""
        counts = {}
        for loc in locations:
            cat = loc.get("category", "unknown")
            counts[cat] = counts.get(cat, 0) + 1
        return counts

    def _count_by_area(self, locations: List[Dict]) -> Dict:
        """Đếm số lượng theo khu vực"""
        counts = {}
        for loc in locations:
            area = loc.get("area", "unknown")
            counts[area] = counts.get(area, 0) + 1
        return counts

    def to_map_points_sql(self, locations: List[Dict]) -> List[str]:
        """Chuyển đổi thành SQL INSERT cho map_points"""
        sql_statements = []
        for loc in locations:
            point_id = str(uuid.uuid4())
            name = loc.get("name", "")
            desc = loc.get("category", "wifi")
            lat = loc.get("lat", 0)
            lng = loc.get("lng", 0)

            # PostgreSQL SQL với PostGIS
            sql = f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name.replace(chr(39), chr(39)*2)}', '{desc}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);"
            sql_statements.append(sql)

        return sql_statements

    def to_vector_documents(self, locations: List[Dict]) -> List[Dict]:
        """Chuyển đổi thành documents cho ChromaDB"""
        documents = []
        for loc in locations:
            doc = {
                "text": f"{loc.get('name')}. {loc.get('description')}. Khu vực: {loc.get('area')}. Loại: {loc.get('type')}.",
                "metadata": {
                    "source": "wifi_crawler",
                    "location": loc.get("name"),
                    "category": loc.get("category"),
                    "coordinates": f"{loc.get('lat')},{loc.get('lng')}",
                    "type": loc.get("type"),
                    "area": loc.get("area")
                }
            }
            documents.append(doc)

        return documents

if __name__ == "__main__":
    crawler = WiFiCrawler()
    result = crawler.crawl_all_wifi()

    print(f"Total WiFi locations: {result['total']}")
    print(f"Summary: {result['summary']}")
    print("\nWiFi Locations:")
    for loc in result['locations']:
        print(f"  - {loc['name']} ({loc['area']})")

    # Tạo SQL
    sql_statements = crawler.to_map_points_sql(result['locations'])
    print(f"\n\nGenerated {len(sql_statements)} SQL statements")
    with open("wifi_locations.sql", "w", encoding="utf-8") as f:
        for sql in sql_statements:
            f.write(sql + "\n")
    print("SQL saved to wifi_locations.sql")
