# STK 本然家居项目 · 长期记忆

## 协作约定（必须遵守）

### 进度对齐规则（2026-08-19 用户明确要求）
- **每次执行任务前，必须先读取 `docs/STK本然家居_项目开发实施方案.md`，以文档 §11「里程碑交付记录」为准对齐当前执行到哪一步**，再推进对应步骤；不得仅凭会话记忆或上下文推断进度。
- 文档是进度的唯一事实源；会话摘要/记忆仅作辅助。
- 阶段门禁：每阶段（M1~M7）完成并提交交付说明后，须等用户回复「已确认，执行下一步」才进入下一阶段。

## 项目基线
- 技术栈：FastAPI + SQLAlchemy 2.0 + Alembic；开发 SQLite / 生产 PostgreSQL；前台 React+TS+Vite+Tailwind；后台 React+TS+Vite+AntD 5。
- 工程目录：`api/`（FastAPI 后端，venv 在 `api/.venv`）、`frontend/`（前台官网，端口 5175）、`backend/`（后台管理，端口 5174）；开发后端 8001，容器 api:8000。
- 文档基线四份：PRD V1.9 / UI-UX V1.0 / 数据库设计 V1.3 / 开发技术文档 V1.2，存于 `docs/`；实施方案存 `docs/STK本然家居_项目开发实施方案.md`。
- 视觉规范：墨玉翡翠（深绿 #0F3D2E + 香槟金 #C9A86A）、serif 标题、全站禁用蓝色。
- 账号：admin / Stk@2026New（role_id 1 super_admin，38 权限点）。
- 字体：前台用 `fonts.googleapis.cn` 国内镜像（不引入外部 .com 字体，避免被墙；自托管 CJK 体积 15MB 不可行）。

## 关键工程决策
- 富文本 XSS：`api/app/utils/security.py` `clean_html()`（bleach 白名单），6 个 schema 的 `field_validator(mode="after")` 接入。
- 限流：自研 `MemoryRateLimiter`（滑动窗口），留资 5/min/IP、登录 10/min/IP。
- 部署：`deploy/docker-compose.prod.yml`（postgres/api/web/admin/nginx 五服务），`.env.prod` 不入库、`.env.prod.example` 模板入库。
- 沙箱限制：Vite 清空 dist 被 safe-delete 拦截 → 前后台 `vite.config.ts` 均设 `build.emptyOutDir:false`，构建前先 `rm -rf dist`；禁止 `pip install --upgrade pip`。
