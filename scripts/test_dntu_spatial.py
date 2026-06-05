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

# Tọa độ gốc của DNTU
DNTU_LAT = 10.9885
DNTU_LNG = 106.8552

def run_test_case(radius_km, test_name):
    print(f"\n>>> RUNNING TEST: {test_name} (Radius: {radius_km}km)")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Câu lệnh SQL sử dụng PostGIS để tính khoảng cách thực tế
        # ST_DWithin: Kiểm tra xem 2 điểm có nằm trong bán kính x mét không
        # ST_Distance: Tính khoảng cách giữa 2 điểm (mét)
        query = """
            SELECT 
                name, 
                type, 
                address,
                ST_Distance(location, ST_GeogFromText(%s)) / 1000 as distance_km
            FROM educational_points
            WHERE ST_DWithin(location, ST_GeogFromText(%s), %s)
            ORDER BY distance_km ASC;
        """
        
        center_point = f"POINT({DNTU_LNG} {DNTU_LAT})"
        radius_meters = radius_km * 1000
        
        cur.execute(query, (center_point, center_point, radius_meters))
        results = cur.fetchall()
        
        if not results:
            print("   [!] No locations found in this radius.")
        else:
            print(f"   [+] Found {len(results)} locations:")
            for row in results:
                name, l_type, addr, dist = row
                print(f"       - {name} ({l_type}): {dist:.2f} km")
                
    except Exception as e:
        print(f"   [ERROR] {e}")
    finally:
        if conn:
            conn.close()

def main():
    print("=== EDUMAP SPATIAL QUERY TEST SUITE (DNTU AREA) ===")
    
    # Test Case 1: Bán kính hẹp (Quanh khu Trảng Dài)
    run_test_case(2, "Trảng Dài Local Scan")
    
    # Test Case 2: Bán kính trung bình (Trung tâm Biên Hòa)
    run_test_case(5, "Biên Hòa City Center Scan")
    
    # Test Case 3: Bán kính rộng (Toàn bộ khu vực 10km)
    run_test_case(10, "Greater Biên Hòa Area Scan")

if __name__ == "__main__":
    main()
