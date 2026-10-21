#!/usr/bin/env bash
# =============================================================================
# EduMap — Regenerate SQLite DB (frontend/public/edumap.db)
#
# Công dụ làm mới/seed dữ liệu SQLite dùng cho HF Spaces (DB_TYPE=sqlite) và
# môi trường local mà KHUÔNG cần Docker / PostgreSQL.
#
# ĐƯỜNG DẪN (mặc định & duy nhất — portable, không cần Docker/Postgres):
#   scripts/regenerate_sqlite_db.sh
#     -> python3 scripts/seed_sqlite_db.py
#        (upsert idempotent dữ liệu 2026 mới: Eureka/P2A/Innovation, jobs,
#         hackathons, scholarships, campaigns, internships, international
#         programs; tính lại current_amount các campaign). KHÔNG xóa schema,
#        KHÔNG xóa dữ liệu cũ — chỉ thêm/cập nhật (upsert). Chạy lại an toàn.
#
# LƯU Ý: trước đây script này ép buộc Docker + PostgreSQL (postgres compose →
# schema.sql → seed.sql → migrate-pg-to-sqlite.py). Đã bỏ qua: ở HF Spaces
# (DB_TYPE=sqlite) Docker không chạy được, và migrate-pg-to-sqlite.py có bug
# `sys.exit` NameError (đã fix `import sys`). Đường dẫn Postgres→SQLite cũ
# vẫn giữ nguyên trong lịch sử git nếu cần one-off full rebuild trên môi
# trường local có Postgres.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQLITE_DB="$PROJECT_ROOT/frontend/public/edumap.db"
SEED_PY="$SCRIPT_DIR/seed_sqlite_db.py"

echo "🔄 [regenerate] Bắt đầu tái tạo edumap.db (path: $SQLITE_DB)"

# ── Portable Python path (default) ──
# Hoạt động mọi nơi có python3 + sqlite3 (HF Spaces Docker image, local, CI).
if command -v python3 &>/dev/null; then
  echo "🐍 [regenerate] Dùng Python portable (seed_sqlite_db.py)..."
  python3 "$SEED_PY"
else
  echo "❌ [regenerate] python3 không khả dụng. Cài Python 3 + sqlite3, hoặc dùng --postgres."
  exit 1
fi

if [ -f "$SQLITE_DB" ]; then
  SIZE=$(du -h "$SQLITE_DB" | cut -f1)
  TABLES=$(python3 -c "import sqlite3;print(len(sqlite3.connect('$SQLITE_DB').execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()))")
  echo "✅ [regenerate] xong: $SQLITE_DB ($SIZE, $TABLES bảng)"
  echo "🎉 [regenerate] Hoàn tất. Commit & push để HF rebuild với dữ liệu mới."
  exit 0
fi

echo "❌ [regenerate] Không tạo được $SQLITE_DB"
exit 1
