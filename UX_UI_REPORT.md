# UX/UI Report — EduMap

> Phạm vi: phân tích tĩnh (grep, kích thước file) các trang frontend (`frontend/app`). Môi trường runtime: Hugging Face Spaces free plan; local chỉ đọc code. Không chạy server, không deploy.
> Git HEAD: f22180e. Ngày: 2026-11-06.

## 0. Tổng quan

- Tổng số `page.tsx`: 76
- Shared UI conventions (AGENTS.md §8): ContentShell, SectionHeader, SearchInput, EmptyState, card-surface.

### 1. Mức độ áp dụng convention

| Convention | Số trang sử dụng |
|---|---:|
| ContentShell | 12 / 76 |
| EmptyState | 13 / 76 |
| SectionHeader | 16 / 76 |
| SearchInput | 8 / 76 |
| p-8 (legacy) | 40 / 76 |
| max-w-7xl (legacy) | 10 / 76 |

## 2. Bảng kiểm kê từng file (76 page.tsx)

| # | File | Lines | CS | ES | SH | SI | p-8 | MW7 |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | `app/admin/analytics/heatmap/page.tsx` | 134 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | `app/admin/dashboard/page.tsx` | 165 | 0 | 0 | 0 | 0 | 4 | 1 |
| 3 | `app/admin/data-quality/page.tsx` | 453 | 0 | 0 | 0 | 0 | 1 | 1 |
| 4 | `app/admin/question-gaps/page.tsx` | 364 | 0 | 0 | 0 | 0 | 2 | 1 |
| 5 | `app/admin/reports/page.tsx` | 130 | 0 | 0 | 0 | 0 | 0 | 1 |
| 6 | `app/admin/roles/page.tsx` | 64 | 0 | 0 | 0 | 0 | 2 | 0 |
| 7 | `app/admin/users/page.tsx` | 213 | 0 | 0 | 0 | 0 | 0 | 1 |
| 8 | `app/ai-agent/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 9 | `app/ai-chat/page.tsx` | 499 | 0 | 0 | 0 | 0 | 0 | 0 |
| 10 | `app/analytics/page.tsx` | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| 11 | `app/analytics/trends/page.tsx` | 1314 | 0 | 0 | 3 | 0 | 0 | 0 |
| 12 | `app/auth/forgot-password/page.tsx` | 109 | 0 | 0 | 0 | 0 | 2 | 0 |
| 13 | `app/auth/login/page.tsx` | 451 | 0 | 0 | 0 | 0 | 0 | 0 |
| 14 | `app/auth/page.tsx` | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| 15 | `app/auth/register/page.tsx` | 22 | 0 | 0 | 0 | 0 | 0 | 0 |
| 16 | `app/career/jobs/[id]/page.tsx` | 255 | 0 | 0 | 0 | 0 | 8 | 0 |
| 17 | `app/career/jobs/page.tsx` | 150 | 0 | 0 | 0 | 0 | 0 | 0 |
| 18 | `app/career/page.tsx` | 218 | 0 | 0 | 0 | 0 | 2 | 0 |
| 19 | `app/career/predictive/page.tsx` | 208 | 0 | 0 | 0 | 0 | 5 | 0 |
| 20 | `app/career/profile/page.tsx` | 312 | 0 | 4 | 3 | 0 | 0 | 0 |
| 21 | `app/career/roadmap/page.tsx` | 169 | 0 | 0 | 0 | 0 | 7 | 0 |
| 22 | `app/certificates/verify/[code]/page.tsx` | 123 | 0 | 0 | 0 | 0 | 1 | 0 |
| 23 | `app/climate-guardian/page.tsx` | 25 | 0 | 0 | 0 | 0 | 0 | 0 |
| 24 | `app/community/page.tsx` | 497 | 0 | 0 | 0 | 3 | 2 | 0 |
| 25 | `app/community/post/[id]/page.tsx` | 230 | 0 | 0 | 0 | 0 | 3 | 0 |
| 26 | `app/dashboard/impact/page.tsx` | 559 | 0 | 0 | 0 | 0 | 0 | 0 |
| 27 | `app/dashboard/page.tsx` | 452 | 0 | 0 | 0 | 0 | 3 | 0 |
| 28 | `app/donate/campaign/[id]/page.tsx` | 273 | 0 | 0 | 0 | 0 | 2 | 0 |
| 29 | `app/donate/page.tsx` | 110 | 4 | 3 | 3 | 2 | 0 | 0 |
| 30 | `app/events/[id]/page.tsx` | 280 | 0 | 0 | 0 | 0 | 6 | 0 |
| 31 | `app/events/create/page.tsx` | 312 | 4 | 0 | 3 | 0 | 0 | 0 |
| 32 | `app/events/page.tsx` | 220 | 4 | 3 | 3 | 3 | 0 | 0 |
| 33 | `app/features/page.tsx` | 216 | 0 | 3 | 3 | 0 | 1 | 0 |
| 34 | `app/green/page.tsx` | 217 | 4 | 4 | 3 | 3 | 1 | 0 |
| 35 | `app/hackathon/[id]/page.tsx` | 321 | 0 | 0 | 0 | 0 | 6 | 0 |
| 36 | `app/hackathon/page.tsx` | 152 | 4 | 3 | 3 | 3 | 1 | 0 |
| 37 | `app/hs-connection/page.tsx` | 220 | 0 | 0 | 0 | 0 | 2 | 0 |
| 38 | `app/impact-match/page.tsx` | 670 | 4 | 6 | 3 | 0 | 1 | 0 |
| 39 | `app/internships/[id]/page.tsx` | 278 | 0 | 0 | 0 | 0 | 7 | 0 |
| 40 | `app/internships/page.tsx` | 176 | 4 | 3 | 3 | 3 | 0 | 0 |
| 41 | `app/intl/page.tsx` | 408 | 0 | 0 | 0 | 0 | 1 | 0 |
| 42 | `app/knowledge-graph/page.tsx` | 328 | 4 | 0 | 3 | 0 | 0 | 0 |
| 43 | `app/language-bridge/page.tsx` | 716 | 0 | 0 | 0 | 0 | 0 | 0 |
| 44 | `app/leaderboard/page.tsx` | 275 | 0 | 0 | 0 | 0 | 4 | 0 |
| 45 | `app/learning-spaces/page.tsx` | 435 | 0 | 0 | 0 | 0 | 0 | 1 |
| 46 | `app/library/page.tsx` | 308 | 0 | 3 | 3 | 0 | 0 | 0 |
| 47 | `app/map/data-hunter/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 48 | `app/map/gap-predictor/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 49 | `app/map/geo-vision/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 50 | `app/map/page.tsx` | 1315 | 0 | 0 | 0 | 0 | 0 | 0 |
| 51 | `app/map/resource-optimizer/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 52 | `app/map/survey-planner/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 53 | `app/marketplace/cart/page.tsx` | 441 | 0 | 0 | 0 | 0 | 7 | 1 |
| 54 | `app/marketplace/page.tsx` | 353 | 0 | 0 | 0 | 0 | 3 | 0 |
| 55 | `app/marketplace/products/page.tsx` | 362 | 0 | 0 | 0 | 0 | 2 | 1 |
| 56 | `app/marketplace/services/page.tsx` | 356 | 0 | 0 | 0 | 0 | 2 | 1 |
| 57 | `app/mentor/[id]/page.tsx` | 200 | 0 | 0 | 0 | 0 | 8 | 0 |
| 58 | `app/mentor/call/page.tsx` | 310 | 0 | 0 | 0 | 0 | 0 | 0 |
| 59 | `app/mentor/page.tsx` | 328 | 0 | 0 | 0 | 0 | 2 | 0 |
| 60 | `app/offline-tutor/page.tsx` | 532 | 0 | 0 | 0 | 0 | 1 | 0 |
| 61 | `app/opportunities/[id]/page.tsx` | 180 | 0 | 0 | 0 | 0 | 4 | 0 |
| 62 | `app/opportunities/page.tsx` | 215 | 0 | 0 | 0 | 0 | 0 | 0 |
| 63 | `app/opportunities/radar/page.tsx` | 414 | 4 | 3 | 3 | 0 | 0 | 0 |
| 64 | `app/page.tsx` | 40 | 0 | 0 | 0 | 0 | 0 | 0 |
| 65 | `app/profile/page.tsx` | 666 | 0 | 0 | 0 | 0 | 5 | 1 |
| 66 | `app/resource-exchange/page.tsx` | 1006 | 4 | 6 | 3 | 0 | 0 | 0 |
| 67 | `app/scholarships/[id]/page.tsx` | 407 | 0 | 0 | 0 | 0 | 6 | 0 |
| 68 | `app/scholarships/page.tsx` | 516 | 4 | 3 | 3 | 3 | 1 | 0 |
| 69 | `app/stem/page.tsx` | 298 | 0 | 0 | 0 | 0 | 2 | 0 |
| 70 | `app/summer/page.tsx` | 260 | 0 | 0 | 0 | 0 | 2 | 0 |
| 71 | `app/surveys/[id]/page.tsx` | 176 | 0 | 0 | 0 | 0 | 4 | 0 |
| 72 | `app/surveys/page.tsx` | 89 | 0 | 0 | 0 | 0 | 0 | 0 |
| 73 | `app/talk2map/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 74 | `app/voice-search/page.tsx` | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| 75 | `app/volunteer/page.tsx` | 270 | 0 | 0 | 0 | 0 | 5 | 0 |
| 76 | `app/wifi/page.tsx` | 242 | 4 | 4 | 3 | 3 | 1 | 0 |

## 3. Trang quá lớn (>400 dòng)

- `app/map/page.tsx` — 1315 dòng
- `app/analytics/trends/page.tsx` — 1314 dòng
- `app/resource-exchange/page.tsx` — 1006 dòng
- `app/language-bridge/page.tsx` — 716 dòng
- `app/impact-match/page.tsx` — 670 dòng
- `app/profile/page.tsx` — 666 dòng
- `app/dashboard/impact/page.tsx` — 559 dòng
- `app/offline-tutor/page.tsx` — 532 dòng
- `app/scholarships/page.tsx` — 516 dòng
- `app/ai-chat/page.tsx` — 499 dòng
- `app/community/page.tsx` — 497 dòng
- `app/admin/data-quality/page.tsx` — 453 dòng
- `app/dashboard/page.tsx` — 452 dòng
- `app/auth/login/page.tsx` — 451 dòng
- `app/marketplace/cart/page.tsx` — 441 dòng
- `app/learning-spaces/page.tsx` — 435 dòng
- `app/opportunities/radar/page.tsx` — 414 dòng
- `app/intl/page.tsx` — 408 dòng
- `app/scholarships/[id]/page.tsx` — 407 dòng

## 4. Trang redirect / popup (không phải trang nội dung)

- `app/ai-agent/page.tsx`
- `app/analytics/page.tsx`
- `app/auth/page.tsx`
- `app/climate-guardian/page.tsx`
- `app/map/data-hunter/page.tsx`
- `app/map/gap-predictor/page.tsx`
- `app/map/geo-vision/page.tsx`
- `app/map/resource-optimizer/page.tsx`
- `app/map/survey-planner/page.tsx`
- `app/talk2map/page.tsx`
- `app/voice-search/page.tsx`

## 5. Trạng thái theo từng tính năng (feature catalog)
| ID | Label | Href | File trang chính | Lines | Flags |
|---|---|---|---|---:|---|
| map | Bản đồ | `/map` | `app/map/page.tsx` | 1315 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| dashboard | Bảng điều khiển | `/dashboard` | `app/dashboard/page.tsx` | 452 | CS=0 ES=0 SH=0 SI=0 p8=3 |
| features | Tất cả tính năng | `/features` | `app/features/page.tsx` | 216 | CS=0 ES=3 SH=3 SI=0 p8=1 |
| ai-chat | Trợ lý AI | `/ai-chat` | `app/ai-chat/page.tsx` | 499 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| ai-agent | AI Agent bản đồ | `/map?tool=ai-agent` | `app/map/page.tsx` | 1315 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| talk2map | Talk2Map | `/map` | `app/map/page.tsx` | 1315 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| voice-search | Tìm bằng giọng nói | `/map?tool=voice-search` | `app/map/page.tsx` | 1315 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| language-bridge | Language Bridge AI | `/language-bridge` | `app/language-bridge/page.tsx` | 716 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| offline-tutor | Trợ lý ngoại tuyến | `/offline-tutor` | `app/offline-tutor/page.tsx` | 532 | CS=0 ES=0 SH=0 SI=0 p8=1 |
| knowledge-graph | Đồ thị tri thức AI | `/knowledge-graph` | `app/knowledge-graph/page.tsx` | 328 | CS=4 ES=0 SH=3 SI=0 p8=0 |
| library | Thư viện | `/library` | `app/library/page.tsx` | 308 | CS=0 ES=3 SH=3 SI=0 p8=0 |
| scholarships | Học bổng | `/scholarships` | `app/scholarships/page.tsx` | 516 | CS=4 ES=3 SH=3 SI=3 p8=1 |
| intl | Du học & Trao đổi | `/intl` | `app/intl/page.tsx` | 408 | CS=0 ES=0 SH=0 SI=0 p8=1 |
| stem | STEM Labs | `/stem` | `app/stem/page.tsx` | 298 | CS=0 ES=0 SH=0 SI=0 p8=2 |
| learning-spaces | Không gian học tập | `/learning-spaces` | `app/learning-spaces/page.tsx` | 435 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| career | Nghề nghiệp | `/career` | `app/career/page.tsx` | 218 | CS=0 ES=0 SH=0 SI=0 p8=2 |
| career-roadmap | Lộ trình nghề | `/career/roadmap` | `app/career/roadmap/page.tsx` | 169 | CS=0 ES=0 SH=0 SI=0 p8=7 |
| career-jobs | Việc làm | `/career/jobs` | `app/career/jobs/page.tsx` | 150 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| career-predictive | Dự báo nghề nghiệp | `/career/predictive` | `app/career/predictive/page.tsx` | 208 | CS=0 ES=0 SH=0 SI=0 p8=5 |
| internships | Thực tập | `/internships` | `app/internships/page.tsx` | 176 | CS=4 ES=3 SH=3 SI=3 p8=0 |
| opportunities | Cơ hội | `/opportunities` | `app/opportunities/page.tsx` | 215 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| opportunity-radar | Opportunity Radar | `/opportunities/radar` | `app/opportunities/radar/page.tsx` | 414 | CS=4 ES=3 SH=3 SI=0 p8=0 |
| analytics | Xu hướng thị trường | `/analytics/trends` | `app/analytics/trends/page.tsx` | 1314 | CS=0 ES=0 SH=3 SI=0 p8=0 |
| mentor | Cố vấn | `/mentor` | `app/mentor/page.tsx` | 328 | CS=0 ES=0 SH=0 SI=0 p8=2 |
| community | Cộng đồng | `/community` | `app/community/page.tsx` | 497 | CS=0 ES=0 SH=0 SI=3 p8=2 |
| hs-connection | Kết nối THPT | `/hs-connection` | `app/hs-connection/page.tsx` | 220 | CS=0 ES=0 SH=0 SI=0 p8=2 |
| events | Sự kiện | `/events` | `app/events/page.tsx` | 220 | CS=4 ES=3 SH=3 SI=3 p8=0 |
| hackathon | Hackathon | `/hackathon` | `app/hackathon/page.tsx` | 152 | CS=4 ES=3 SH=3 SI=3 p8=1 |
| leaderboard | Bảng xếp hạng | `/leaderboard` | `app/leaderboard/page.tsx` | 275 | CS=0 ES=0 SH=0 SI=0 p8=4 |
| green | Thử thách xanh | `/green` | `app/green/page.tsx` | 217 | CS=4 ES=4 SH=3 SI=3 p8=1 |
| summer | Mùa hè xanh | `/summer` | `app/summer/page.tsx` | 260 | CS=0 ES=0 SH=0 SI=0 p8=2 |
| wifi | Trạm Wifi | `/wifi` | `app/wifi/page.tsx` | 242 | CS=4 ES=4 SH=3 SI=3 p8=1 |
| surveys | Khảo sát | `/surveys` | `app/surveys/page.tsx` | 89 | CS=0 ES=0 SH=0 SI=0 p8=0 |
| volunteer | Tình nguyện | `/volunteer` | `app/volunteer/page.tsx` | 270 | CS=0 ES=0 SH=0 SI=0 p8=5 |
| marketplace | Chợ trao đổi | `/marketplace` | `app/marketplace/page.tsx` | 353 | CS=0 ES=0 SH=0 SI=0 p8=3 |
| donate | Quyên góp | `/donate` | `app/donate/page.tsx` | 110 | CS=4 ES=3 SH=3 SI=2 p8=0 |
| impact-match | ImpactMatch | `/impact-match` | `app/impact-match/page.tsx` | 670 | CS=4 ES=6 SH=3 SI=0 p8=1 |
| resource-exchange | Resource Exchange AI | `/resource-exchange` | `app/resource-exchange/page.tsx` | 1006 | CS=4 ES=6 SH=3 SI=0 p8=0 |
| impact-measurement | Đo lường Tác động AI | `/dashboard/impact` | `app/dashboard/impact/page.tsx` | 559 | CS=0 ES=0 SH=0 SI=0 p8=0 |

## 6. Map Hub tools (10) — `components/map/tools/`
- `components/map/tools/AiAgentTool.tsx` — 376 dòng
- `components/map/tools/ClimateGuardianTool.tsx` — 515 dòng
- `components/map/tools/DataHunterTool.tsx` — 424 dòng
- `components/map/tools/GapPredictorTool.tsx` — 409 dòng
- `components/map/tools/GeoVisionTool.tsx` — 405 dòng
- `components/map/tools/GreenTool.tsx` — 309 dòng
- `components/map/tools/ResourceOptimizerTool.tsx` — 385 dòng
- `components/map/tools/SurveyPlannerTool.tsx` — 467 dòng
- `components/map/tools/VoiceSearchTool.tsx` — 285 dòng
- `components/map/tools/WifiTool.tsx` — 387 dòng
- `components/map/tools/registry.tsx` — 194 dòng

## 7. Shared components (`components/`) — tổng quan
- Tổng số file component: 80
  - `career/`: 1 file
  - `dashboard/`: 5 file
  - `home/`: 1 file
  - `knowledge/`: 1 file
  - `landing/`: 2 file
  - `map/`: 16 file
  - `marketplace/`: 1 file
  - `root/`: 2 file
  - `ui/`: 51 file

### 7.1 Components lớn (>300 dòng)
- `components/Sidebar.tsx` — 406 dòng
- `components/landing/EduMapLanding.tsx` — 1065 dòng
- `components/map/PinTheme.tsx` — 317 dòng
- `components/map/RoutingPanel.tsx` — 709 dòng
- `components/map/tools/AiAgentTool.tsx` — 376 dòng
- `components/map/tools/ClimateGuardianTool.tsx` — 515 dòng
- `components/map/tools/DataHunterTool.tsx` — 424 dòng
- `components/map/tools/GapPredictorTool.tsx` — 409 dòng
- `components/map/tools/GeoVisionTool.tsx` — 405 dòng
- `components/map/tools/GreenTool.tsx` — 309 dòng
- `components/map/tools/ResourceOptimizerTool.tsx` — 385 dòng
- `components/map/tools/SurveyPlannerTool.tsx` — 467 dòng
- `components/map/tools/WifiTool.tsx` — 387 dòng
- `components/ui/MapComponent.tsx` — 964 dòng

## 8. Trang còn dùng `p-8` (legacy padding)
- `app/admin/dashboard/page.tsx`
- `app/admin/data-quality/page.tsx`
- `app/admin/question-gaps/page.tsx`
- `app/admin/roles/page.tsx`
- `app/auth/forgot-password/page.tsx`
- `app/career/jobs/[id]/page.tsx`
- `app/career/page.tsx`
- `app/career/predictive/page.tsx`
- `app/career/roadmap/page.tsx`
- `app/certificates/verify/[code]/page.tsx`
- `app/community/page.tsx`
- `app/community/post/[id]/page.tsx`
- `app/dashboard/page.tsx`
- `app/donate/campaign/[id]/page.tsx`
- `app/events/[id]/page.tsx`
- `app/features/page.tsx`
- `app/green/page.tsx`
- `app/hackathon/[id]/page.tsx`
- `app/hackathon/page.tsx`
- `app/hs-connection/page.tsx`
- `app/impact-match/page.tsx`
- `app/internships/[id]/page.tsx`
- `app/intl/page.tsx`
- `app/leaderboard/page.tsx`
- `app/marketplace/cart/page.tsx`
- `app/marketplace/page.tsx`
- `app/marketplace/products/page.tsx`
- `app/marketplace/services/page.tsx`
- `app/mentor/[id]/page.tsx`
- `app/mentor/page.tsx`
- `app/offline-tutor/page.tsx`
- `app/opportunities/[id]/page.tsx`
- `app/profile/page.tsx`
- `app/scholarships/[id]/page.tsx`
- `app/scholarships/page.tsx`
- `app/stem/page.tsx`
- `app/summer/page.tsx`
- `app/surveys/[id]/page.tsx`
- `app/volunteer/page.tsx`
- `app/wifi/page.tsx`

## 9. Trang còn dùng `max-w-7xl` (legacy width cap)
- `app/admin/dashboard/page.tsx`
- `app/admin/data-quality/page.tsx`
- `app/admin/question-gaps/page.tsx`
- `app/admin/reports/page.tsx`
- `app/admin/users/page.tsx`
- `app/learning-spaces/page.tsx`
- `app/marketplace/cart/page.tsx`
- `app/marketplace/products/page.tsx`
- `app/marketplace/services/page.tsx`
- `app/profile/page.tsx`

## 10. Trang dùng ContentShell (đã theo convention)
- `app/donate/page.tsx`
- `app/events/create/page.tsx`
- `app/events/page.tsx`
- `app/green/page.tsx`
- `app/hackathon/page.tsx`
- `app/impact-match/page.tsx`
- `app/internships/page.tsx`
- `app/knowledge-graph/page.tsx`
- `app/opportunities/radar/page.tsx`
- `app/resource-exchange/page.tsx`
- `app/scholarships/page.tsx`
- `app/wifi/page.tsx`
