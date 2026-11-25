# Kế hoạch: `/map` thành bản đồ lớp ghim, bỏ 5 tool "Phân tích"

Phiên 2026-11-25.

> `tasks/plan.md` và `tasks/todo.md` vẫn còn mục chưa tick của việc khác nên không
> ghi đè. Task list của đợt này: `tasks/map-layers-todo.md`.

## 0. Điều tra trước khi sửa (đọc code, không đoán)

| Sự thật | Bằng chứng |
| --- | --- |
| 6 loại wifi/xanh/STEM/mùa hè/quyên góp/chợ ĐÃ vẽ ghim chung một lớp | `FeaturedPinsLayer` dùng 1 `MarkerClusterGroup`; `GET /map/featured-pins` gộp 6 bảng (`backend/src/modules/map.rs` 676-820) |
| Bật/tắt 6 loại ĐÃ có state nhưng bị giấu sau 1 nút rail | `visiblePinCategories` (`app/map/page.tsx` ~297), `PIN_LEGEND` (`components/map/pin-themes.ts`), mục "Chú giải ghim" trong `menuGroups` |
| `learning-space` KHÔNG có ghim | `LearningSpaceTool.tsx`: Overlay vẽ `Circle` 180 m + marker theme `library`; `result` chỉ tồn tại khi tab đang mở |
| `climate` KHÔNG có ghim | `ClimateGuardianTool.tsx`: Overlay vẽ heat + GeoJSON polygon; `risk_ranking` (15 ô) hoàn toàn không được vẽ |
| Mỗi tool tự gọi API riêng, trùng dữ liệu | `WifiPanel`→`/api/wifi/locations`; `GreenPanel`→`/api/green/challenges`; `Stem/Summer/Donate/Market`→service riêng; `FeaturedPinsLayer`→`/api/map/featured-pins` |
| 13 tool chia 2 tầng `core` 6 / `analysis` 7 | `registry.tsx` + divider "Phân tích" trong `app/map/page.tsx` |
| Dock thu gọn bị panel phải che | `QuickDock` FAB `right-[4.75rem]` (76 px) < rail 56 + panel 380 px; panel `z-[50]` > dock `z-40` |
| `showHeatmap` đang ẩn luôn featured pins | `MapComponent`: `{!showHeatmap && featuredPins.length > 0 && ...}` |

Điều tra này dẫn tới một sửa đổi so với cách hiểu ban đầu: **ghim KHÔNG phải là
việc của tab tool**, mà là việc của `FeaturedPinsLayer` + POI cluster. Vì vậy
"lớp ghim" chỉ cần điều khiển 2 nguồn vẽ đó, không phải chạy 8 panel cùng lúc.

## 1. Quyết định của người dùng

| # | Câu hỏi | Chốt |
| --- | --- | --- |
| D1 | 5 tool "Phân tích" | Bỏ khỏi UI, giữ code + API |
| D2 | Nghĩa của "ghim" | Lớp ghim bật/tắt; bấm ghim mở chi tiết |
| D3 | Dock bị che | Dock về góc dưới-trái khi ở `/map` |
| D4 | Khí hậu thành ghim | Ghim ô rủi ro cao nhất (từ `risk_ranking`) |

5 tool ẩn khỏi UI: `data-hunter`, `gap-predictor`, `resource-optimizer`,
`geo-vision`, `survey-planner`.

## 2. Kiến trúc sau khi làm

```
/map  (1 trang, 1 menu phải)
├─ Panel "Tổng quan" = bộ điều khiển lớp ghim
│   [x] Cơ sở giáo dục (POI)   n=2744   -> cụm marker POI | ( ) lớp nhiệt
│   [x] Wifi                   n=...    -> FeaturedPinsLayer
│   [x] Xanh                   n=...    -> FeaturedPinsLayer
│   [x] STEM Lab               n=...    -> FeaturedPinsLayer
│   [x] Mùa hè                  n=...    -> FeaturedPinsLayer
│   [x] Quyên góp              n=...    -> FeaturedPinsLayer
│   [x] Chợ chia sẻ            n=...    -> FeaturedPinsLayer
│   [ ] Nơi học (AI)           n=-      -> panel riêng, tick mới request
│   [ ] Khí hậu (rủi ro)       n=-      -> panel riêng, tick mới request
├─ Tab từng lớp = mở chi tiết lớp đó (không phải cổng duy nhất để thấy ghim)
└─ Bản đồ: POI cluster + featured pins (lọc theo enabledLayers)
```

- **Một nguồn trạng thái:** `enabledLayers: Set<string>`.
  - `visiblePinCategories = enabledLayers` giao với 6 category featured (useMemo).
  - Khối "Lớp ghim" ở Tổng quan, chú giải ghim, và nút tab đều đọc/ghi set này.
- **Vì sao không mount 8 panel ẩn:** 6 loại featured đã có ghim từ
  `/api/map/featured-pins` (1 request). Mount thêm panel sẽ gọi trùng API và vẽ
  trùng ghim. Chỉ `learning-space` và `climate` cần panel mount (thêm ẩn, chỉ khi
  tick), vì ghim của chúng sinh ra trong panel.
- Bấm tab `wifi` khi lớp đang tắt -> bật lớp wifi (một chiều: tab -> layer). Tắt
  lớp wifi thì tab wifi vẫn mở được panel, chỉ không vẽ ghim.
- Bỏ `showHeatmap` như công tắc thay thế POI: chuyển thành lựa chọn trong dòng POI
  (Cụm ghim / Lớp nhiệt), và `FeaturedPinsLayer` không còn bị ẩn bởi heat nữa.

## 3. Task

### Phase 1 — 5 tool "Phân tích" rời khỏi UI

**Task 1** — `components/map/tools/registry.tsx`
Tách `VISIBLE_TOOL_META` (8: `climate`, `wifi`, `green`, `learning-space`, `stem`,
`summer`, `donate`, `market`) và `ARCHIVED_TOOL_META` (5). `MAP_TOOLS` và
`MAP_TOOL_BY_ID` chỉ dựng từ visible; `?tool=data-hunter` rơi về Tổng quan. Bỏ
5 lời gọi `dynamic()` và 5 khoá `TOOL_PARTS`. Export `ARCHIVED_MAP_TOOLS` để đọc
được làn nào bật trở lại.

**Task 2** — `app/map/page.tsx`
- Xoá divider `Phân tích` và `grid grid-cols-2` của tầng analysis.
- `getResultCount`: xoá 5 nhánh `data-hunter`, `gap-predictor`, `resource-optimizer`,
  `geo-vision`, `survey-planner`.
- Grid tool: Tổng quan + 8 = 9 mục, `grid-cols-3`, nhãn `truncate` và
  `text-[10px]` để không tràn chữ.

**Task 3** — `src/lib/feature-catalog.ts`
Xóa 5 `Feature` (`data-hunter`, `gap-predictor`, `resource-optimizer`, `geo-vision`,
`survey-planner`) và 5 keyword tương ứng ở entry bản đồ. Giữ group `map`,
`hubHref: "/map"`. Còn 37 tính năng.

**Task 4** — `next.config.js`
Thêm redirect tạm thời (`permanent: false`) `/map/data-hunter`, `/map/gap-predictor`,
`/map/geo-vision`, `/map/resource-optimizer`, `/map/survey-planner` về `/map`.

**Ghi chú:** không cần đụng `registry` map cũ vì đây là 5 **tool** không phải
hub; `/map/data-hunter` chưa từng có route Next.js (chỉ là tool id trong query),
nhưng thêm redirect để bookmark cũ không 404.

**Chấp nhận Phase 1**
- `/map` không còn divider "Phân tích", không còn tab của 5 tool.
- `/features` không còn 5 mục đó; vẫn còn group Bản đồ + hub `/map`.
- `?tool=data-hunter` mở Tổng quan.
- 5 file `components/map/tools/*.tsx` và toàn bộ route Rust/ai-service/BFF còn nguyên.

### Phase 2 — khối "Lớp ghim" ở Tổng quan

**Task 5** — state
`const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set(["poi",
"wifi", "green", "stem", "summer", "donate", "market"]))`.

`toggleLayer(id)`: thêm/xóa id; khi thêm vào và `id` là `learning-space`/`climate`
thì `setToolResults(prev => ({...prev, [id]: null}))` để panel ẩn tự fetch.

**Task 6** — UI khối
Trong nhánh `showHomeControls` của panel, thêm card "Lớp ghim" trước ô tìm kiếm:
mỗi dòng là `checkbox` + icon theme (`getPinTheme`) + nhãn + số đếm bên phải.
Số đếm: POI `locations.length`; 6 featured `featuredPins.filter(p => p.category ===
id).length`; `learning-space` `Array.isArray(toolResults["learning-space"]) ?
.length : "—"`; `climate` `toolResults?.climate?.risk_ranking?.length ?? "—"`.
Dòng POI có thêm 2 chip "Cụm ghim" / "Lớp nhiệt" thay cho `showHeatmap`.

**Task 7** — mount ẩn 2 panel
Chỉ với `learning-space` và `climate`:
```tsx
<div className="hidden">
  {enabledLayers.has("climate") && <ClimateGuardianPanel {...toolPanelProps("climate")} />}
  ...
</div>
```
Panel đã tự `if (!active) return` và tự `skip khi result !== null`, không sinh request lặp.

**Task 8** — overlay
`overlay` = (enabled của climate ? `<ClimateGuardianOverlay result={toolResults.climate} …/>` : null)
        + (enabled của learning-space ? `<LearningSpaceOverlay …/>` : null).
Nhánh cũ "chỉ overlay tool đang active" bỏ: overlay 6 featured nằm trong
`FeaturedPinsLayer`, overlay 2 lớp riêng nằm đây => luôn đúng 1 nguồn vẽ.

**Task 9** — hợp nhất bật/tắt
- `visiblePinCategories = useMemo(() => new Set([...enabledLayers].filter(id =>
  FEATURED_IDS.includes(id))), [enabledLayers])`.
- Bấm 1 dòng trong chú giải: `toggleLayer(cat)` (không còn `togglePinCategory` riêng).
- Bấm tab tool: `setActiveTool(id)`; nếu `id` là featured thì `addLayer(id)`.

**Task 9b** — `MapComponent.tsx`
Bỏ `!showHeatmap &&` trước `FeaturedPinsLayer` để bật lớp nhiệt không làm mất ghim
featured. Kiểm tra imbalance khi heat + cluster cùng `points` — nếu cần, truyền
`points={[]}` cho cluster khi heat bật (đã đúng: ternary hiện tại chỉ chọn 1).

**Chấp nhận Phase 2**
- Tổng quan: bật/tắt 9 lớp tại chỗ, thấy số đếm từng lớp.
- Mở `/map` mặc định chỉ 2 request (POI + featured-pins) — không 8.
- Tick "Khí hậu" → 1 request climate, ghim ô rủi ro xuất hiện.
- Tick "Nơi học" → 1 request recommend, ghim nơi học xuất hiện.
- Chú giải ghim vẫn mở được và đổi checkbox ở Tổng quan (cùng state).
- Lớp nhiệt bật không làm mất ghim wifi/xanh/STEM/mùa hè/quyên góp/chợ.

### Phase 3 — Khí hậu có ghim

**Task 10** — `ClimateGuardianOverlay`
`risk_ranking.slice(0, 15)` → `createPinIcon("hazard", { type: "amount", value:
Math.round(r.risk_score * 100) })`; `Tooltip` tên `r.nearest_facility || "Vùng
rủi ro"`; `Popup`: mức %, ngập %, thời tiết %, tiếp cận %, độ cao (nếu có), lý do
`r.reason`. Giữ polygon `fillOpacity 0.08` và heat.

**Task 11** — chip trong `ClimateGuardianPanel`
- `metadata.degraded` + mọi cell `elevation_m === null` → chip amber:
  "Chưa lấy được độ cao địa hình (Open-Meteo). Điểm rủi ro chỉ tính ngập và tiếp cận."
- `risk_ranking` rỗng → "Chưa có ô rủi ro nổi bật trong vùng này."

**Chấp nhận Phase 3**
- `curl` host trả 729 cell → UI có tối đa 15 ghim đỏ kèm %; % ghim trùng % ô.
- Bấm ghim mở popup có lý do; không có `undefined`.

### Phase 4 — dock không bị panel che

**Task 12** — `components/ui/magic/QuickDock.tsx`
- FAB thu gọn: `onMap ? "bottom-5 left-5" : "bottom-5 right-5"` (bỏ
  `right-[4.75rem]`).
- Dock mở rộng: `onMap ? "left-5" : "left-1/2 -translate-x-1/2"`.
- `onMap` → `style={{ maxWidth: "calc(100vw - 4.5rem)" }}`; giữ `overflow-x-auto`
  để cuộn ngang khi hẹp.
- Mobile popover vẫn `bottom-3 left-3` như hiện tại (không đổi).

**Task 13** — `components/map/MapMenu.tsx`
`useEffect` ghi `--edumap-map-panel-w` = `open ? panelSize.width + 56 : 0` px lên
`document.documentElement`; cleanup xoá biến. CSS `overflow-x-auto` lo phần còn
lại nếu dock vẫn rộng (không cần đọc biến trong QuickDock, tránh lệch state).

**Chấp nhận Phase 4**
- `/map` desktop: dock ở dưới-trái, không bị panel che ở mọi độ rộng 300-640 px.
- Trang khác: dock vẫn giữa như cũ.
- Mobile: popover dọc dưới-trái như cũ.

### Phase 5 — kiểm chứng + tài liệu

**Task 14** `/tmp/opencode/check_nav.py`
`tools = 8`, `entries = 37`; thêm assert `ARCHIVED_MAP_TOOLS` (5) không nằm trong
`FEATURES`; assert mọi `href` `/map?tool=` ánh xạ tới visible tool; assert mọi
`PIN_LEGEND.category` là visible tool id (nếu không, chú giải sẽ vẽ ghim do lớp
đã ẩn).

**Task 15** `tasks/map-layers-todo.md`
Checkpoint local, việc người dùng phải deploy, cách bật lại 5 tool.

**Task 16** `AGENTS.md`
Sửa §22: 13 tool -> 8 hiển thị + 5 archived (kèm cách mở lại).
Sửa §29: dock dưới-trái trên `/map`; biến `--edumap-map-panel-w`; "Lớp ghim" là
entry chính của Tổng quan; Khí hậu ghim `risk_ranking`; gỡ ràng buộc
`!showHeatmap` cho featured pins.

## 4. Không đụng (API surface)

`backend/`, `ai-service/`, `frontend/app/api/` — 0 file thay đổi.
5 tool archived giữ nguyên component, route, BFF.
Sau commit chạy `python3 /tmp/audit_final.py` -> `ghosts_be=0`, `ghosts_ai=0`,
hai tổng `live + dead = total` vẫn khớp.

## 5. Rủi ro

| Rủi ro | Mức | Cách giảm |
| --- | --- | --- |
| Mount ẩn panel gây request trùng | Med | Chỉ mount 2 panel không có nguồn featured-pins; panel tự skip khi `result` đã có |
| `climate` ~7 s (Open-Meteo không tới được từ Render) | Med | Mặc định tắt lớp; khi bật vẫn có polygon + ghim, chỉ thiếu độ cao |
| Nhiều panel cùng gọi `onResult` ghi đè | High | `handleToolResult(toolId, …)` đã tách slot theo id |
| `enabledLayers` <-> `visiblePinCategories` vòng lặp render | Med | 1 chiều: layer -> `useMemo` -> `visiblePinCategories`; chú giải gọi `toggleLayer` |
| Lỡ xoá API surface 5 tool | High | Chỉ sửa 3 file FE; audit sau commit; không xoá file tool |
| Bật lớp nhiệt làm mất featured pins | High | Task 9b gỡ điều kiện `!showHeatmap` |
| Local không chạy được `tsc`/build (thiếu `node_modules`) | High | balance / unused / resolve_imports / trace_map_graph + grep; runtime truth = host sau deploy |

## 6. Định nghĩa xong

- `/map`: 9 tab (Tổng quan + 8), không còn nhóm "Phân tích".
- Tổng quan có khối "Lớp ghim" 9 dòng, có số đếm, tick là thấy ghim ngay.
- Bật/tắt ở Tổng quan, chú giải, tab: một state.
- Cả 8 lớp có ghim thật khi bật; bấm ghim mở chi tiết.
- Lớp nhiệt không xoá ghim featured.
- Dock `/map` dưới-trái, không bị che khi panel 300-640 px.
- `git diff --stat` với `backend/`, `ai-service/`, `frontend/app/api/` = 0 file.
- `smoke_render.sh` vẫn 5/5.
- AGENTS.md §22, §29 khớp thực tế.

Toán và chi phí request khi mở `/map` (mặc định):
POI 1 + featured-pins 1 + stats/categories (đã có) 2 = 4 request, không thêm.

## 7. Cần người dùng xác nhận trước khi code

1. 5 tool archived: **khoá hẳn** (`?tool=` rơi về Tổng quan, plan đang chọn) hay
   vẫn cho mở bằng `?tool=` để nội bộ thử?
2. Mobile `/map` đang dùng popover dọc dưới-trái — giữ nguyên sau khi thêm khối
   "Lớp ghim" chứ?
3. Có muốn dòng POI mặc định là "Cụm ghim" hay "Lớp nhiệt"?
