import psycopg2
import sys

# --- Database Configuration ---
DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "edumap_db",
    "user": "admin",
    "password": "password123"
}

# Type IDs: 1: School, 3: Library, 5: STEM Lab, 6: Green Space, 7: WiFi, 8: Bookstore, 9: Cafe
LOCATIONS = [
    # --- DNTU CORE & INTERNAL ---
    {
        "name": "Đại học Công nghệ Đồng Nai (DNTU)",
        "type_id": 1,
        "lat": 10.98818,
        "lng": 106.85551,
        "address": "206 Nguyễn Khuyến, KP5, P. Trảng Dài, Biên Hòa",
        "description": "Trung tâm điều hành và giảng dạy chính."
    },
    {
        "name": "Thư viện Trung tâm DNTU (Building C)",
        "type_id": 3,
        "lat": 10.98850,
        "lng": 106.85580,
        "address": "Tầng 3-4, Tòa nhà C, DNTU",
        "description": "Kho học liệu số và không gian tự học hiện đại."
    },
    {
        "name": "Hệ thống WiFi DNTU Campus (SSID: DNTU-SinhVien)",
        "type_id": 7,
        "lat": 10.98820,
        "lng": 106.85540,
        "address": "Toàn bộ khuôn viên trường",
        "description": "WiFi miễn phí tốc độ cao dành cho sinh viên. Đăng nhập bằng tài khoản sinh viên."
    },
    {
        "name": "WiFi DNTU Tòa nhà G (SSID: DNTU-GiangVien)",
        "type_id": 7,
        "lat": 10.98750,
        "lng": 106.85520,
        "address": "Tòa nhà G, Khu vực văn phòng",
        "description": "WiFi ưu tiên cho cán bộ, giảng viên DNTU."
    },
    {
        "name": "WiFi DNTU Thư viện (SSID: DNTU-DaoTao)",
        "type_id": 7,
        "lat": 10.98855,
        "lng": 106.85585,
        "address": "Tòa nhà C, Khu vực Thư viện",
        "description": "WiFi ổn định cho việc tra cứu và học tập trực tuyến."
    },
    {
        "name": "DNTU High-Tech STEM Lab",
        "type_id": 5,
        "lat": 10.98780,
        "lng": 106.85500,
        "address": "Xưởng thực hành Công nghệ, DNTU",
        "description": "Phòng thí nghiệm Robot và tự động hóa."
    },
    {
        "name": "Không gian xanh DNTU (Hồ sen)",
        "type_id": 6,
        "lat": 10.98880,
        "lng": 106.85600,
        "address": "Khuôn viên phía sau tòa nhà trung tâm",
        "description": "Khu vực thư giãn, học bài ngoài trời thoáng mát."
    },

    # --- BOOKSTORES (Bán kính 10km) ---
    {
        "name": "Nhà sách Fahasa Biên Hòa",
        "type_id": 8,
        "lat": 10.9575,
        "lng": 106.8285,
        "address": "Siêu thị Co.op Mart, Biên Hòa",
        "description": "Đầy đủ giáo trình, sách tham khảo và dụng cụ học tập."
    },
    {
        "name": "Nhà sách Phương Nam Vincom Biên Hòa",
        "type_id": 8,
        "lat": 10.9495,
        "lng": 106.8265,
        "address": "Tầng 3 Vincom Biên Hòa",
        "description": "Không gian mua sắm sách hiện đại, có khu vực đọc sách."
    },

    # --- STEM & INNOVATION ---
    {
        "name": "Trung tâm Tin học Đồng Nai",
        "type_id": 5,
        "lat": 10.9580,
        "lng": 106.8620,
        "address": "Số 4 Lê Quý Đôn, P. Tân Hiệp",
        "description": "Đào tạo kỹ năng số và lập trình cho sinh viên."
    },

    # --- GREEN SPACES & PARKS ---
    {
        "name": "Công viên Trảng Dài",
        "type_id": 6,
        "lat": 10.9950,
        "lng": 106.8650,
        "address": "Ngã ba Trảng Dài, Biên Hòa",
        "description": "Lá phổi xanh của khu vực, phù hợp tập thể dục và học nhóm."
    },
    {
        "name": "Công viên Biên Hùng",
        "type_id": 6,
        "lat": 10.9515,
        "lng": 106.8210,
        "address": "Trung tâm TP. Biên Hòa",
        "description": "Địa điểm tổ chức nhiều sự kiện văn hóa, giáo dục."
    },

    # --- WiFi & STUDY CAFES ---
    {
        "name": "Smile Coffee (Trảng Dài)",
        "type_id": 8,
        "lat": 10.9850,
        "lng": 106.8580,
        "address": "Khu dân cư Phú Gia, Trảng Dài",
        "description": "Yên tĩnh, WiFi mạnh, chuyên phục vụ sinh viên DNTU."
    },
    {
        "name": "The Coffee House Đồng Khởi",
        "type_id": 8,
        "lat": 10.9650,
        "lng": 106.8600,
        "address": "240 Đồng Khởi, Biên Hòa",
        "description": "WiFi ổn định, không gian hiện đại để làm tiểu luận."
    }
]

def seed():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("Cleaning old map data...")
        cur.execute("DELETE FROM map_points;")
        
        print(f"Seeding {len(LOCATIONS)} precise locations for DNTU ecosystem...")
        
        for loc in LOCATIONS:
            point_wkt = f"POINT({loc['lng']} {loc['lat']})"
            cur.execute("""
                INSERT INTO map_points (name, type_id, description, address, city, location, status)
                VALUES (%s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
            """, (
                loc['name'],
                loc['type_id'],
                loc['description'],
                loc['address'],
                "Biên Hòa",
                point_wkt,
                "approved"
            ))
            
        conn.commit()
        print("DNTU Ecosystem data updated successfully with WiFi details!")
        
    except Exception as e:
        print(f"Error seeding data: {e}", file=sys.stderr)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed()
