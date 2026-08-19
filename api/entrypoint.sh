#!/bin/sh
# 后端容器启动入口：
#   1) 等待数据库就绪（简单重试）
#   2) alembic 迁移建表
#   3) 注入种子数据（幂等，已存在则跳过）
#   4) 启动 uvicorn
set -e

echo "[entrypoint] 等待数据库就绪..."
for i in $(seq 1 30); do
  # 注意：python 作为 if 条件，其非 0 退出不会触发 set -e（if 条件内的命令例外）
  if python - <<'PY'
import sys
try:
    from app.db.session import engine
    conn = engine.connect()
    conn.close()
    print("db ok")
except Exception as e:
    print("db not ready:", e)
    sys.exit(1)
PY
  then
    echo "[entrypoint] 数据库已就绪"
    break
  fi
  echo "[entrypoint] 重试 ($i/30) ..."
  sleep 2
done

echo "[entrypoint] 执行数据库迁移..."
python -m alembic upgrade head

echo "[entrypoint] 注入种子数据（幂等）..."
python scripts/seed.py || echo "[entrypoint] 种子已存在，跳过"

echo "[entrypoint] 启动 uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
