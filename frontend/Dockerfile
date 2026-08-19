# 前台官网（web）构建镜像：Node 构建 → Nginx 托管静态产物
# 构建：docker compose -f deploy/docker-compose.prod.yml build web
FROM node:22-alpine AS build
WORKDIR /app

# 安装依赖（优先 lockfile，缺失时回退 install）
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY spa_default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
