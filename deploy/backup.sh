#!/bin/bash
# STK 本然家居 —— 生产数据库每日备份（NFR-20）
# 备份 postgres 全库为 SQL 文本，保留最近 7 天，自动清理过期文件。
#
# 调用方式（宿主机 cron，每日 03:00）：
#   0 3 * * * docker compose -f /path/to/deploy/docker-compose.prod.yml --env-file /path/to/deploy/.env.prod exec -T postgres sh /backup/backup.sh
#
# 依赖：postgres 容器内已挂载本脚本到 /backup/backup.sh，且 .env.prod 环境变量可见。

set -e

BACKUP_DIR="/backup"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)

# 从环境变量拼接连接串（与 docker-compose 中 POSTGRES_* 一致）
CONN="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"

mkdir -p "$BACKUP_DIR"

echo "[backup] 开始备份 ${POSTGRES_DB} -> ${BACKUP_DIR}/stk_${DATE}.sql"
pg_dump "$CONN" > "${BACKUP_DIR}/stk_${DATE}.sql"

# 同时保留一份最新（便于紧急恢复）
cp "${BACKUP_DIR}/stk_${DATE}.sql" "${BACKUP_DIR}/stk_latest.sql"

# 清理超过保留期的历史备份
find "$BACKUP_DIR" -maxdepth 1 -name 'stk_20*.sql' -mtime +"$RETENTION_DAYS" -delete

echo "[backup] 完成。保留最近 ${RETENTION_DAYS} 天。"
ls -lh "${BACKUP_DIR}" | tail -n 5
