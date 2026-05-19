# 📖 Hướng dẫn sử dụng API

## 🔐 Xác thực
Hệ thống sử dụng JWT (JSON Web Token).
1. Đăng ký tại /auth/register.
2. Đăng nhập tại /auth/login để lấy ccess_token.
3. Gửi Token trong Header: Authorization: Bearer <your_token>.

## 📍 Bản đồ (Map)
- GET /map/points: Lấy danh sách điểm.
- GET /map/nearby?lat=...&lng=...&radius=...: Tìm kiếm quanh vị trí hiện tại.

## 🤖 AI Chatbot
- POST /api/ai/chat: Gửi tin nhắn cho AI.
