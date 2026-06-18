# Contributing to EduMap

Cảm ơn bạn đã quan tâm đến việc đóng góp cho EduMap! Hướng dẫn này sẽ giúp bạn bắt đầu.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

Vui lòng đọc và tuân thủ [Code of Conduct](CODE_OF_CONDUCT.md) trước khi đóng góp.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker và Docker Compose
- Git

### Fork và Clone Repository

```bash
# Fork repository trên GitHub

# Clone repository
git clone https://github.com/your-username/edumap.git
cd edumap

# Thêm upstream remote
git remote add upstream https://github.com/original-owner/edumap.git
```

## Development Setup

### 1. Cài đặt Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# AI Service
cd ../ai-service
pip install -r requirements.txt
```

### 2. Cấu hình Environment Variables

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env
```

### 3. Chạy Docker Services

```bash
# Start PostgreSQL, Redis, và các services
docker-compose up -d

# Hoặc chỉ start database services
docker-compose up -d postgres redis
```

### 4. Khởi động Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: AI Service
cd ai-service
uvicorn main:app --reload --port 8000
```

### 5. Truy cập Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000/api
- AI Service: http://localhost:8000
- API Documentation: http://localhost:3000/api/docs

## Code Style

### TypeScript/JavaScript

- Sử dụng TypeScript cho tất cả code
- Follow Airbnb Style Guide
- Sử dụng ESLint và Prettier
- Chạy linter trước khi commit:

```bash
npm run lint
npm run format
```

### Python

- Follow PEP 8
- Sử dụng Black cho formatting
- Sử dụng Flake8 cho linting
- Chạy linter trước khi commit:

```bash
black .
flake8
```

### Git Commit Messages

Sử dụng Conventional Commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: adding tests
chore: maintenance tasks
```

Ví dụ:

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve login issue"
git commit -m "docs: update API documentation"
```

## Pull Request Process

### 1. Tạo Feature Branch

```bash
# Fetch latest changes
git fetch upstream

# Create feature branch
git checkout -b feature/your-feature-name upstream/main
```

### 2. Implement Changes

- Viết code theo code style
- Thêm tests cho new features
- Cập nhật documentation nếu cần

### 3. Test Changes

```bash
# Run tests
npm run test

# Run linter
npm run lint

# Run type check
npm run typecheck
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

### 5. Push và Tạo PR

```bash
git push origin feature/your-feature-name
```

Trên GitHub:
1. Tạo Pull Request từ feature branch vào main branch
2. Điền PR template
3. Gắn labels phù hợp
4. Chờ review

### 6. Code Review

- Respond to feedback
- Make requested changes
- Re-request review when ready

### 7. Merge

Sau khi được approve, PR sẽ được merge vào main branch.

## Reporting Bugs

### Tạo Bug Report

1. Truy cập Issues page
2. Click "New Issue"
3. Chọn "Bug Report" template
4. Điền thông tin:
   - Mô tả bug
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots (nếu có)
   - Environment info

### Quality Bug Report

- Clear và concise title
- Detailed reproduction steps
- Expected vs actual behavior
- Environment information
- Screenshots or videos

## Suggesting Features

### Tạo Feature Request

1. Truy cập Issues page
2. Click "New Issue"
3. Chọn "Feature Request" template
4. Điền thông tin:
   - Mô tả feature
   - Use case
   - Proposed solution
   - Alternatives considered

### Quality Feature Request

- Clear problem statement
- Proposed solution
- Use cases
- Alternatives considered
- Additional context

## Development Guidelines

### Project Structure

```
edumap/
├── backend/          # NestJS API server
├── frontend/         # Next.js frontend
├── ai-service/       # Python FastAPI AI service
├── crawlers/         # Data collection scripts
├── docs/             # Documentation
├── scripts/          # Utility scripts
├── tests/            # Test files
└── docker-compose.yml
```

### Testing

```bash
# Backend tests
cd backend
npm run test
npm run test:e2e

# Frontend tests
cd frontend
npm run test

# AI Service tests
cd ai-service
pytest
```

### Documentation

- Cập nhật README.md nếu cần
- Thêm JSDoc comments cho functions
- Cập nhật API documentation
- Thêm examples cho复杂 features

## Getting Help

- GitHub Issues: Tạo issue cho bugs hoặc feature requests
- GitHub Discussions: Đặt câu hỏi và thảo luận
- Email: admin@edumap.vn

## License

Bằng việc đóng góp, bạn đồng ý rằng đóng góp của bạn sẽ được cấp phép theo MIT License.
