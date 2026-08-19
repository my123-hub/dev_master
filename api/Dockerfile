# 后端 API 镜像：Python 3.13-slim + uvicorn
# 构建：docker compose -f deploy/docker-compose.prod.yml build api
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 先安装依赖，利用 Docker 层缓存加速重建
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 拷贝应用代码（含迁移与种子）
COPY app ./app
COPY scripts ./scripts
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# 上传目录（生产由 named volume 挂载到 /uploads）
RUN mkdir -p /uploads

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
