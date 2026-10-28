# Kế hoạch khắc phục UI + Content Gap Audit — Front-end Web

> **Môi trường deploy:** Hugging Face Spaces (free CPU tier). Local chỉ để code + unit test.
> **Kiểm tra trên:** https://tancse2005-edumap.hf.space
> **Audit date:** 2026-10-28

---

## 1. Content Gap Audit — kết quả truy cập live

### API data availability

| Endpoint | Local DB | Live (HF) | Gap? |
|---|---|---|---|
| `/api/scholarships` | 11 rows | **0 items** | ❌ **Dữ liệu scholarships chưa deploy** |
| `/api/opportunities` | 11 rows | 11 items | ✅ |
| `/api/events` | 6 rows | 6 items | ✅ |
| `/api/mentors` | 0 rows | 4 items | ✅ (live có thêm) |
| `/api/map/pois` | 49 rows | 1000 items | ✅ |
| `/api/community/posts` | no table | 0 items | ✅ (intentional — AGENTS.md §6) |

### Trang chi tiết (detail pages)

| Trang | HTTP | Nội dung |
|---|---|---|
| `/scholarships/[id]` | 200 | Empty (API trả về 0 học bổng → không có detail nào để hiển thị) |
| `/events/[id]` | 200 | Có content ✅ |
| `/mentor/[id]` | 200 | Có content ✅ |
| `/opportunities/[id]` | 200 | Có content ✅ |
| `/community/post/[id]` | — | Intentional redirect → popup (được fix rồi) ✅ |

### Trang cũ redirect (MapToolRedirectPopup)

| Trang | Trạng thái |
|---|---|
| `/climate-guardian` | ✓ Có redirect popup |
| `/voice-search` | ✓ Có redirect popup |
| `/ai-agent` | ✓ Có redirect popup |
| `/wifi` | ✓ Có redirect popup |
| `/green` | ✓ Có redirect popup |
| `/talk2map` | ✓ Có redirect popup |

### Career Hub tabs

| Tab | Label | Link | Trạng thái |
|---|---|---|---|
| dashboard | Tổng quan | /career | ✅ |
| jobs | Việc làm | /career/jobs | ✅ |
| roadmap | Lộ trình | /career/roadmap | ✅ |
| predictive | Dự báo AI | /career/predictive | ✅ |
| opportunities | Cơ hội | /opportunities | ✅ |
| radar | Opportunity Radar | /opportunities/radar | ✅ |
| analytics | Thống kê | /analytics/trends | ✅ |

---

## 2. Content Gap — Chi tiết & Kế hoạch fix

### Gap 1: Scholarships API trả về 0 items (CRITICAL)

**Nguyên nhân:** Local `edumap.db` có 11 hàng scholarship (được migrate bởi `scripts/migrate_real_data.py` từ `scripts/real_vn_data.py`), nhưng phiên bản deploy lên HF Spaces chưa được cập nhật. 

**Kiểm chứng:**
```bash
# Local DB
$ python3 -c "import sqlite3; c=sqlite3.connect('frontend/public/edumap.db').cursor(); c.execute('SELECT COUNT(*) FROM scholarships'); print(c.fetchone())"
→ (11,)

# Live API
$ curl -s https://tancse2005-edumap.hf.space/api/scholarships | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('items',[])))"
→ 0
```

**Fix:**
1. Chạy `python3 scripts/migrate_real_data.py` ở local để đảm bảo DB được cập nhật với scholarships thực.
2. Commit `frontend/public/edumap.db` (được cập nhật) và deploy lại.
3. `deploy-hf.sh` sao chép frontend/public/edumap.db vào Docker image.

**Files liên quan:**
- `scripts/migrate_real_data.py` — migration script
- `scripts/real_vn_data.py` — nguồn dữ liệu scholarships (dòng 62: `SCHOLARSHIPS: list[tuple]`)
- `frontend/public/edumap.db` — SQLite database (cần commit cập nhật)

### Gap 2: Scholarship detail page không có nội dung

**Nguyên nhân:** Vì scholarships API trả về 0 → `/scholarships/[id]` sẽ luôn 404 hoặc empty. Việc fix Gap 1 sẽ giải quyết vấn đề này.

**Fix:** Tùy chọn — cải thiện empty state trên scholarship detail page để hiển thị thông báo rõ ràng thay vì lỗi.

### Gap 3: Community posts trống (intentional nhưng UX có thể tốt hơn)

**Nguyên nhân:** Theo AGENTS.md §6, posts/surveys/mentors là intentional empty — "Honest empty states beat fake rows."

**Tuy nhiên**, empty state hiện tại chưa khuyến khích engagement đủ mạnh:
- Sidebar trending tags: "Chưa có xu hưỡng."
- Sidebar groups: "Chưa có nhóm nào"
- Posts feed: "Chưa có bài viết nào."

**Fix (UX improve — không thay đổi data policy):**
1. Cập nhật empty state trên community page để thêm CTA đăng nhập + đăng bài.
2. Thêm thông tin "Cộng đồng đang được xây dựng — hãy là người đầu tiên chia sẻ!" với nút "Đăng bài".

### Gap 4: Career dashboard stats (401 — auth required)

**Nguyên nhân:** `/api/dashboard/stats` trả về 401 khi chưa đăng nhập. Đây là intentional (cần auth), nhưng trang dashboard cần UX rõ ràng khi user chưa login.

**Fix (UX improve):**
1. Career dashboard page nên có placeholder khi chưa login: "Đăng nhập để xem thống kê cá nhân."
2. Career jobs page nên có nút "Đăng nhập để ứng tuyển" thay vì để người dùng bỏ qua.

### Gap 5: Scholarship detail / scholarship [id] page — missing provenance

**Nguyên nhân:** Khi scholarship data có sẵn (sau fix Gap 1), detail page cần hiển thị `apply_url` (official link) và provenance (AGENTS.md §6: "Every description ends with Nguồn chính thức: <url> · Kiểm chứng: <date>").

**Fix:** Cập nhật ScholarshipDetailPage (nếu tồn tại) để hiển thị apply_url + provenance.

---

## 3. Kế hoạch thực hiện (priority order)

### Priority A — Data fix (blocker cho scholarships)

```bash
# 1. Re-run migration locally
cd /home/ngoctan/Downloads/EduMap
python3 scripts/migrate_real_data.py

# 2. Verify DB has scholarships
python3 -c "import sqlite3; c=sqlite3.connect('frontend/public/edumap.db').cursor(); c.execute('SELECT COUNT(*) FROM scholarships'); print(c.fetchone())"
# Expected: (≥5,)

# 3. Commit updated edumap.db
git add frontend/public/edumap.db
git commit -m "fix: deploy real scholarship data to HF Spaces"

# 4. User deploy: HF_TOKEN=<token> ./deploy-hf.sh
# 5. Verify: curl -s https://tancse2005-edumap.hf.space/api/scholarships | jq '.data.items | length'
```

### Priority B — Content empty state cải thiện

| File | Thay đổi |
|---|---|
| `app/community/page.tsx` | Cải thiện empty state: thêm CTA đăng nhập + đăng bài, messaging "cộng đồng đang phát triển" |
| `app/scholarships/page.tsx` | Cải thiện empty state khi API trả về 0: thông báo "Chưa có học bổng nào — dữ liệu đang được cập nhật" |
| `app/career/page.tsx` | Thêm placeholder khi chưa login: "Đăng nhập để xem thống kê" |

### Priority C — Provenance display (scholarships)

| File | Thay đổi |
|---|---|
| `app/scholarships/page.tsx` (DetailPopup) | Thêm `apply_url` link "Nguồn chính thức" + provenance footer |

---

## 4. Kết quả audit UI (Phase 1–4 đã hoàn thành)

Xem phần "Kết quả" ở dưới — tất cả UI fixes đã hoàn thành và verify bằng `npx tsc --noEmit` (0 lỗi) + `npm run build` (exit 0).

---

## 5. Verify checklist

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npm run build` — exit code 0
- [ ] `python3 scripts/migrate_real_data.py` — chạy để sync scholarship data
- [ ] Commit + deploy HF Spaces
- [ ] `curl -s https://tancse2005-edumap.hf.space/api/scholarships | jq '.data.items | length'` — >0
- [ ] Kiểm tra visual: popup sizing, sidebar button alignment, tab bar, detail popups trên live site

---

## 6. UI Fixes đã hoàn thành (tóm tắt)

| Phase | Task | Status |
|---|---|---|
| 1.1 | Standardize max-width: 1152px → 1280px (`.page-shell`, `ContentShell`, `features`) | ✅ |
| 1.2 | Sync Sidebar width: 272px → 240px, CSS var `--sidebar-width` | ✅ |
| 2.1 | `MapPopupContent` component: popup 720px → 420px, text `text-[9-11px]` → `text-xs`/`text-sm` | ✅ |
| 2.2 | 3 modal popups: `max-w-md` → `max-w-lg` + `max-h-[80vh]`, fix VoiceSearchPopup CSS template literal bug | ✅ |
| 2.3 | RoutingPanel: thêm resize handle, tab bar `flex-wrap` → `flex-nowrap` | ✅ |
| 3.1 | `DetailPopup` component: overlay right-slide, ESC close, scroll lock | ✅ |
| 3.2 | 5 trang list (scholarships, opportunities, community, events, mentor) → click card mở popup thay vì navigate | ✅ |
| 4.1 | `useDraggable`: thêm BUTTON + `[role="button"]` guard | ✅ |
| 4.2 | Text scale audit: tất cả `text-[9-11px]` → `text-xs`/`text-sm` trong map page | ✅ |
| 4.3 | `npx tsc --noEmit` ✅ + `npm run build` ✅ | ✅ |

---

## 7. Files thay đổi

| File | Thay đổi |
|---|---|
| `frontend/app/globals.css` | `.page-shell` max-w, `.map-popup` CSS, sidebar width vars |
| `frontend/components/ui/ContentShell.tsx` | Thêm `max-w-7xl mx-auto` |
| `frontend/src/lib/layout-constants.ts` | **NEW** — sidebar width constants + CSS var helpers |
| `frontend/components/Sidebar.tsx` | Resize handle, CSS var sync, use constants |
| `frontend/app/map/page.tsx` | Sync sidebar 272→240, popup button → CSS var, tab bar fix, pin modal width, text scale, remove dead state |
| `frontend/components/ui/MapComponent.tsx` | Replace 2 popup divs → `MapPopupContent` |
| `frontend/components/ui/MapPopupContent.tsx` | **NEW** — unified popup content component |
| `frontend/components/ui/VoiceSearchPopup.tsx` | Fix CSS template literal bug, width + max-height |
| `frontend/components/ui/MapToolRedirectPopup.tsx` | Width + max-height |
| `frontend/components/ui/FeaturedPinPopup.tsx` | Width + max-height |
| `frontend/components/map/RoutingPanel.tsx` | Resize handle, dynamic width |
| `frontend/app/scholarships/page.tsx` | Card click → DetailPopup (thay router.push) |
| `frontend/app/opportunities/page.tsx` | Card click → DetailPopup (thay `<Link>`) |
| `frontend/app/community/page.tsx` | Post click → DetailPopup (thay `<Link>`) |
| `frontend/app/events/page.tsx` | Card click → DetailPopup (thay `<Link>`) |
| `frontend/app/mentor/page.tsx` | Card click → DetailPopup (thay `<Link>`) |
| `frontend/src/hooks/useDraggable.ts` | Guard buttons from starting drag |
| `tasks/ui-remediation-plan.md` | **NEW** — full analysis + plan |
