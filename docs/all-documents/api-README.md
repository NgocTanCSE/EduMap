# EduMap API Layer

This directory contains API specifications, documentation, and client artifacts for the EduMap platform.

## Structure

| Path | Description |
|------|-------------|
| `EduMap_API.postman_collection.json` | Postman collection for API testing |
| `API_GUIDE.md` | API usage guide |

## API Endpoints

The EduMap platform exposes three API layers:

### 1. NestJS Backend API (BE)
- **Location:** `backend/src/modules/`
- **Port:** 3001 (HF Docker via supervisord)
- **Prefix:** `/api`
- Full REST API with Swagger docs at `/api/docs`
- Modules: auth, map, library, career, community, mentor, gamification, etc.

### 3. AI Service API
- **Location:** `ai-service/routers/`
- **Port:** 8000
- **Prefix:** `/api/ai`
- FastAPI routers for chat, suggestions, analytics, career, geo, etc.

### 3. Frontend BFF (Backend-for-Frontend) API Routes
- **Location:** `frontend/app/api/`
- **Route:** `/api/*`
- Next.js route handlers that proxy requests to the NestJS backend

## Nginx Routing (HF Docker)
```
/api              → Backend (NestJS, port 3001)
/ai-service/      → AI Service (FastAPI, port 8000)
/                 → Frontend (Next.js, port 3000)
/api/socket.io   → Backend WebSocket (port 3001)
```
