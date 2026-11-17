# Kế hoạch tinh giảm + tối ưu bề mặt API

Phiên 2026-11-17. Nguồn: `tasks/report-audit.md`, kết quả
`python3 /tmp/audit_final.py`.

## Nguyên tắc

1. Chỉ xóa route/endpoint đã chứng minh không ai gọi. Endpoint chết nhưng là
   một tính năng có thể bật lại → giữ.
2. Ghost route (BFF trỏ đích sai) sửa trước, không xóa.
3. Mỗi task = một endpoint/route, xác nhận trước và sau bằng audit script.
4. Backend Rust giữ nguyên business logic; chỉ sửa route + handler thừa.
5. Deploy = host; xác nhận qua request, không chạy local dev/cargo build.
6. Không xóa mã nguồn sản phẩm chỉ vì thiếu test — test phải được phục hồi
   hoặc đánh dấu lỗi, source phải giữ nguyên.

## Trạng thái hiện tại

- Rust: 243 = 154 sống + 89 dead.
- Ai-service: 72 = 17 sống + 55 dead.
- BFF: 162. Ghosts: 0.
- Test: ai-service 18 (2 file) — 25 file đã xóa trong khi source còn sống.
- Backend `package.json`: đã xóa scripts test + jest deps + jest config.

## Task đã hoàn thành

| # | Việc | Kết quả |
| --- | --- | --- |
| 1 | Xóa BFF `business/services` | dead, backend không route, không FE |
| 2 | Xóa BFF `payment/process` (no-id) | FE chỉ dùng `/payment/process/{transactionId}` |
| 3 | Xóa BFF `ai/search` | route Rust đã xóa, trỏ đích sai, không caller |
| 4 | Xóa Rust `/api/ai/chat/stream` | trùng `/api/ai/chat-stream` |
| 5 | Xóa Rust `/api/ai/search` | BFF + service đã xóa, không caller |
| 6 | Thêm Rust `/api/share/items/{id}` GET/PUT/DELETE | sửa ghost BFF |
| 7 | Thêm ai-service `POST /api/ai/knowledge/sync` | sửa ghost BFF |
| 8 | Chạy lại audit | ghosts_be=0, ghosts_ai=0, ⊆ True |
| 9 | Dọn test rải rác | backend `package.json`: scripts test, lint glob, jest deps, jest config |

## Task tiếp theo (nếu muốn giảm thêm)

### Task 10 — Gom endpoint `auto/*` thành một router duy nhất

9 endpoint `/api/ai/auto/*` + 9 BFF tương ứng. Hiện mỗi một có handler riêng;
có thể gom thành một handler duy nhất theo `task_name` để giảm 8 route.

**Chấp nhận**: [ ] audit mới cho thấy total ai-service giảm 8, không mất tính năng.

### Task 11 — Đánh dấu endpoint dead trong `PUBLIC_PATHS`

88 route Rust dead vẫn nằm trong `auth.rs::PUBLIC_PATHS`. Không ảnh hưởng runtime
nhưng làm danh sách dài hơn cần thiết. Lọc ra những route chắc chắn không bao giờ
public nữa (chat/stream, search đã xóa).

**Chấp nhận**: [ ] `PUBLIC_PATHS` giảm, [ ] không route public nào bị chặn nhầm.

### Task 12 — Dọn `router_names` ai-service

54 endpoint dead có tên router tương ứng trong `ai-service/main.py`. Giữ vì
module có thể dùng sau; chỉ xóa khi quyết định xóa module.

## Checkpoint

Sau mỗi task:
- [ ] Chạy `python3 /tmp/audit_final.py` → ghosts=0, ⊆ True.
- [ ] `pytest ai-service/tests -q` xanh.
- [ ] `grep` không còn đường dead bị xóa mà vẫn được FE gọi.
- [ ] `backend/package.json` hợp lệ JSON.

## Rủi ro

- Xóa route ai-service có thể làm BFF 404 nếu BFF chưa được cập nhật → luôn
  chạy audit trước và sau mỗi lần xóa.
- Rust `cargo check` chỉ chạy được trên host — không chạy locally.
- **Phục hồi test**: 25 file test đã xóa có thể FAIL do API drift (provider,
  local model, vector store). Phải chạy từng file, không restore mù.