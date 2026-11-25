# Todo — `/map` thành bản đồ lớp ghim (2026-11-25)

Kế hoạch: `tasks/map-layers-plan.md`. Đợt này KHÔNG xoá API nào: 5 tool "Phân tích"
vẫn còn component, route Rust, BFF, chỉ rời khỏi UI.

## Đã xong (local)

### Phase 1 — 5 tool "Phân tích" rời UI

- [x] `components/map/tools/registry.tsx`: tách `VISIBLE_TOOL_META` (8) và
      `ARCHIVED_TOOL_META` (5). `MAP_TOOLS` / `MAP_TOOL_BY_ID` chỉ dựng từ visible.
      Export `ARCHIVED_MAP_TOOLS`, `ARCHIVED_TOOL_IDS`, `isArchivedTool`, `getMapTool`.
      Bỏ 5 lời gọi `dynamic()` + 5 khoá `TOOL_PARTS` của tool archived.
- [x] `app/map/page.tsx`: xoá divider "Phân tích" + lưới analysis; dải tab còn
      `grid-cols-3` cho Tổng quan + 8 tool; `ToolTab` xếp dọc (icon trên, nhãn dưới).
      `getResultCount` bỏ 5 nhánh.
- [x] `src/lib/feature-catalog.ts`: xoá 5 `Feature`, xoá 5 keyword ở mục bản đồ,
      bỏ import lucide không dùng → 37 tính năng.
- [x] `next.config.js`: `/map/{data-hunter,gap-predictor,resource-optimizer,geo-vision,survey-planner}`
      redirect về `/map` (`permanent: false`).
- [x] URL: `?tool=<archived>` rơi về Tổng quan + xoá param bằng `replaceState`
      (không thêm history entry).

### Phase 2 — khối "Lớp ghim" ở Tổng quan

- [x] `enabledLayers: Set<string>` mặc định `poi,wifi,green,stem,summer,donate,market`
      (khí hậu và nơi học tắt để trang mở không gọi API nặng).
- [x] `toggleLayer` / `enableLayer` / `isLayerOn`.
- [x] Card "Lớp ghim" trong `showHomeControls`: checkbox · icon · nhãn · số đếm.
      Dòng POI có 2 chip "Cụm ghim" / "Lớp nhiệt" thay công tắc rail cũ.
- [x] `visiblePinCategories` = `enabledLayers` giao 6 category featured (một chiều,
      `useMemo`); `hiddenPinCategories` = phần bù. Không còn state thứ hai.
- [x] Chú giải ghim đọc/ghi cùng `enabledLayers` (`toggleLayer`).
- [x] `handleToolChange(id)` gọi `enableLayer(id)` khi mở tab (một chiều: tab → lớp).
- [x] Panel ẩn mount cho `learning-space` + `climate` (chúng tự sinh ghim);
      6 category còn lại lấy từ `/api/map/featured-pins` (không gọi trùng).
- [x] `overlayNode` chỉ vẽ overlay của `PIN_LAYER_IDS` (climate, learning-space).
- [x] `MapComponent`: thêm prop `hiddenPinCategories`; `FeaturedPinsLayer` không
      còn bị ẩn khi `showHeatmap` bật.
- [x] `FeaturedPinsLayer`: bỏ điều kiện `visibleCategories.size > 0` (set rỗng
      giờ nghĩa là không vẽ ghim nào, đúng với "tắt hết lớp").

### Phase 3 — Khí hậu thành ghim

- [x] `ClimateGuardianOverlay`: `risk_ranking.slice(0, 15)` → marker hazard
      `createPinIcon("hazard", { type: "amount", value: "<pct>%" })`.
- [x] Tooltip tên ô + %; Popup mức %, ngập, thời tiết, tiếp cận, độ cao (nếu có),
      lý do. Heat + polygon mờ vẫn giữ.
- [x] Chip amber "Chưa lấy được độ cao địa hình (Open-Meteo)..." khi
      `metadata.degraded` và mọi cell `elevation_m === null`
      (Render free tier không ra được Open-Meteo — trạng thái này là thật).
- [x] Empty state "Chưa có ô rủi ro nổi bật trong vùng này."

### Phase 4 — dock không bị panel che

- [x] `QuickDock`: trên `/map` FAB thu gọn `bottom-5 left-5`; dock mở rộng
      `left-5`, `maxWidth: calc(100vw - var(--edumap-map-panel-w, 4.5rem) - 2.5rem)`,
      `overflow-x-auto` của `Dock` lo phần còn lại. Trang khác giữ giữa.
- [x] `MapMenu`: `useEffect` ghi `--edumap-map-panel-w` = `open ? panelSize.width + 56 : 56`
      lên `document.documentElement`, cleanup xoá biến.
- [x] `MapClickHandler`: bấm popup/tooltip/marker/cluster/pin/control không mở form ghim.

## Kiểm chứng local (đã chạy)

- `python3 -m py_compile` không liên quan; các gate tĩnh frontend:
  - `/tmp/opencode/balance.py` — OK toàn bộ file sửa.
  - `/tmp/opencode/unused.py` — clean toàn bộ file sửa.
  - `/tmp/opencode/resolve_imports.py` — OK (mọi import tương đối / `@/`).
  - `/tmp/opencode/scan.py` — 0 hit mojibake.
  - `/tmp/opencode/trace_map_graph.py` — 0 leak leaflet vào graph SSR của `/map`.
  - `/tmp/opencode/check_nav.py` — 7 hub, 37 entry, 8 visible tool, 5 archived,
    `PIN_LEGEND` ⊆ visible, mọi `/map?tool=` → visible, archived ∉ `FEATURES`.
  - `tsc --noEmit` (dùng node_modules của `base-pristine` + leaflet của `naifarm`,
    chỉ lọc lỗi thật): 0 lỗi type/syntax ở mọi file đã sửa. Lỗi còn lại toàn
    `TS2307`/`TS2786` do môi trường tham chiếu thiếu `sonner`, `d3`,
    `react-leaflet-cluster` và lệch `@types/react` — không phát sinh từ diff.
- `git diff --stat -- backend ai-service frontend/app/api` = rỗng (0 file).

## Việc người dùng phải làm

1. `git push` → GitHub Actions build `edumap-api` + `edumap-ai` → Render deploy.
   Cold start 30–60 s; lần gọi đầu có thể 503.
2. Mở `/map` và kiểm:
   - Panel phải chỉ còn **Tổng quan + 8 tab**, không còn nhóm "Phân tích".
   - Tổng quan có card **"Lớp ghim"** (9 dòng, có số đếm, 2 chip cho POI).
   - Tắt/bật từng dòng: ghim biến mất/xuất hiện ngay; chú giải ghim đổi cùng.
   - Bật **Rủi ro khí hậu**: ghim đỏ có `%` (tối đa 15 ô); bấm ghim → popup có
     ngập/thời tiết/tiếp cận/lý do; thấy chip amber về Open-Meteo (bình thường).
   - Bật **Lớp nhiệt** cho POI: ghim wifi/xanh/STEM/mùa hè/quyên góp/chợ vẫn còn.
   - Bật **Nơi học (AI)**: ghim nơi học xuất hiện từ panel ẩn.
   - Dock thu gọn nằm **dưới-trái**, không bị panel phải che; kéo rộng panel
     300–640 px dock vẫn không bị đè.
   - Mở `/map?tool=data-hunter`: về Tổng quan, URL mất `tool`.
   - `/features`: không còn 5 mục Truy đuổi dữ liệu / Dự báo khoảng trống /
     Tối ưu nguồn lực / GeoVision AI / Kế hoạch khảo sát.
3. `./scripts/smoke_render.sh <API_URL> <AI_URL>` vẫn 5/5.

## Bật lại 5 tool "Phân tích" (khi cần)

Code + API còn nguyên, chỉ thiếu UI:

1. `components/map/tools/registry.tsx`: chuyển entry từ `ARCHIVED_TOOL_META`
   sang `VISIBLE_TOOL_META` (giữ nguyên `id`, `label`, `icon`, `tier`).
2. Thêm lại `const XxxPanel = dynamic(() => import("./XxxTool").then((m) => m.XxxPanel), { ssr: false })`
   và khoá `id` tương ứng trong `TOOL_PARTS`. Overlay của 3 tool phân tích
   (`data-hunter`, `gap-predictor`, `resource-optimizer`, `geo-vision`,
   `survey-planner`) vẽ theo dữ liệu trong panel, nên chỉ cần Panel.
3. `src/lib/feature-catalog.ts`: thêm `Feature` với `href: "/map?tool=<id>"`,
   `group: "map"`.
4. `next.config.js`: bỏ redirect `/map/<id>` → `/map` (nếu muốn giữ URL cũ).
5. `app/map/page.tsx`: `getResultCount` thêm nhánh nếu muốn badge số kết quả.

Không cần đụng `backend/`, `ai-service/`, `frontend/app/api/`.
