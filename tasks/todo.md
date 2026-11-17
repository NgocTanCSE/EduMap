# EduMap — Todo: Kiểm tra tính năng thừa / cô condens

## Đã hoàn thành

- [x] Rà toàn bộ 38 entry `feature-catalog.ts`: 0 entry chết (trang + backend + gọi đúng)
- [x] Xây bộ quét FE→backend phân giải đúng `${API_BASE_URL}` + `getBackendUrl()` + BFF proxy (272 paths)
- [x] Kiểm trùng data source: 0 cặp entry chia chung table/backend module
- [x] Sửa 404 `/learning-spaces`: `API_URL` `/api/learning-spaces` → `/api/learning-spots`
- [x] Chạy `python3 /tmp/audit_final.py`: `ghosts_be=0`, `ghosts_ai=0`, `mismatches=[]`
- [x] Viết báo cáo: `tasks/report-audit.md`

## Kết luận chính

**Không có tính năng nào có thể xóa.** Không có skeleton chết, không có trùng data source.
"Thừa" thực sự:
1. **Sidebar 25 entry** (gấp đôi app tương đương ~12-15) — bloat đo được duy nhất
2. **`/surveys`** — data luôn trống (không crawler, không source data), UI luôn empty state
3. `green_activities` / `summer_activities` / `shared_items` — table trống theo policy §6

## Chưa làm (cần quyết định sản phẩm)

- [ ] **Hướng B:** Ẩn `/surveys` khỏi sidebar (giữ trong `/features`)
- [ ] **Hướng C:** Gộp `impact-match` + `resource-exchange` → 1 entry "Ghép đôi AI" 2 tab
- [ ] **Hướng C:** Đổi tên Rust `/api/learning-spots/*` → `/api/learning-spaces/*` (recompile Rust)
- [ ] Review analytics để quyết định entry sidebar ít dùng

## Ghi chú kỹ thuật

- `frontend/app/api/ai/search/route.ts` bị xóa (commit `5888723`); ai-service vẫn mount `/api/ai/search` nhưng FE code thật không gọi nó (chỉ mock). Giữ làm rezerv per §20, không phục hồi.
- AGENTS.md §20 cấm xóa route dead — 80 backend + 38 ai-service dead phải giữ nguyên.