# 📋 Kế hoạch Migrate EduMap → 1 HF Space (2 vCPU, 16GB RAM, 1GB disk, port 7680)

> **✅ AI service giữ nguyên** — chỉ gọi external API, không tải model lên → CPU/RAM nhỏ

---

## 🏗️ Kiến trúc (cập nhật — giữ nguyên AI service)

```
HF Space (port 7680)
│
├─ supervisord (process manager)
│   ├─ Next.js Frontend + BFF (7680) ← PUBLIC PORT ✅
│   ├─ NestJS Backend (3000) ← localhost
│   └─ Python FastAPI AI (8000) ← localhost (thin proxy → external APIs)
│
├─ SQLite (in-process, ~5MB) → thay thế PostgreSQL 16
├─ LRU cache (in-process) → thay thế Redis
├─ OpenRouteService API → thay thế OSRM
└─ FileSystem (/tmp) hoặc Supabase → thay thế MinIO
```

---

## 📊 Tài nguyên (2 vCPU, 16GB RAM, 1GB disk)

| Service | Processes | CPU | RAM | Disk |
|---|---|---|---|---|
| Next.js (FE + BFF) | 1 | 0.5-1 vCPU | 500MB | 200MB |
| NestJS (Backend) | 1 | 0.5 vCPU | 500MB | 150MB |
| **FastAPI AI** | 1 | **0.1 vCPU** (thin proxy) | **100MB** | 5MB |
| **Tổng cộng** | **3** | ~2 vCPU | **~1.1GB** | **~360MB** ✅ |

> **AI service chỉ là proxy**: FastAPI nhận request → gọi OpenAI/CF API → trả về response → **không chạy model cục tiểu** → chiếm tối thiểu CPU/RAM

### Services được thay thế:
| Service | Thay thế | Lý do |
|---|---|---|
| PostgreSQL (v16) | **SQLite** | PG binary + data vượ quá 1GB disk |
| Redis | **LRU cache** | Không cần thiết, giảm process |
| OSRM | **OpenRouteService API** | Routing graph chiếm 1GB disk + 1 vCPU |
| MinIO | **FileSystem /tmp** | 1GB disk, MinIO image + data lớn |
| NGINX | **Removed** | Next.js + BFF handles routing |

---

## Phase 1: PostgreSQL → SQLite (1 ngày)

### 1.1 Export schema + data từ running PostgreSQL
```bash
# Export data (preserve schema)
docker exec -t edumap_postgres pg_dump -U edumap -d edumap_db --inserts --clean > /tmp/data.sql

# Convert PostgreSQL syntax → SQLite (types, serial, etc.)
python3 scripts/pg_to_sqlite.py /tmp/data.sql → /app/public/edumap.db
```

### 1.2 Replace TypeORM config
```typescript
// backend/src/config/database.config.ts
import Database from 'better-sqlite3';
const db = new Database(process.env.SQLITE_PATH || './public/edumap.db');
export default db;
```

### 1.3 Seed script (startup hook)
```bash
# init-sqlite.sh
if [ ! -f /app/public/edumap.db ]; then
  sqlite3 /app/public/edumap.db < /app/seed.sql
  echo "DB seeded ✅"
fi
```

### 1.4 Bỏ qua bảng lớn không cần thiết
```sql
-- Bỏ các bảng log/crawler data (giảm DB size)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS crawl_history;
DROP TABLE IF EXISTS ai_conversations;
DROP TABLE IF EXISTS chat_messages;
```

---

## Phase 2: Redis → LRU Cache (0.5 ngày)

### 2.1 Replace ioredis → lru-cache
```typescript
// frontend/src/lib/cache.ts
import LRU from 'lru-cache';
const cache = new LRU<string, any>({ max: 1000, ttl: 300_000 });
export default cache;
```

### 2.2 Update all cache calls
```bash
grep -rn "ioredis\|redis\|Redis" backend/src/ frontend/src/ | grep -v node_modules
→ replace with lru-cache
```

---

## Phase 3: OSRM → OpenRouteService (0.5 ngày)

### 3.1 Convert routing.service.ts
```typescript
// backend/src/modules/map/routing.service.ts
const ORS_API_KEY = process.env.ORS_API_KEY;
const ORS_URL = 'https://api.openrouteservice.org/v2/directions';

export async function getRoute(start:[number,number], end:[number,number]) {
  const res = await fetch(`${ORS_URL}/driving-car`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ORS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: [start, end] }),
  });
  return await res.json();
}
```
> **Free tier**: 2,000 req/day — đủ cho demo

---

## Phase 4: MinIO → FileSystem (0.5 ngày)

### 4.1 Replace MinIO client → Node.js fs
```typescript
// backend/src/modules/storage/storage.service.ts
import { promises as fs } from 'fs';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/edumap-uploads';

async uploadFile(userId:string, fileName:string, buffer:Buffer) {
  const dir = `${UPLOAD_DIR}/${userId}`;
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${fileName}`;
  await fs.writeFile(`${dir}/${filename}`, buffer);
  return { file_url: `/api/storage/media/${filename}` };
}

async serveFile(filename:string) {
  return await fs.readFile(`${UPLOAD_DIR}/${filename}`);
}
```

> **Note**: /tmp files mất khi HF Space restart — acceptable cho demo

---

## Phase 5: AI Service (0.5 ngày — GIỮ NGUYÊN)

### 5.1 AI service giữ nguyên nguyên trạng
- `ai-service/main.py` — FastAPI app
- `ai-service/routers/geo.py` — geo analysis
- `ai-service/routers/chat.py` — chat bot
- Chỉ gọi external API (OpenAI, Cloudflare, etc.) → **không cần model cục tiếp**

### 5.2 Environment variables (HF Spaces secrets)
```env
OPENAI_API_KEY=<secret>
CLOUDFLARE_API_KEY=<secret>
ORS_API_KEY=<secret>
MINIO_ENDPOINT=unused  # không dùng nữa
```

### 5.3 supervisord config
```ini
[program:ai-service]
command=python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
directory=/app/ai-service
stdout_logfile=/dev/stdout
stderr_logfile=/dev/stderr
autostart=true
autorestart=true
```

---

## Phase 6: Dockerfile + supervisord (1 ngày)

### 6.1 `Dockerfile` (single image, multi-stage)
```dockerfile
# Build stage
FROM node:20-alpine AS node-builder
RUN apk add --no-cache python3 sqlite
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx next build

FROM python:3.11-slim AS python-builder
COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM node:20-alpine
RUN apk add --no-cache supervisor python3 sqlite curl
WORKDIR /app

# Copy builds
COPY --from=node-builder /app/.next ./.next
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/package.json ./package.json
COPY --from=python-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy AI service + backend + config
COPY ai-service/ ./ai-service/
COPY backend/dist ./backend/dist
COPY backend/package.json ./backend/
RUN cd backend && npm install --production
COPY backend/src/database/seed.sql ./seed.sql
COPY infrastructure/supervisord.conf /etc/supervisor/conf.d/
COPY infrastructure/init-sqlite.sh /app/init-sqlite.sh
RUN chmod +x /app/init-sqlite.sh

# spaCers.yaml
COPY spacers.yaml /app/

EXPOSE 7680
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

### 6.2 `infrastructure/supervisord.conf`
```ini
[supervisord]
nodaemon=true

[program:init-db]
command=/bin/sh -c "/app/init-sqlite.sh"
autostart=true
autorestart=false
startsecs=0

[program:nestjs]
command=node /app/backend/dist/main.js
directory=/app/backend
environment=DB_TYPE="sqlite",SQLITE_PATH="/app/public/edumap.db",AI_SERVICE_URL="http://localhost:8000",PORT="3000"
stdout_logfile=/dev/stdout
stderr_logfile=/dev/stderr
autostart=true
autorestart=true

[program:ai-service]
command=python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
directory=/app/ai-service
stdout_logfile=/dev/stdout
stderr_logfile=/dev/stderr
autostart=true
autorestart=true

[program:nextjs]
command=node /app/.next/standalone/server.js
directory=/app
environment=NODE_ENV="production",PORT="7680",BACKEND_URL="http://localhost:3000,NEXT_PUBLIC_API_URL="http://localhost:7680/api"
stdout_logfile=/dev/stdout
stderr_logfile=/dev/stderr
autostart=true
autorestart=true
```

---

## Phase 7: Deploy + Test (0.5 ngày)

```bash
# Push to HF Spaces
cd frontend
git init  # if not yet
git remote add origin https://huggingface.co/spaces/nguyenca/edumap
git add -A && git commit -m "Migrate EduMap to HF Space"
git push

# Test
curl https://<space>.hf.space/api/hackathons → 200 + 30 items
curl https://<space>.hf.space/api/map/pois → 200 + 49 items  
curl https://<space>.hf.space/hackathon → 200 (SSR page)
curl https://<space>.hf.space/api/ai/chat → 200 (FastAPI proxy)
```

---

## 📊 Timeline (3.5 ngày)

| Phase | Task | Days |
|---|---|---|
| 1 | PostgreSQL → SQLite | 1 |
| 2 | Redis → LRU cache | 0.5 |
| 3 | OSRM → OpenRouteService | 0.5 |
| 4 | MinIO → FileSystem | 0.5 |
| 5 | AI service (keep as-is) + env config | 0.5 |
| 6 | Dockerfile + supervisord | 1 |
| 7 | Test + deploy | 0.5 |

---

## ✅ Kết quả mong đợi

| Feature | Before (Docker) | After (HF Space) |
|---|---|---|
| Homepage | `localhost/` | `https://<space>.hf.space/` ✅ |
| Hackathons | BFF→Devpost | BFF→Devpost ✅ |
| Map POIs | PostgreSQL (49 pts) | SQLite (49 pts) ✅ |
| Events | PostgreSQL (5) | SQLite (5) ✅ |
| Chỉ đường | OSRM local | OpenRouteService API ✅ |
| Chat AI | FastAPI→OpenAI | FastAPI→OpenAI ✅ |
| Upload files | MinIO bucket | /tmp filesystem ✅ |
| Storage | Redis cache | LRU cache ✅ |

> **AI service không thay đổi gì** — vẫn gọi API bên ngoài, chỉ chuyển từ `http://localhost:8000` (Docker) sang `http://localhost:8000` (HF Space localhost) 🎯
