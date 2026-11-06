#!/usr/bin/env bash





















set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQLITE_DB="$PROJECT_ROOT/frontend/public/edumap.db"
SEED_PY="$SCRIPT_DIR/seed_sqlite_db.py"

echo "🔄 [regenerate] Bắt đầu tái tạo edumap.db (path: $SQLITE_DB)"



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
