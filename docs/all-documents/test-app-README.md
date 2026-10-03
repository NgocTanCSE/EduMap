# EduMap Test App (Giả ứng dụng để test tính năng)

Mock application for testing EduMap frontend features **locally** without requiring
the full Docker/Hugging Face stack (NestJS backend, AI service, PostgreSQL, Redis,
MinIO).

> ⚠️ **This is a development-only mock.** It is **NOT** used in the Docker or
> Hugging Face Spaces deployment. The production deployment always uses the real
> NestJS backend (`backend/`) and AI service (`ai-service/`).

## What It Provides

| Feature | Mock Source |
|---------|-------------|
| Map POIs (schools, libraries, wifi, parks) | `mock-data/schools.ts` |
| Auth (login, register, profile) | `mock-data/auth.ts` |
| Career paths & jobs | `mock-data/career.ts` |
| AI chatbot responses | `mock-data/ai-chat.ts` |
| Gamification & leaderboard | `mock-data/gamification.ts` |
| Library & learning materials | `mock-data/library.ts` |

## How to Use

### Option A: Mock via Next.js middleware (recommended for local dev)

1. Set `NEXT_PUBLIC_USE_MOCK=true` in `.env.local`:
   ```bash
   echo "NEXT_PUBLIC_USE_MOCK=true" >> .env.local
   ```
2. The `middleware.ts` intercepts `/api/*` calls and returns mock data when
   the backend is unavailable.
3. Run `npm run dev` as usual.

### Option B: Standalone mock server

```bash
cd frontend/test-app
npm install
node mock-server.js
# Mock server runs on http://localhost:9001
```

Then point `NEXT_PUBLIC_API_URL` to `http://localhost:9001/api`.

## Running Tests

```bash
cd frontend/test-app
npm test
# Runs the mock-app test suite to validate mock data and handlers
```

## File Structure

```
test-app/
├── README.md           ← This file
├── mock-server.ts      ← Main mock server with route handlers
├── mock-middleware.ts  ← Next.js middleware integration
├── tsconfig.json       ← TypeScript config for mock app
├── package.json        ← Mock app dependencies
├── __tests__/          ← Unit tests for mock handlers
└── mock-data/          ← Mock data fixtures
    ├── schools.ts
    ├── auth.ts
    ├── career.ts
    ├── ai-chat.ts
    ├── gamification.ts
    └── library.ts
```
