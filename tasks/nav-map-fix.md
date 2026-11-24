# Kế hoạch: dọn tool bản đồ + bỏ sidebar trái + panel /map co dãn

Phiên 2026-11-25. Nguồn: yêu cầu người dùng + khảo sát code (file/dòng ghi kèm).

## 0. Quyết định đã chốt

| # | Hạng mục | Chốt |
| --- | --- | --- |
| 1 | Tool bản đồ | Bỏ `ai-agent` (AI Agent bản đồ) — trùng chat AI + tìm kiếm NL trên `/map` |
| 2 | Tool "tối ưu" | Viết lại `resource-optimizer` cho rõ ràng (đầu vào/kết quả/cách tính) |
| 3 | Sidebar trái | Bỏ hẳn. Điều hướng bằng `HubTabBar` (trong hub) + `QuickDock` (giữa hub) |
| 4 | Không thêm header ngang | Không có thanh nav trên cùng |
| 5 | Bảng điều khiển | Bấm avatar/tên → drawer trượt chứa nội dung `/dashboard` |
| 6 | Trang `/learn` | Lưới 3 thẻ bị thừa → bỏ trang trung gian, vào thẳng nội dung |
| 7 | `data-hunter` + `gap-predictor` | **Giữ cả hai** (không gộp, không bỏ) |
| 8 | `geo-vision` | **Giữ** + thêm nhãn rõ "chưa có dữ liệu/đang chờ provider" khi `degraded` |
| 9 | `/features` | **Giữ**, mở từ `QuickDock` |

## 1. Ràng buộc (AGENTS.md)

- §1: chỉ sửa code + chạy script Python kiểm tra. **Không** `npm`/`docker`/dev
  server. Deploy = người dùng, runtime truth = host.
- §8: dùng token màu Desert Dusk, icon `lucide-react`, `.card-surface`,
  `ContentShell`; copy tiếng Việt; không emoji-icon.
- §20: **không xóa route backend/BFF** vì bị coi là "dead". Đây là việc điều
  hướng FE — không đụng API surface.
- §21/§28: `frontend/src/lib/feature-catalog.ts` là nguồn duy nhất cho điều
  hướng; mỗi tính năng thuộc đúng 1 hub.
- Không có `node_modules` local → không chạy `tsc`; kiểm bằng script Python
  (`balance`, `unused`, trace leaflet, `check_nav`, `audit_final`).

## 2. Hiện trạng (đã khảo sát)

| Khu vực | File/dòng | Ghi chú |
| --- | --- | --- |
| Tool bản đồ | `frontend/components/map/tools/registry.tsx` | 14 tool: 6 `core` (climate, wifi, green, learning-space, donate, market) + 8 `analysis` (data-hunter, gap-predictor, resource-optimizer, geo-vision, survey-planner, **ai-agent**, stem, summer). Meta 5-160, MAP_TOOLS 189-232, dynamic AiAgent 167/181/209 |
| Danh mục | `frontend/src/lib/feature-catalog.ts` | entry `ai-agent` 148-157; keyword "ai-agent" ở dòng 96 |
| Redirect | `frontend/next.config.js` | `/ai-agent` → `/map?tool=ai-agent` (111); `/map/data-hunter` (122); `/map/gap-predictor` (123) |
| Tối ưu | `frontend/components/map/tools/ResourceOptimizerTool.tsx` | typo "giáo dụng" (78, 304) + "tối đa hoá **đi** coverage" (154); khối "Phương pháp" 149-157 ghi trọng số **sai** (copy của Resource Exchange); kế hoạch A/B/C 26-33 không giải thích; chỉ gửi `budget` |
| Backend tối ưu | `backend/src/modules/map.rs` 903-967 | đã nhận `budget, center_lat/lng, region_radius_km, coverage_radius_km`; tự lấy demand/candidate từ POI rồi proxy `/api/ai/resource/optimize` |
| Sidebar | `frontend/components/Sidebar.tsx` 1-215; `AppLayout.tsx` 50 (`lg:ml-[var(--sidebar-width)]`) | `--sidebar-width` **chỉ** dùng ở đây + `globals.css` 12-13 |
| Mobile header | `AppLayout.tsx` 52-68 (`lg:hidden`, hamburger) | Bỏ cùng sidebar |
| Chiều cao trang | `3.5rem` = header mobile | map 727, ai-chat 266, offline-tutor 213, career 160, volunteer 80/90, language-bridge 233, `globals.css` 313-314, `RoutingPanel.tsx` 562 |
| Dock | `frontend/components/ui/magic/QuickDock.tsx` 33-95 | theme · ai-chat · map · dashboard · library · profile · scroll-top · thu gọn |
| Panel /map | `frontend/components/map/MapMenu.tsx` 45-47 | rộng cứng `w-[380px]` |
| Hook co dãn | `frontend/src/hooks/useResizable.ts` | có `handleEdge: "left"` + min/max — tái dùng được |
| Hub landing | `app/learn|ai|contribute/page.tsx` → `components/hubs/HubLanding.tsx` | lưới thẻ link, không nội dung thật |

## 3. Các giai đoạn

### GĐ1 — Bỏ tool `ai-agent`

- `registry.tsx`: xóa `TOOL_META` entry `ai-agent`; xóa `AiAgentPanel`/
  `AiAgentOverlay` dynamic import; xóa phần tử trong `MAP_TOOLS`.
- Xóa `frontend/components/map/tools/AiAgentTool.tsx` nếu không nơi khác import.
- `feature-catalog.ts`: xóa entry `ai-agent`; bỏ `"ai-agent"` khỏi keyword của
  `map`.
- `next.config.js`: `/ai-agent` → `/map` (không còn `?tool=`).
- Rà `map/page.tsx` + `MapComponent` không còn id `ai-agent`.
- **Không đụng** `data-hunter`/`gap-predictor` (chốt: giữ cả hai).
- **Chấp nhận**: `grep -rn "ai-agent"` chỉ còn 1 dòng redirect; tool = 13.

### GĐ2 — Viết lại `resource-optimizer`

- Sửa typo: "giáo dụng" → "giáo dục"; "tối đa hoá đi coverage" → "tối đa hoá
  độ phủ".
- Thay khối "Phương pháp": mô tả đúng MCLP (ngân sách, đơn giá/cơ sở, bán kính
  phủ) — **bỏ** dòng trọng số sai của Resource Exchange.
- Thêm đầu vào: bán kính phủ (km) + bán kính vùng (km); gửi kèm
  `coverage_radius_km`, `region_radius_km` (backend đã hỗ trợ).
- Kết quả rõ hơn: số cơ sở chọn theo kế hoạch, % dân số/điểm nhu cầu được phủ,
  chi phí; chú thích "Kế hoạch A/B/C = 40/70/100% ngân sách".
- Hiện chế độ `degraded` kèm lý do (đã có) — giữ.
- **Chấp nhận**: panel không còn chuỗi sai; mọi điều khiển có nhãn tiếng Việt rõ.

### GĐ2b — Nhãn trạng thái `geo-vision`

- Khi kết quả `degraded`/rỗng: hiện khối rỗng rõ ràng ("Chưa có dữ liệu — tính
  năng đang chờ provider nhận dạng ảnh vệ tinh"), không để trống gây hiểu nhầm.
- Giữ nguyên route + nhãn tool; không đổi backend/ai-service.
- **Chấp nhận**: bấm GeoVision luôn thấy thông điệp giải thích thay vì màn hình trống.

### GĐ3 — Bỏ sidebar trái

- `AppLayout.tsx`: bỏ `<Sidebar/>`, bỏ `lg:ml-[var(--sidebar-width)]`, bỏ mobile
  header (52-68) + state `mobileOpen`/hamburger liên quan.
- Xóa `frontend/components/Sidebar.tsx`; xóa `src/lib/layout-constants.ts` nếu
  hết nơi dùng.
- `globals.css`: bỏ `--sidebar-width`/`--sidebar-width-collapsed` (12-13) và
  block `#app-content .min-h-screen` calc (313-314).
- Đổi chiều cao trang `calc(100dvh-3.5rem)` → `h-dvh`/`min-h-dvh`; `RoutingPanel`
  `top-[56px]` → `top-4`.
- **Chấp nhận**: `grep -rn "sidebar-width\|app-sidebar\|3.5rem"` = 0.

### GĐ4 — `QuickDock` thành điều hướng chính

- Thay 5 link rời bằng **7 hub** (icon từ `FEATURE_GROUPS`) + shortcut `ai-chat`
  + mục **Danh mục** (`/features`).
- Thêm nút **avatar** → mở drawer bảng điều khiển (GĐ5).
- Mobile: dock thu gọn/mở popover liệt kê 7 hub (tránh tràn ngang).
- Trạng thái active theo `usePathname()` map pathname → hub (như
  `Sidebar.activeHref` cũ, chuyển sang dock).
- **Chấp nhận**: từ mọi trang, mở được 7 hub + `/features` + avatar + bảng điều khiển.

### GĐ5 — Drawer bảng điều khiển

- Tách thân `app/dashboard/page.tsx` thành `components/dashboard/DashboardContent.tsx`;
  page render nó, drawer cũng render nó (không iframe).
- Drawer: `fixed inset-y-0 right-0 z-40 w-[min(460px,100vw)]`, viền + shadow,
  đóng bằng nút + `Esc`; không dùng lớp phủ tối (giữ tinh thần §25).
- **Chấp nhận**: bấm avatar mở drawer đúng nội dung; `/dashboard` vẫn hoạt động.

### GĐ6 — Bỏ trang landing `/learn`, `/ai`, `/contribute`

- Mỗi hub trỏ thẳng trang chính: `learn` → `/scholarships`, `ai` → `/ai-chat`,
  `contribute` → `/impact-match` (cập nhật href trong `feature-catalog.ts`).
- Xóa `app/learn`, `app/ai`, `app/contribute`, `components/hubs/HubLanding.tsx`.
- `next.config.js`: thêm redirect `/learn` → `/scholarships`, `/ai` → `/ai-chat`,
  `/contribute` → `/impact-match`.
- Tránh trùng tab trong `featuresForGroup` (hub href = trang con ⇒ phải gộp entry
  để không có 2 tab cùng đích).
- Cập nhật `app/sitemap.ts`.
- **Chấp nhận**: `/learn` vào thẳng danh sách học bổng; 0 trang lưới thẻ thừa.

### GĐ7 — Kiểm chứng (local, không runtime)

- `python3 /tmp/opencode/check_nav.py` (cập nhật theo hub mới): OK.
- `balance.py` + `unused.py` trên mọi file sửa: sạch.
- Trace leaflet từ `/map`: 0 leak.
- `python3 /tmp/audit_final.py`: `ghosts_be=0`, `ghosts_ai=0`, ⊆ True.
- Grep gate: `ai-agent` còn 1 dòng; `sidebar-width`/`app-sidebar`/`3.5rem` = 0.
- Cân bằng ngoặc toàn bộ file sửa.

## 4. Rủi ro / cạm bẫy

1. Dock 7 hub dễ tràn trên mobile → phải có popover/bản thu gọn.
2. `featuresForGroup` + hub href trỏ trang con → sinh tab trùng; phải gộp entry.
3. Chiều cao `/map` phụ thuộc header mobile 3.5rem; bỏ header phải đổi `h-dvh`.
4. `HubTabBar` active không xử lý query (`?tool=`); không đổi.
5. Không được chạm BFF/backend (không xóa route §20).
6. `tsc` không chạy được local → phải trace/parse kỹ trước khi push.

## 5. Trạng thái chốt

Tất cả quyết định đã khép kín (mục §0). Thứ tự thực hiện đề xuất:

1. GĐ1 (bỏ `ai-agent`) — nhỏ, độc lập.
2. GĐ2 + GĐ2b (tối ưu + nhãn GeoVision).
3. GĐ3 (bỏ sidebar) → GĐ4 (dock) → GĐ5 (drawer) — làm liền mạch vì cùng đụng
   `AppLayout`/nav.
4. GĐ6 (bỏ landing thừa).
5. GĐ7 (kiểm chứng) sau mỗi giai đoạn; chạy lại toàn bộ trước khi push.

## 6. Trạng thái thực hiện (2026-11-25)

Tất cả giai đoạn đã làm xong:

| GĐ | Việc | Trạng thái |
| --- | --- | --- |
| GĐ1 | Bỏ `ai-agent` (registry 13 tool, catalog, redirect `/ai-agent`→`/map`, xoá `AiAgentTool.tsx`) | ✅ |
| GĐ2 | Viết lại `ResourceOptimizerTool` (MCLP, bán kính phủ/vùng, `center_*` theo viewport, so sánh A/B/C, bỏ khối trọng số sai + typo) | ✅ |
| GĐ2b | `GeoVisionTool` thêm nhãn rỗng "chưa có kết quả … đang chờ provider" | ✅ |
| GĐ3 | Bỏ sidebar + header mobile + `--sidebar-width`; `calc(100dvh-3.5rem)` → `h-dvh`; `RoutingPanel` `top-4` | ✅ |
| GĐ4 | `QuickDock` = nav chính (7 hub + `/features` + avatar + theme + scroll + thu gọn), `groupForPath` cho active | ✅ |
| GĐ5 | Avatar → `DashboardDrawer`; tách `DashboardContent` dùng chung; panel `/map` co dãn (`useResizable`) | ✅ |
| GĐ6 | Bỏ `/learn`,`/ai`,`/contribute` + `HubLanding`; `FeatureGroup.hubHref`; redirect + sitemap | ✅ |
| GĐ7 | `check_nav` OK (7 hub, 42 tính năng, 13 tool); balance/unused/resolve_imports sạch; trace leaflet 0 leak | ✅ |

Chưa kiểm được: `tsc`/`next build` (không có `node_modules` local) — runtime truth
là host sau khi người dùng deploy.
