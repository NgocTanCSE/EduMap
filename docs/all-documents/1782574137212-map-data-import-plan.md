# Kế hoạch sửa lỗi dữ liệu Map - Import đầy đủ trường đại học

## Vấn đề hiện tại

1. **Dữ liệu ít**: File `dongnai_unis.json` có 91 trường đại học/cao đẳng nhưng chưa được import vào database
2. **Category không xuất hiện**: Dữ liệu chưa có `category_id` phù hợp cho `university` type
3. **API `/map/locations` trả về thiếu dữ liệu**: Vì chỉ lấy từ 2 bảng `map_points` và `locations` nhưng dữ liệu mới chưa có trong DB

## Phân tích hệ thống

- **Backend API**: `GET /map/locations` → `MapController.getLocations()` → `MapService.findAllPois()`
- **MapService.findAllPois()**: Lấy dữ liệu từ 2 nguồn:
  - `map_points` table (có `type_id` mapping tới category)
  - `locations` table (có `category_id` liên kết tới `location_categories`)
- **Type mapping**: `type_id: 1 → university`, `type_id: 2 → school`

## Giải pháp

### Bước 1: Tạo script chuyển đổi JSON → SQL cho universities
Tạo script Python để đọc `dongnai_unis.json` và tạo file SQL insert vào `map_points` với:
- `type_id = 1` (university) cho đại học
- `type_id = 2` (school) cho cao đẳng/trung cấp
- Các trường: name, lat, lng (chuyển thành coordinates), address rỗng

### Bước 2: Seed script tự động chạy khi deploy
Script `scripts/seed_dongnai_unis.py` đã được thêm vào `execute_db_setup.py` và sẽ tự động chạy khi deploy.

### Bước 3: Kiểm tra dữ liệu đã xuất hiện trên MapScreen
API `/map/locations` sẽ tự động bao gồm dữ liệu mới khi được gọi.

## Files cần tạo/sửa

1. **Tạo mới**: `scripts/seed_dongnai_unis.py` - Script seed trực tiếp vào DB
2. **Sửa**: `scripts/execute_db_setup.py` - Thêm seed_dongnai_unis.py vào danh sách scripts
3. **Kiểm tra**: Đảm bảo status = 'active' để dữ liệu hiển thị ngay

## Schema áp dụng

```sql
INSERT INTO map_points (id, name, description, type_id, city, address, location, status)
VALUES ('uuid', 'Tên trường', 'Loại: university', 1, 'Đồng Nai', 'Đang cập nhật', 
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, 'active');
```

## Xác nhận

- [x] Tạo script seed_dongnai_unis.py
- [x] Thêm script vào execute_db_setup.py
- [ ] Import tự động khi deploy (khi DB được khởi tạo)
- [ ] Kiểm tra API trả về đầy đủ dữ liệu