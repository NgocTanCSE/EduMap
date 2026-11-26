# FE Map UX Polish — Panel "bó", checkbox lệch hệ, responsive khó hiểu

> **TRẠNG THÁI: HOÀN THÀNH (2026-11-26).** Phase 0-4 đã triển qua 3 agent/phase;
> Phase 5 verify: **41/41 file TSX PARSE OK** (typescript compiler thật từ
> base-pristine), grep gates: `type="checkbox"` = 0 khu map, `scrollbar-hide`
> = 0 trong 8 tool hiển thị, `accent-primary` = 0 page.tsx, `min-h-screen` = 0
> trong 18 file convert. 40 file sửa (+2 file mới checkbox/switch.tsx),
> +302/-118 dòng. Runtime truth = host sau khi user deploy (checklist §T5.2).

> Nguồn: 3 sub-agent audit (2026-11-26) — panel/list overflow, checkbox/toggle
> consistency, responsive sweep. Bằng chứng đã spot-check tay (grep + read).
> Ràng buộc: local = edit + parse/balance/unused checks (không `tsc`, không
> runtime). Runtime truth = host sau khi user deploy. Không đụng API surface
> (AGENTS §20) — mọi thay đổi backend là **additive** (thêm param tuỳ chọn).

---

## 0. Tổng hợp vấn đề (evidence-based)

### Cluster A — Panel phải: danh sách bị "bó" (P0, đúng complaint của user)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| A1 | **Double-scroll + scrollbar ẩn**: mỗi tool list tự nhốt trong `max-h-*` + `overflow-y-auto scrollbar-hide` NẰM TRONG scroll container của panel (`map/page.tsx` menuBody) → 2 tầng cuộn, cả 2 đều không có scrollbar nhìn thấy | WifiTool.tsx:204 `max-h-48` (~192px ≈ 6-7 dòng), GreenTool:114 `max-h-52`, DonateTool:153 / MarketTool:209 / StemTool:201 `max-h-72`, LearningSpaceTool:197 `max-h-64`, SummerTool:165,183 `max-h-40/max-h-72`; menuBody `map/page.tsx:856` |
| A2 | **WifiTool fetch CẢ 608 điểm** (backend `wifi.rs` SELECT không LIMIT, BFF không forward param) rồi render đủ 608 dòng vào hộp 192px → nhìn như bị cắt cụt, không có pagination | WifiTool.tsx:105 fetch không param; `wifi.rs:40-52` không LIMIT; BFF `app/api/wifi/locations/route.ts:10` không forward query |
| A3 | **LearningSpace hardcode `limit: 20`** — API hỗ trợ tới 100 và trả `total`, nhưng phần dư không bao giờ tới được | LearningSpaceTool.tsx:49; `learning_community.rs:483` clamp 1-100 |
| A4 | **Climate cắt đuôi âm thầm**: `.slice(0, 10)` risk ranking + `.slice(0, 8)` alternatives, không báo còn lại | ClimateGuardianTool.tsx:204, 243 |
| A5 | **Không tool nào có pagination / load-more** (grep "Xem thêm/Tải thêm" → 0) | toàn bộ tools/*.tsx |
| A6 | Khối stats/legend trên list chiếm ~170px cố định, chật thêm phần còn lại | WifiTool.tsx:159-201 |

### Cluster B — Checkbox/toggle "phèn", không đồng bộ (P0)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| B1 | **Không tồn tại primitive Checkbox/Switch/Radio/Slider** trong `components/ui/`; không Radix, không `@tailwindcss/forms` (`tailwind.config.ts:68 plugins: []`). Duy nhất 1 rule global `accent-color` (globals.css:72-75) | ls + grep |
| B2 | Cùng 1 state `enabledLayers` nhưng **3 idioms khác nhau trên cùng trang**: (1) checkbox native 14px `h-3.5 w-3.5 accent-primary` không border/radius/focus (Lớp ghim card, page.tsx:920 — duy nhất 14px trong cả app); (2) ô vuông div + chấm tròn tự vẽ (chú giải ghim, page.tsx:1012-1019); (3) cặp chip Cụm ghim/Lớp nhiệt (page.tsx:928-933) | page.tsx |
| B3 | **6/10 checkbox dùng class no-op** `text-primary border-border rounded focus:ring-primary` (không có forms plugin → không render gì): RoutingPanel.tsx:319,328, GeoVisionTool:114, SurveyPlannerTool:101, admin/data-quality:183, donate/campaign/[id]:182 | grep |
| B4 | **3 checkbox trống trơn không class**: LearningSpaceTool:144,151, DonateTool:140 | grep |
| B5 | `aria-pressed` thiếu ở: ToolTab toolbar (page.tsx:212), heat chips (928-933), GreenTool status chips (GreenTool.tsx:104-106 dùng raw `green-100` — vi phạm §8 chrome), pin-legend rows | grep |
| B6 | **3 kiểu select khác nhau** trong tools: house `.form-select` (GapPredictor, Climate, SurveyPlanner, ResourceOptimizer) vs hand-rolled `h-9 ... text-xs` (LearningSpaceTool:138, MarketTool:167, StemTool:185) vs hand-rolled `text-sm ... ring` (GeoVision:105, DataHunter:98) | grep |
| B7 | Size checkbox 4 kiểu: `h-3.5` / `w-4 h-4` / unset / div tự vẽ `w-4 h-4` | tổng hợp trên |

### Cluster C — Responsive khó hiểu (P1)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| C1 | **`--edumap-map-panel-w` set từ giá trị CHƯA clamp** trong khi panel render đã clamp `max-w-[calc(100vw-3.5rem)]` → dock `maxWidth` calc có thể **âm** (dock biến mất) ở viewport 641-751px sau khi resize tới 640. Fallback `4.5rem` ≠ rail 56px (`3.5rem`) | MapMenu.tsx:30-40, 63; QuickDock.tsx:134 |
| C2 | **Legend + voice card đè lên panel mở** (z-60 > z-50), không biết panel đang mở; voice card `w-80` **không max-w** → tràn 17px off-screen ở 375px | page.tsx:1002, 1026 |
| C3 | Mobile 375px + panel mở = **map ẩn 100%** (rail 56 + panel clamp 319 = 375), không backdrop, không tap-outside; resize handle chỉ mouse (không touch) | MapMenu.tsx:63-65; useResizable.ts:29-43, 55-58 (maxWidth 640 cứng, không guard viewport) |
| C4 | **QuickDock desktop tràn ngang ở 641-700px**: ~13-14 icon × 40px + gaps ≈ 660-700px, wrapper shrink-wrap khiến `max-w-full` của Dock thành no-op | QuickDock.tsx:132-135 |
| C5 | **DetailPopup scroll-lock chết**: `document.body.style.overflow = "overflow-hidden"` — giá trị CSS sai (phải là `"hidden"`) | DetailPopup.tsx:36 (đã đọc tay xác nhận) |
| C6 | **Admin layout vỡ trên mobile**: `w-72 fixed` + `ml-72` không breakpoint nào → content còn 87px ở 375px | admin/layout.tsx:54,100 |
| C7 | scroll-top của dock chết ở trang inner-scroll (career, ai-chat, offline-tutor) — `window.scrollY` không bao giờ > 300 | QuickDock.tsx:41-51; career/page.tsx:160-163 |
| C8 | VoiceSearchPopup (z-100, giữa màn) đè FAB dock (z-40, bottom-left) trên mobile | VoiceSearchPopup.tsx:87; QuickDock.tsx:53 |
| C9 | 66 `min-h-screen` vs 8 `h-dvh` — cùng lớp trang dùng 2 đơn vị viewport khác nhau | grep |
| C10 | HubTabBar 8 tab cuộn ngang với scrollbar ẩn, không cue | HubTabBar.tsx:16-17 |
| C11 | 2 hệ page-frame tồn tại song song: `.page-shell` (max-w-7xl) vs `ContentShell` (full-width) | globals.css:88 vs ContentShell.tsx:4 |

**Điểm sáng (không cần sửa):** tool forms KHÔNG mắc lỗi `sm:grid-cols-2` trong
panel 380px (grep breakpoints trong tools/*.tsx → 0 hit — mọi grid đều bare);
không có gray-palette vi phạm trên /map; không có control quan trọng nào bị
`hidden X:block` giấu trên mobile.

---

## 1. Design decision (đã chọn mặc định, có phương án thay thế)

1. **"Hiện hết chứ không bị bó"** = bỏ hộp `max-h` lồng nhau → list chảy trong
   MỘT scroll container duy nhất (menuBody của panel), khởi đầu ~30 dòng + nút
   **"Hiện thêm 50"** đến khi hết (608 dòng không render DOM một lần — giữ mượt
   1 vCPU host). Phương án thay thế (nếu user muốn hẳn "phẳng" hết): render
   toàn bộ, chấp nhận DOM 608 nodes.
2. **Checkbox chuẩn**: hand-rolled `components/ui/checkbox.tsx` (16px, semantic
   tokens, Check icon lucide, focus-visible ring, `aria-checked`, disabled) —
   KHÔNG thêm dep Radix (giữ bundle gọn, khớp hiện trạng 0 Radix). Sau này cần
   switch thì thêm `switch.tsx` cùng pattern.
3. **Mobile panel (C3)**: giữ full-panel (Windy-style — panel gần full màn trên
   <1024px là hành vi chấp nhận được), ưu tiên làm nổi nút X + nút rail, KHÔNG
   thêm backdrop tối (vi phạm §25 "không lớp phủ tối trên /map"). Chỉ sửa
   clamp/resize/touch.
4. **Không đụng backend trừ 1 thay đổi additive tuỳ chọn** (limit param cho
   `/wifi/locations`) — mặc định KHÔNG làm vì pagination client-side đã giải
   quyết xong DOM; nếu host chậm khi trả 608 row thì làm sau.

---

## 2. Plan theo phase

### Phase 0 — Nền tảng control (nửa ngày)

- [ ] **T0.1** Tạo `frontend/components/ui/checkbox.tsx`:
      - props: `checked`, `onCheckedChange`, `disabled`, `label?`, `className?`
      - 16px (`h-4 w-4`), `rounded-[4px]`, border `border-border`, checked =
        `bg-primary text-primary-foreground border-primary` + lucide `Check`
        (`h-3 w-3`), focus-visible `ring-2 ring-primary/30`, disabled
        `opacity-50`
      - render `<button role="checkbox" aria-checked>` (không native input →
        không phụ thuộc forms plugin, style 100% kiểm soát)
- [ ] **T0.2** Thêm util scrollbar nhìn thấy được vào `globals.css`:
      `.scrollbar-thin` (Firefox `scrollbar-width: thin; scrollbar-color:
      hsl(var(--border)) transparent`; webkit `::-webkit-scrollbar { width: 6px
      }` + thumb `hsl(var(--border))`) — dùng cho list trong panel thay
      `scrollbar-hide`.
- [ ] **T0.3** (tuỳ chọn, cùng pattern) `components/ui/switch.tsx` — chỉ tạo nếu
      Phase 2 cần; profile div-switch chuyển sau (P2).
- ✅ Verify: `python3` balance check file mới + `node --check`-style parse
  (scripts `/tmp/balance.py`, `/tmp/unused.js` theo §29).

### Phase 1 — Panel "bó" → 1 scroll, hiện thêm dần (P0) ⭐ đúng complaint #1

- [ ] **T1.1 WifiTool** (trọng tâm):
      - Bỏ hộp `max-h-48 overflow-y-auto scrollbar-hide` (:204) → list chảy
        trong panel scroll; mỗi row giữ `space-y-1`.
      - Thêm state `visibleCount` (init 30, +50 mỗi lần), render
        `wifiLocations.slice(0, visibleCount)`, dòng cuối nút **"Hiện thêm
        (còn X địa điểm)"** full-width ghost-button; khi hết → label
        "Đã hiện tất cả N điểm".
      - Nhãn đầu list: "N điểm wifi · đang hiện M".
      - Map overlay giữ nguyên full 608 (không đổi data flow).
- [ ] **T1.2** Áp cùng pattern (bỏ `max-h-*`, thêm load-more nếu list có thể
      > ~30 dòng) cho: GreenTool:114, DonateTool:153, MarketTool:209,
      StemTool:201, SummerTool:165+183.
- [ ] **T1.3 LearningSpaceTool**: `limit: 20` → `limit: 100` (backend max,
      learning_community.rs:483); label hiển thị `spotCount/total` đúng; list
      bỏ `max-h-64` + load-more như T1.1.
- [ ] **T1.4 ClimateGuardianTool**: bỏ `.slice(0,10)`/`.slice(0,8)` âm thầm →
      hiện tất cả trong list chảy (hoặc load-more nếu > 30); giữ map vẽ full
      risk_ranking.
- [ ] **T1.5** Gọn khối stats/legend đầu WifiTool (chips wrap, bỏ hàng dọc thừa)
      — mục tiêu tiết kiệm ~40-60px cho list.
- ✅ Verify: parse + balance + unused; danh sách không còn `max-h-\d+
  overflow-y-auto` nào trong `components/map/tools/` (grep gate).
- ⛔ Không đụng: BFF routes, service types, backend.

### Phase 2 — Đồng bộ checkbox/toggle/select (P0) ⭐ đúng complaint #2

- [ ] **T2.1** "Lớp ghim" card (page.tsx ~:920): thay native checkbox 14px bằng
      `Checkbox` (T0.1); row giữ hover `bg-muted/30`, count `tabular-nums`.
- [ ] **T2.2** Chú giải ghim (page.tsx ~:1012-1019): bỏ ô vuông div + chấm tròn
      tự vẽ → dùng cùng `Checkbox` — **1 state, 1 control idiom**.
- [ ] **T2.3** Heat chips "Cụm ghim/Lớp nhiệt" (page.tsx ~:928-933): thêm
      `aria-pressed` (giữ chip pattern, dùng `bg-primary text-primary-foreground`
      / `bg-muted text-foreground` như house pattern marketplace).
- [ ] **T2.4** ToolTab toolbar (page.tsx:212-217): thêm `aria-pressed`.
- [ ] **T2.5** Thay checkbox no-op/trống bằng `Checkbox`: RoutingPanel.tsx:319,328;
      LearningSpaceTool.tsx:144,151; DonateTool.tsx:140. (GeoVision/
      SurveyPlanner/archived: sửa luôn nếu rẻ, không bắt buộc.)
- [ ] **T2.6** GreenTool status chips (:104-106): raw `bg-green-100/30
      text-green-600 border-green-600/30` → chip language chung
      (`bg-primary text-primary-foreground` active / `bg-muted text-foreground`
      inactive) + `aria-pressed`. Status màu giữ cho DATA (badge trên card),
      không giữ cho chrome filter.
- [ ] **T2.7** Chuẩn hoá select trong tools → `.form-select` (thêm size
      variant nhỏ nếu cần): LearningSpaceTool:138, MarketTool:167,
      StemTool:185.
- [ ] **T2.8** (thu gom dở) Slider LearningSpaceTool:161,168: thêm
      `accent-primary` (1 class, nhất quán với DataHunter) — không viết slider
      primitive mới.
- ✅ Verify: parse + balance + unused; grep gate: `text-primary border-border
  rounded focus:ring-primary` trong map components → 0 hit; `type="checkbox"`
  trong `app/map/page.tsx` + tools → 0 hit (đổi hết sang Checkbox).

### Phase 3 — Responsive (P1) ⭐ đúng complaint #3

- [ ] **T3.1** MapMenu.tsx:30-40 — set `--edumap-map-panel-w` từ **giá trị đã
      clamp**: `const clamped = Math.min(panelSize.width, window.innerWidth -
      railWidth - 8)` rồi mới cộng rail; đổi fallback QuickDock `4.5rem` →
      `3.5rem`; QuickDock maxWidth bọc `max(2.5rem, calc(...))` chống âm.
- [ ] **T3.2** Legend + voice card (page.tsx:1002,1026): đổi
      `right-[4.5rem]` → `right-[calc(var(--edumap-map-panel-w,3.5rem)+0.5rem)]`
      (trôi theo panel, không đè); voice card thêm
      `max-w-[calc(100vw-1.5rem)]`.
- [ ] **T3.3** useResizable.ts: thêm touch handlers (touchstart/move/end map
      về cùng logic pointer) + clamp `maxWidth` theo
      `window.innerWidth - rail - 8` lúc kéo.
- [ ] **T3.4** QuickDock desktop (QuickDock.tsx:132-135): wrapper ngoài thêm
      `max-w-[calc(100vw-1.5rem)]` (để `max-w-full` của Dock inner có tác dụng
      + `overflow-x-auto` có ý nghĩa ở dải 641-700px).
- [ ] **T3.5** DetailPopup.tsx:36: `"overflow-hidden"` → `"hidden"` (1 dòng,
      scroll-lock hoạt động lại).
- [ ] **T3.6** Admin layout mobile: `aside` `hidden md:flex`, `main`
      `md:ml-72 ml-0`; thêm nút hamburger `md:hidden` toggle drawer đơn giản
      (cùng pattern DashboardDrawer, KHÔNG fixed che trọn).
- [ ] **T3.7** VoiceSearchPopup vs dock FAB: popup lên `bottom-20 sm:bottom-6`
      (nhường FAB bottom-left) — 1 class.
- [ ] **T3.8** (Low, làm nếu còn budget) QuickDock scroll-top: đọc cả
      `document.scrollingElement` lẫn container `[data-scroll-root]` gần nhất —
      hoặc đánh dấu known-issue.
- ✅ Verify: parse + balance + unused; grep gate `overflow-hidden"` trong
  DetailPopup → 0; test tay tay resize không thể — ghi checklist smoke cho user.

### Phase 4 — Dọn dẹp nhất quán (P2, chỉ làm khi 3 phase trên xanh)

- [ ] **T4.1** `min-h-screen` → `min-h-dvh` cho các trang cùng lớp đã liệt kê
      (community, intl, leaderboard, hs-connection, career/jobs, roadmap,
      predictive, surveys, events/[id], opportunities, scholarships/[id],
      internships/[id], marketplace/*, detail pages).
- [ ] **T4.2** HubTabBar: thêm fade mask 2 mép (`mask-image` gradient) để cue
      "còn tab bên trái/phải".
- [ ] **T4.3** RoutingPanel 3 list `max-h-40/48` (dòng 394/414/521) đổi sang
      `.scrollbar-thin` (giữ max-h vì là phần tử phụ trong card).
- [ ] **T4.4** (documentation-only) Ghi `.page-shell` vs `ContentShell` vào
      §8: page-shell = trang dài cuộn dọc; ContentShell = hub full-width —
      quyết định khi gặp, không refactor hàng loạt.
- [ ] **T4.5** (tuỳ chọn) `profile/page.tsx` div-switch → `switch.tsx` nếu
      Phase 0 có T0.3.

### Phase 5 — Kiểm chứng + bàn giao

- [ ] **T5.1** Chạy bộ gate local (theo §29/§30): parse toàn bộ `.ts/.tsx`
  sửa đổi, balance ngoặc, `/tmp/unused.js`, `check_nav.py`, `python3
  /tmp/audit_final.py` (ghosts 0 — phase này không đụng route nào).
- [ ] **T5.2** Checklist smoke cho user sau deploy:
  1. `/map` → tool Wifi → danh sách chảy full panel, "Hiện thêm" mở dần 608
     điểm, scrollbar mảnh nhìn thấy.
  2. Card "Lớp ghim" + chú giải ghim: cùng 1 kiểu checkbox 16px, tick màu
     primary; bật/tắt vẫn đồng bộ 2 chỗ.
  3. Resize panel 640px → thu cửa sổ ~700px: dock không biến mất.
  4. Mobile 375px: voice card không tràn; legend không đè panel; đóng/mở panel
     bằng X + rail.
  5. Admin trên điện thoại: sidebar ẩn, content full-width, hamburger mở được.
  6. Popup chi tiết community post: nền không cuộn nữa (DetailPopup).
- [ ] **T5.3** Cập nhật AGENTS.md §30 (mục mới: FE polish pass) khi hoàn tất.

---

## 3. Thứ tự + dependency

```
Phase 0 (primitives) ──► Phase 2 (đồng bộ controls) ──┐
                    └──► Phase 1 (list un-clamp)  ────┼──► Phase 5 (verify)
                         Phase 3 (responsive)  ───────┘
                         Phase 4 (cleanup, sau cùng)
```

Phase 1 & 2 đụng chung nhiều file tools — làm Phase 0 trước để không sửa hai
lần. Phase 3 độc lập, có thể song song. Ước lượng tổng: ~2-3 ngày edit + check.
