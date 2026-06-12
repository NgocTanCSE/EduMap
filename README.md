---
language: vi
license: cc-by-sa-4.0
tags:
  - education
  - vietnam
  - schools
  - libraries
  - wifi
  - open-data
---

# Dong Nai Education & Facilities Dataset

Bộ dữ liệu tổng hợp các **trường học**, **đại học/cao đẳng**, **thư viện** và **điểm Wi‑Fi** ở tỉnh Đồng Nai (2024‑2026). Dữ liệu được thu thập chủ yếu từ OpenStreetMap (Overpass API) và các cổng dữ liệu mở của Sở Giáo dục‑Đào tạo Đồng Nai.

## Nội dung dataset

| File | Mô tả |
|------|-------|
| `dong_nai_all_schools_20260613_005546.sql` | Tập lệnh SQL `INSERT` cho bảng `map_points` (579 POI). |
| `dongnai_detailed.json` | JSON chi tiết gồm 3 danh sách:
- `schools` (428 trường)
- `libraries` (15 thư viện)
- `wifi` (47 điểm Wi‑Fi) |
| `dongnai_unis.json` | Danh sách 91 đại học & cao đẳng. |

## Cấu trúc JSON (`dongnai_detailed.json`)
```json
{
  "schools": [
    {
      "name": "Trường Mầm Non Bình Trưng Đông",
      "name_vi": "Trường Mầm Non Bình Trưng Đông",
      "lat": 10.7894062,
      "lng": 106.7721717,
      "type": "school",
      "address": "",
      "website": "",
      "phone": "",
      "operator": "",
      "opening_hours": "",
      "level": ""
    },
    ...
  ],
  "libraries": [ {...} ],
  "wifi": [ {...} ]
}
```

## Cách tải dữ liệu (Python)
```python
from datasets import load_dataset

ds = load_dataset("username/dongnai-education")   # nếu bạn đã tạo script load (dongnai_dataset.py)
# Hoặc tải trực tiếp file JSON
import json, pathlib
path = pathlib.Path('dongnai_detailed.json')
with path.open(encoding='utf-8') as f:
    data = json.load(f)
```

## Các trường (common) trong dataset
- `name` (string): Tên địa điểm.
- `category` (string): `school`, `university`, `library`, `wifi`.
- `type` (string, optional): Loại chi tiết (ví dụ `primary_school`, `college`).
- `lat`, `lng` (float): Tọa độ.
- `address`, `website`, `phone`, `operator`, `opening_hours` (string, optional).
- `description` (string, optional): Thông tin bổ sung được tạo tự động.

## License
Dữ liệu được cấp phép **CC‑BY‑SA 4.0**. Bạn có thể tái sử dụng, chỉnh sửa và phát hành lại với việc ghi nhận tác giả.

## Citation
Nếu bạn sử dụng bộ dữ liệu này trong công trình nghiên cứu, vui lòng trích dẫn:
```
@dataset{dongnai-education,
  title   = {Dong Nai Education & Facilities Dataset},
  author  = {Ngoc Tan},
  year    = {2026},
  url     = {https://huggingface.co/datasets/username/dongnai-education}
}
```
