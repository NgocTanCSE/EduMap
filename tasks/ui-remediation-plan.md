# Kế hoạch khắc phục UI — Front-end Web

> **Môi trường deploy:** Hugging Face Spaces (free CPU tier). Local chỉ để code + unit test.
> **Kiểm tra trên:** https://tancse2005-edumap.hf.space

## 1. Tóm tắt các vấn đề UI hiện tại

### Vấn đề 1: Nút "Mở bảng bản đồ" nhấp nhô sang một bên khi thu nhỏ panel / popup lọc
**Nguyên nhân (2 nguồn):**
1. `app/map/page.tsx` (dòng 1010–1021): Nút "Mở bản đồ" tính `left` từ `sidebarSize` của chính page (272px), **không phải** từ Sidebar thực tế của AppLayout (240px). Chênh lệch 32px → nút lệch.
2. `components/Sidebar.tsx` (dòng 194–198): Sidebar khai báo `useResizable` và lấy `onSidebarResizeMouseDown`, **nhưng không gắn vào bất kỳ phần tử nào**. Không có handle kéo để resize → `sidebarSize` luôn giữ nguyên 240px. Code chết.

### Vấn đề 2: Popup không tự resize theo nội dung — nội dung bị nhồi nhét
**Nguyên nhân (3 nơi):**
1. `components/ui/MapComponent.tsx` (dòng ~909–975): POI popup có `max-w-[720px]` nhưng nội dung dùng `text-xs` / `text-[10px]` / `text-[9px]` → popup rộng mà chữ bé xíu, thẩng khuất.
2. `app/map/page.tsx` (dòng 1133): Pin form modal dùng `max-w-[84rem]` (~1344px) → tràn màn hình mobile, chưa test responsive.
3. Các popup modal (`MapToolRedirectPopup`, `FeaturedPinPopup`, `VoiceSearchPopup`) đều fix `max-w-md` → nội dung dài bị cắt/truốt.

### Vấn đề 3: Panel chỉ đường / filter không resize được, icon/nút chồi lên hàng
**Nguyên nhân:**
1. `components/map/RoutingPanel.tsx` (dòng 225): Fix `w-[340px]`, `max-h-[calc(100dvh-120px)]`, **không có handle resize**. Khi SafeRoute hiện ra (502–688), nội dung dài bị cuộn nhưng nút "Chỉ đường" (+ SafeRoute checkbox) ở trên cùng không thể điều chỉnh kích thước.
2. `app/map/page.tsx` (dòng 845–846): Tab bar tool dùng `flex-wrap gap-1.5` trong container `overflow-x-auto`. Khi 10 tab bọc xuống hàng thứ 2, layout bị lỗi spacing → button dịch chuyển.
3. `useDraggable` (dòng 34–41): Chỉ kiểm tra `INPUT/TEXTAREA/SELECT` nhưng **không kiểm tra `button` con trong header** → kéo ở header panel có thể bị "giật" nếu nhấn vào vùng button.

### Vấn đề 4: Main content thừa khoảng trống hai bên
**Nguyên nhân:**
1. `.page-shell` (globals.css): `max-w-6xl` = 1152px → trên màn hình 1920px còn lại ~384px mỗi bên.
2. `ContentShell`: **không có max-width** → content dài ra hai bên mép màn hình.
3. **Thống nhất loạn cảnh:** 28 feature dùng `.page-shell` (1152px), 6 trang dùng `max-w-7xl` (1280px), 4 trang dùng `max-w-3xl` (768px — quá hẄIEU), `dashboard/impact` dùng `page-shell max-w-7xl`. Không có chuẩn nào thống nhất.

### Vấn đề 5: Ấn vào thẻ/tag → chuyển trang thay vì popup
**Nguyên nhân:** 5 nhóm trang list/detail dùng `router.push()` / `<Link>` để chuyển trang chi tiết thay vì mở popup overlay (khác với map pin popup pattern):
- `scholarships/page.tsx` (dòng 341): `onClick={() => router.push('/scholarships/${id}')}`
- `opportunities/page.tsx` (dòng 131): `<Link href="/opportunities/${id}">`
- `community/page.tsx` (dòng 262): `<Link href="/community/post/${id}">`
- `events/page.tsx` (dòng 82): `<Link href="/events/${id}">`
- `mentor/page.tsx`: click mentor card → `router.push('/mentor/${id}')`

---

## 2. Phân tích toàn bộ thành phần UI có trong dự án

### A. Hệ thống layout & chrome

| Thành phần | File | Kiểu | Ưu điểm | Nhược điểm |
|---|---|---|---|---|
| **AppLayout** | `components/AppLayout.tsx` | Wrapper layout | Thống nhất sidebar trái cho mọi trang (trừ auth/admin/mentor-call). Mobile drawer có backdrop + Escape. | `/map` bị nhồợp: page có layout full-screen riêng + sidebar AppLayout đồng thời → floating panels `fixed` overlap vùng sidebar 240px. |
| **Sidebar** | `components/Sidebar.tsx` | Nav rail | 28 items qua `feature-catalog.ts` (single source of truth). Collapse/expand nút. Active highlight bằng `aria-current`. | `useResizable` được import nhưng **không có handle resize thực sự** → code chết. `sidebarSize` mặc định 240px không đồng bộ với map page (272px). |
| **feature-catalog** | `src/lib/feature-catalog.ts` | Data registry | 47 features, 7 groups, tìm kiếm accent-insensitive. | Một số feature (voice-search, ai-agent, green, wifi) trùng với map tool tab → navigation gấp đôi. |
| **ContentShell** | `components/ui/ContentShell.tsx` | Page container | `space-y-8 px-4 sm:px-6 py-8` — consistent vertical rhythm. | **Không max-width** → content tràn full width desktop. |
| **page-shell (CSS)** | `app/globals.css` | CSS class | `max-w-6xl` — nhất quán. | Quá hẹp (1152px) cho desktop 1920px. Không đồng nhất với ContentShell. |
| **SectionHeader** | `components/ui/SectionHeader.tsx` | Header strip | Đơn giản, có icon + title + subtitle + right slot. | Chưa kiểm tra chi tiết. |

### B. Map Hub hệ thống

| Thành phần | File | Kiểu | Ưu điểm | Nhược điểm |
|---|---|---|---|---|
| **MapPage** | `app/map/page.tsx` (1243 dòng) | Main page | 10 tool tabs trong sidebar panel, floating toolbar bottom-right, popup pattern thay thế redirect. | Quá lớn (>1000 dòng, tách thành sub-components). `SIDEBAR_WIDTH=272` sai với Sidebar thực tế 240px. |
| **InteractiveMap** | `components/ui/MapComponent.tsx` (1060 dòng) | Map renderer | Tích hợp Leaflet + MarkerCluster + GeoJSON + heatmap + routing. | POI popup `max-w-[720px]` với text `text-[9-10px]` — thông tắt. `zoomControl={false}` buộc user cuộn để zoom. |
| **RoutingPanel** | `components/map/RoutingPanel.tsx` (688 dòng) | Route panel | Consolidated "Tính lộ trình an toàn" button, SafeRoute AI multi-route, saved history. | `w-[340px]` fix, **không resize được**. SafeRoute section (501–688) rất dài → scroll dài. |
| **ToolTab** | `app/map/page.tsx:232` | Tab button | Có badge số kết quả, active state. | `flex-wrap` gây button nhảy hàng khi quá nhiều tab. |
| **Pin Modal** | `app/map/page.tsx:1131` | Modal form | Form ghim đã được `max-w-[84rem]` rộng 3x. | Quá rộng cho mobile, không có responsive breakpoint. |
| **AiPanel** | `app/map/page.tsx:179` | Side panel | Full-height right panel, có loading skeleton. | `w-96` fix. |
| **MapToolRedirectPopup** | `components/ui/MapToolRedirectPopup.tsx` | Modal | Thay thế redirect → giữ user ở trang. | `max-w-md` — text dài bị cắt. |
| **FeaturedPinPopup** | `components/ui/FeaturedPinPopup.tsx` | Modal | Thay thế featured pin redirect. | `max-w-md` — description dài bị thu hẹp. |
| **VoiceSearchPopup** | `components/ui/VoiceSearchPopup.tsx` | Modal | Web Speech API, intent classification. | Có bug CSS: `className="...${...}"` dùng template string trong className literal → **không hoạt động** (line 110–113, 117). |
| **useDraggable** | `src/hooks/useDraggable.ts` | Hook | Kiểm tra input/textarea/select để không bắt đầu drag. | Chưa kiểm tra `BUTTON` — click vào button trong header panel có thể bắt đầu drag. |
| **useResizable** | `src/hooks/useResizable.ts` | Hook | Hoạt động tốt. | Không được dùng đúng nơi (Sidebar, RoutingPanel chưa gắn handle). |

### C. Trang list → detail (vấn đề chuyển trang thay vì popup)

| Thành phần | File | Chuyển trang bằng | Ưu điểm | Nhược điểm |
|---|---|---|---|---|
| **Học bổng** | `app/scholarships/page.tsx` | `router.push()` | Có filter tab, eligibility check, bookmark. | Click thẻ → trang mới. Không có popup preview. |
| **Cơ hội** | `app/opportunities/page.tsx` | `<Link>` | `page-shell`, `Thumb` illustration, `card-footer`. | `card-footer` link full-width → chuyển trang. Tags (`#{tag}`) không click được. |
| **Cộng đồng** | `app/community/page.tsx` | `<Link>` | Trending tags, create post inline. | Post click → trang mới. Không có hover preview. |
| **Sự kiện** | `app/events/page.tsx` | `<Link>` | `ContentShell`, `SectionHeader`. | Click thẻ → trang sự kiện mới. |
| **Cố vấn** | `app/mentor/page.tsx` | `router.push()` | AI matching feature. | Click mentor card → trang chi tiết. |
| **Thư viện** | `app/library/page.tsx` | (TBD) | `page-shell`. | Cần kiểm tra. |

### D. Hệ thống design tokens & CSS

| Thành phần | File | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **Desert Dusk theme** | `app/globals.css` | HSL tokens, dark mode, light mode dự phòng. Terracotta + sage palette. | `Inter` font mặc định (AGENTS.md §8 nói dùng Inter). |
| **Typography scale** | `app/globals.css` | `.h1-page`, `.h2-section`, `.h3-card`, `.label-form`, `.label-pill` — có chuẩn. | Nhiều page dùng inline `text-xs`, `text-[10px]` thay vì token → inconsistency. |
| **Form system** | `app/globals.css` | `.form-input`, `.form-select`, `.form-textarea` — consistent. | `ContentShell` không áp dụng form token. |
| **Card system** | `app/globals.css` | `.card-surface`, `.card-equal`, `.card-footer`, `.card-grid` — có chuẩn. | Nhiều page dùng `<Card>` component (shadcn) thay vì `.card-surface` → visual drift. |
| **Leaflet theme** | `app/globals.css` | `.leaflet-popup`, `.leaflet-tooltip` được theme đúng. | Leaf popup `padding: 0 !important` → content margin 0, dễ bị dính biên. |

---

## 3. Kế hoạch fix — chia thành 4 phase

> **Nguyên tắc:** Mỗi task ≤ 5 file, tách refactor và feature riêng. Local verify bằng `npx tsc --noEmit`. Runtime verify trên HF Space.

### Phase 1: Fix layout nền tảng (độ ưu tiên cao nhất)

**Task 1.1 — Chuẩn hóa page container + max-width**
- Cập nhật `.page-shell` trong `globals.css`: `max-w-6xl` → `max-w-7xl` (1280px), hoặc dùng CSS `max-width: min(100% - 2rem, 72rem)`.
- Cập nhật `ContentShell.tsx`: thêm `max-w-7xl mx-auto` để đồng nhất.
- Cập nhật `features/page.tsx`: `max-w-6xl` → `max-w-7xl`.
- **Files:** `frontend/app/globals.css`, `frontend/components/ui/ContentShell.tsx`, `frontend/app/features/page.tsx`
- **Verify:** `npx tsc --noEmit` + kiểm tra visual.

**Task 1.2 — Sửa Sidebar width + "Mở bảng bản đồ" button**
- Sidebar: gắn `onSidebarResizeMouseDown` vào một resize handle (vertical divider ở bên phải sidebar), hoặc đơn giản hóa bỏ `useResizable` và dùng width cố định + toggle.
- Map page: đồng bộ `SIDEBAR_WIDTH` — dùng cùng giá trị với Sidebar (240px) hoặc đọc từ CSS custom property.
- **Files:** `frontend/components/Sidebar.tsx`, `frontend/app/map/page.tsx`
- **Verify:** `npx tsc --noEmit`.

### Phase 2: Fix popup & panel sizing

**Task 2.1 — Popup self-sizing + text scale**
- Tạo component `MapPopupContent` reusable với `max-w-[420px]` (mobile) → `max-w-[720px]` (desktop), text `text-sm` cho tiêu đề, `text-xs` cho phụ.
- Cập nhật POI popup trong `MapComponent.tsx`: dùng component mới, text đã chuẩn hoá.
- Cập nhật pin form modal: `max-w-[84rem]` → `max-w-3xl w-full mx-4`.
- **Files:** `components/ui/MapComponent.tsx`, `app/map/page.tsx`, (new) `components/ui/MapPopupContent.tsx`
- **Verify:** `npx tsc --noEmit`.

**Task 2.2 — Popup modal resizeable (đóng khung có thể thu nhỏ)**
- Thêm `ResizeHandle` component (draggable corner) cho `MapToolRedirectPopup`, `FeaturedPinPopup`, `VoiceSearchPopup`.
- Hoặc: tăng `max-w-md` → `max-w-lg` + thêm `max-h-[80vh] overflow-y-auto`.
- Sửa bug CSS template literal trong `VoiceSearchPopup.tsx` (line 110–113).
- **Files:** `components/ui/MapToolRedirectPopup.tsx`, `components/ui/FeaturedPinPopup.tsx`, `components/ui/VoiceSearchPopup.tsx`
- **Verify:** `npx tsc --noEmit`.

**Task 2.3 — RoutingPanel resize + tab bar**
- Thêm resize handle (vertical) cho `RoutingPanel` dùng `useResizable` (đã có hook, chưa gắn).
- Thay tab bar `flex-wrap` thành `overflow-x-auto whitespace-nowrap` để tránh button nhảy hàng.
- Điều chỉnh SafeRoute section height + scroll.
- **Files:** `components/map/RoutingPanel.tsx`, `app/map/page.tsx`
- **Verify:** `npx tsc --noEmit`.

### Phase 3: Fix pattern "click tag → chuyển trang thay vì popup"

**Task 3.1 — Tạo component DetailPopup (overlay thay thế trang chi tiết)**
- Component `DetailPopup` (hoặc `ItemCardPopup`) dùng cho scholarships, opportunities, community, events, mentor.
- Overlay full-page modal với nội dung chi tiết, nút đóng ở góc.
- **Files:** (new) `components/ui/DetailPopup.tsx`
- **Verify:** `npx tsc --noEmit`.

**Task 3.2 — Áp dụng DetailPopup cho 5 trang list**
- `scholarships/page.tsx`: thay `router.push()` bằng `setSelectedScholarship` + render `<DetailPopup>`.
- `opportunities/page.tsx`: thay `<Link>` trong card thành popup trigger.
- `community/page.tsx`: thay `<Link>` post click thành popup.
- `events/page.tsx`: thay `<Link>` thành popup.
- `mentor/page.tsx`: thay click card thành popup.
- **Files:** 5 page files.
- **Verify:** `npx tsc --noEmit`.

### Phase 4: Polish & kiểm tra tổng thể

**Task 4.1 — Fix `useDraggable` check button**
- Thêm `BUTTON` vào danh sách loại trừ trong `useDraggable.ts` để không bắt đầu kéo khi click nút trong header panel.

**Task 4.2 — Chuẩn hoá text scale toàn bộ map popup**
- Audit tất cả `text-[9px]`, `text-[10px]`, `text-xs` trong popup → chuẩn hoá theo typography scale.

**Task 4.3 — Kiểm tra tổng thể**
- `cd frontend && npx tsc --noEmit`
- Build: `npm run build`
- Verify visual trên https://tancse2005-edumap.hf.space

---

## 4. Rủi ro & mitigation

| Rủi ro | Tác động | Chiến lược giảm thiểu |
|---|---|---|
| Thay đổi layout toàn bộ → có thể break existing pages | Cao | Cherry-pick từng task, deploy từng phase. |
| Map page là full-screen nhưng AppLayout vẫn render sidebar → overlap | Trung bình | Option: thêm `/map` vào `FULL_SCREEN_PREFIXES` để bỏ sidebar AppLayout, dùng filter panel floating thay thế. |
| Popup thay thế detail page → mất SEO cho list/detail | Thấp | List page vẫn có href, popup chỉ là UI enhancement. Detail page vẫn tồn tại. |
| VoiceSearchPopup bug CSS template literal | Trung bình | Template string trong className literal không parse được → button không thấy được. Sửa ngay. |

---

## 5. Thứ tự ưu tiên thực hiện

```
Phase 1 (layout nền tảng)        → 2 task   → 1 ngày
  ├─ Task 1.1: Page container max-width
  └─ Task 1.2: Sidebar width sync
Phase 2 (popup & panel sizing)   → 3 task   → 1.5 ngày
  ├─ Task 2.1: Map popup self-sizing
  ├─ Task 2.2: Modal popup resizeable + VoiceSearch fix
  └─ Task 2.3: RoutingPanel resize + tab bar
Phase 3 (click→popup pattern)    → 2 task   → 1 ngày
  ├─ Task 3.1: DetailPopup component
  └─ Task 3.2: Apply to 5 trang list
Phase 4 (polish)                 → 3 task   → 0.5 ngày
  ├─ Task 4.1: useDraggable button fix
  ├─ Task 4.2: Text scale audit
  └─ Task 4.3: Full verify
```

---

## 6. Ghi nhớ triển khai

- **Runtime = Hugging Face Spaces free tier.** Local chỉ để code + test.
- **Deploy:** `HF_TOKEN=<token> ./deploy-hf.sh` (người dùng tan thực hiện).
- **Sau mỗi phase:** chạy `npx tsc --noEmit` local, rồi deploy + test trên HF Space.
- **AGENTS.md** là nguồn của sự thật — tuân thủ §3 (timeouts), §4 (commands), §8 (UI conventions).
