# Constraints

Last reviewed: 2026-11-17 by EduMap audit pass.

## Floor (always enforced, no setup required)

- No new suppression comments: `@ts-ignore`, `eslint-disable`, `# noqa`,
  `# type: ignore`, `//nolint`, `#[allow(...)]` without a reason.
- No unimplemented stubs: `throw new Error("Not implemented")`, `pass`,
  empty `catch {}`, `return None` từ một hàm chưa viết.
- No skipped or deleted tests without a reason in the commit message.
- No secrets in source (API keys, JWT secret, DB password).
- This file does not get weakened to make a change pass.
- **Không được xóa route/backend/ai-service endpoint chỉ vì nó "dead" trong
  audit.** Endpoint chết nhưng là một tính năng có thể bật lại sau này phải
  giữ. Xóa chỉ khi chứng minh được: (a) không có FE/service/page nào gọi,
  (b) không có BFF page nào trỏ tới, (c) không làрезерv cho tính năng đã ghi
  trong `feature-catalog.ts` hoặc `AGENTS.md`.
- **Mỗi khi thêm/xóa route, phải chạy lại audit script và ghosts phải bằng 0.**

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
|-----------|------|-----------|---------|
| Types (FE) | Zero type errors | `npx tsc --noEmit` (frontend) | every edit |
| Python syntax | Zero compile errors | `python3 -m py_compile` + `pytest ai-service/tests -q` | every Python edit |
| API surface | Ghost routes = 0 | `python3 /tmp/audit_final.py` (ghosts_be=0, ghosts_ai=0) | every route change |
| Arithmetic | live + dead = total | same script (`⊆ True`) | every route change |
| Secrets | Zero findings | `grep -rn "API_KEY\|JWT_SECRET\|DB_PASSWORD" frontend backend ai-service --include=*.ts --include=*.rs --include=*.py` | task end |

Every row names the command that produces the verdict. A dimension with a
number and no command in this column is an aspiration, not a constraint.

## Measured, not yet enforced

| Metric | Today | Direction |
|--------|-------|-----------|
| Backend Rust routes | 243 (153 live, 90 dead) | dead must not grow without reason |
| Ai-service endpoints | 72 (16 live, 56 dead) | dead must not grow without reason |
| BFF pages | 160 | must not exceed live backend routes + catch-all |
| Ghost routes | 0 | must stay 0 |

## Route naming convention (enforced)

- Rust axum route paths use `{param}`, **never** `:param`. Axum panics at
  startup on `:param`.
- `/api/ai/{*rest}` is the single catch-all into the FastAPI ai-service. Every
  other `/api/ai/*` path answered by ai-service itself must be registered in
  `ai-service/routers/*.py` with the matching `prefix`, otherwise it is a
  ghost and the BFF gets a 404.
- BFF `frontend/app/api/<path>/route.ts` must proxy to a backend path that
  exists in `backend/src/router.rs`. A mismatch is a ghost.

## Exceptions

None.