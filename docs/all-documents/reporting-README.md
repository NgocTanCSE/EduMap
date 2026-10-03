# EduMap Reporting Interface (Phần giao diện để báo cáo)

This directory contains the **reporting and analytics interface** for the EduMap platform,
including admin dashboards, analytics charts, leaderboards, and data reports.

## What's Here

| Sub-folder | Contents |
|------------|----------|
| `services/` | API service clients for reporting endpoints (admin, analytics, dashboard, gamification, notifications) |
| `components/` | Reusable reporting UI components (charts, stat cards, data tables) |
| `types/` | TypeScript types specific to reporting & analytics |
| `lib/` | Reporting utilities (data formatting, export helpers) |

## Pages (in `../app/`)

The actual page components live in `frontend/app/` (Next.js App Router requires
this structure for routing). Pages that belong to the reporting interface include:

- `app/admin/*` — Admin dashboard (users, roles, reports, analytics heatmap)
- `app/analytics/*` — Analytics & trend pages
- `app/dashboard/*` — User dashboard overview
- `app/leaderboard/*` — Gamification leaderboard
- `app/notifications/*` — Notification reports

These pages import services from `frontend/reporting/services/`.

## Import Paths

```typescript
// Old (before restructure)
import { adminService } from '@/reporting/services/admin.service';

// New (after restructure)
import { adminService } from '@/reporting/services/admin.service';
```
