# STK本然家居企业官网 — 开发技术文档

| 文档信息 | 内容 |
|---------|------|
| 文档名称 | STK本然家居企业官网 开发技术文档（Technical Design Document） |
| 版本 | V1.2 |
| 文档状态 | V1.2（依据 PRD V1.9 + UI-UX V1.0 + 数据库设计文档 V1.3：收敛产品价格策略、清除 sketch 中 product.decimal price 与 6 张配置/新闻表 status、与 PRD/数据库设计文档三文一致） |
| 配套基线 | `STK本然家居企业官网PRD.md`（V1.8）；`STK本然家居_UI-UX设计规范.md`（V1.0）；`STK本然家居_数据库设计文档.md`（V1.3） |
| 技术栈 | 后端 FastAPI + SQLAlchemy 2.0 + Alembic；开发 SQLite / 生产 PostgreSQL；前台 React+TS+Vite+Tailwind；后台 React+TS+Vite+AntD 5 |

---

## 目录

1. [文档概述与全局约定](#1-文档概述与全局约定)
2. [系统总体架构](#2-系统总体架构)
3. [后端开发规范与流程](#3-后端开发规范与流程)
4. [前端开发规范与流程](#4-前端开发规范与流程)
5. [数据库设计详述](#5-数据库设计详述)
6. [详细接口设计](#6-详细接口设计)
7. [关键模块实现指引](#7-关键模块实现指引)
8. [非功能需求落地](#8-非功能需求落地)
9. [开发流程与里程碑](#9-开发流程与里程碑)
10. [附录](#10-附录)

---

## 1. 文档概述与全局约定

### 1.1 目的与读者

本文档是 PRD 与 UI-UX 规范之上的**实现级技术文档**，回答"怎么做"：

- **后端工程师**：按第 3、5、6、7 章实现 API、模型、迁移、权限、上传、限流。
- **前端工程师**：按第 4、6 章实现官网（`web`）与后台（`admin`），并落地设计令牌与组件规范。
- **测试 / Reviewer**：按 §6 接口规格与 §8 非功能要求做联调与验收。

### 1.2 与 PRD / UI-UX 的关系

| 文档 | 职责 | 冲突优先级 |
|------|------|-----------|
| PRD V1.7 | 功能、数据模型、接口清单、验收 | 功能需求以 PRD 为准 |
| UI-UX V1.0 | 颜色、字体、间距、组件、交互、动效、无障碍 | 视觉细节以 UI-UX 为准 |
| 两份高保真原型 | 已实现交互的"事实基线" | **原型实现优先**（与 PRD 不一致时以原型为准，并在 UI-UX 附录 B 标注） |
| 本文档 | 工程化落地：目录、建表、接口字段、流程 | 不重新定义需求，只给出可执行实现 |

### 1.3 全局约定

#### 1.3.1 统一响应结构

所有接口（含错误）返回统一结构：

```json
{ "code": 0, "message": "ok", "data": {} }
```

- `code`：业务码，`0` 表示成功，非 0 表示业务/校验失败。
- `message`：人类可读提示，前端直接 toast 展示。
- `data`：业务数据；列表接口为分页包装对象（见下）。

**分页列表 `data` 结构**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [],
    "total": 120,
    "page": 1,
    "page_size": 12,
    "pages": 10
  }
}
```

#### 1.3.2 统一错误码

| code | 含义 | HTTP 状态 | 说明 |
|------|------|----------|------|
| 0 | 成功 | 200 | — |
| 40000 | 参数校验失败 | 422 | Pydantic 校验未过，detail 含字段级错误 |
| 40100 | 未认证 / Token 失效 | 401 | 未携带或 JWT 过期，前端跳转登录 |
| 40300 | 无权限 | 403 | 权限点（perm_code）校验未通过 |
| 40400 | 资源不存在 | 404 | 主键查询为空或已禁用 |
| 40900 | 资源冲突 | 409 | 删除有关联数据 / 唯一键冲突 |
| 41300 | 文件过大 / 类型非法 | 413 | 上传校验失败 |
| 42900 | 请求过于频繁 | 429 | 限流触发 |
| 50000 | 服务器内部错误 | 500 | 未预期异常 |

> 错误响应示例：`{ "code": 40100, "message": "登录已过期，请重新登录", "data": null }`

#### 1.3.3 鉴权约定

- 后台接口需在请求头携带：`Authorization: Bearer <access_token>`。
- 前台公开接口**不**需要 Token。
- Token 为 JWT（access token）；支持 7 天免登录通过 Refresh Token 或长有效期 Token（见 BR-04）。
- 后端**每个受保护接口在服务端强制执行权限点校验**（NFR-07）；前端仅做入口隐藏，不能替代鉴权。

#### 1.3.4 分页 / 筛选 / 排序约定

- 列表接口统一支持：`page`（默认 1）、`page_size`（默认 12，后台默认 10/20）、`keyword`（关键词）、状态/分类筛选参数。
- 排序：产品支持 `sort=default`（按 `sort_order` 升序）/ `sort=latest`（按 `created_date` 倒序）；其余列表按 `sort_order` 升序、`created_date` 倒序兜底。
- 时间区间筛选参数：`start_at`、`end_at`，格式 `YYYY-MM-DD HH:mm:ss`。

#### 1.3.5 限流约定

- 前台留资提交接口（`POST /api/appointments`、`POST /api/messages`、简历投递）限流：**同 IP 每分钟 ≤ 5 次**（NFR-11 / R3）。
- 登录接口：连续失败 `N` 次后限流（BR-02）。

#### 1.3.6 富文本与 XSS 约定

- 富文本字段（产品描述、案例介绍、新闻正文、岗位职责、任职要求、单页内容、FAQ 答案）入库前做**白名单标签清洗**（如仅允许 `p/b/i/em/strong/ul/ol/li/a/br/img/blockquote/h2/h3/span`），**去除 `on*` 事件属性与 `javascript:` 协议**（NFR-08 / R2）。
- 前端渲染使用受控的富文本渲染组件（如 `dangerouslySetInnerHTML` 仅用于已清洗内容，且二次转义），避免 XSS。

#### 1.3.7 通用字段约定

所有业务表含统一公共字段：`id`（主键）、`is_activate`（SMALLINT，1激活/0禁用）、`created_at`（BIGINT，创建人→sys_user.id）、`created_date`（TIMESTAMP，创建时间）、`updated_at`（BIGINT，修改人→sys_user.id）、`updated_date`（TIMESTAMP，修改时间）。查询默认 `is_activate=1`；本文档以下表结构仅列出业务字段，公共字段默认存在。

---

## 2. 系统总体架构

### 2.1 分层架构（C4 Container 级）

```mermaid
flowchart TD
    %%{init: {'theme':'base','themeVariables':{'primaryColor':'#0F3D2E','primaryTextColor':'#fff','lineColor':'#6FA088','fontSize':'14px'}}}%%
    subgraph 客户端
        U[访客 C端/B端/求职者]
        A[后台运营人员]
    end
    subgraph 接入层
        NGN[Nginx<br/>静态托管 + 反向代理 + HTTPS]
    end
    subgraph 前端层
        WEB[前台官网 web<br/>React + Tailwind + Vite]
        ADM[后台管理系统 admin<br/>React + AntD + Vite]
    end
    subgraph 后端层
        API[FastAPI 后端<br/>Router / Service / Model]
        LIM[限流 / 参数校验]
    end
    subgraph 数据层
        ORM[(SQLAlchemy 2.0 ORM)]
        DB[(PostgreSQL 16+<br/>开发期 SQLite)]
        FS[(/uploads 本地存储<br/>预留 OSS 抽象层)]
    end

    U -->|HTTPS| NGN
    A -->|HTTPS| NGN
    NGN -->|静态资源| WEB
    NGN -->|静态资源| ADM
    NGN -->|/api/* 反向代理| API
    API --> LIM
    API --> ORM
    ORM --> DB
    API --> FS

    classDef brand fill:#0F3D2E,stroke:#6FA088,color:#fff;
    classDef data fill:#F4F7F5,stroke:#6FA088,color:#0F3D2E;
    class NGN,API,LIM brand;
    class ORM,DB,FS data;
```

> 说明：客户端经 Nginx（TLS 终止 + 静态托管）访问前后台；`/api` 反代至 FastAPI；后端经 ORM 统一读写数据库，文件落本地 `/uploads`（存储抽象预留 OSS）。开发期 DB 为 SQLite，生产切换 PostgreSQL，业务代码无感知（ADR-001）。

### 2.2 关键架构说明（承接 PRD §4.2）

- **双库无缝切换**：`DATABASE_URL` 环境变量控制（`sqlite:///./app.db` 或 `postgresql://user:pass@host:5432/stk`）。ORM 统一使用跨库类型（Integer/String/Text/Boolean/DateTime/JSON/Numeric），业务代码无感知（ADR-001）。
- **前后端分离**：前端构建产物由 Nginx 静态托管，`/api` 反代至 FastAPI（§2.3、NFR-21）。
- **文件存储可演进**：本期本地 `/uploads`；存储层抽象为 `StorageBackend` 接口，后续接入 OSS 仅需新增实现（ADR-002）。
- **认证鉴权**：JWT + 角色-权限点（RBAC），服务端强制校验（ADR-003）。
- **状态**：业务数据默认 `is_activate=1` 激活（ADR-004）；禁用即等效“软删除”，可追溯。

### 2.3 部署拓扑（Docker Compose，NFR-21）

```mermaid
flowchart LR
    %%{init: {'theme':'base','themeVariables':{'primaryColor':'#0F3D2E','primaryTextColor':'#fff','lineColor':'#6FA088'}}}%%
    subgraph DockerCompose[Docker Compose 编排]
        direction TB
        NGNX[nginx:alpine<br/>TLS终止 + 静态托管 + 反代]
        WEB_B[web 构建产物<br/>官网静态资源]
        ADM_B[admin 构建产物<br/>后台静态资源]
        API_C[backend<br/>FastAPI + uvicorn]
        PG[(postgres:16<br/>生产数据库)]
        VOL[(volume: /uploads<br/>上传文件持久化)]
        NGNX --> WEB_B
        NGNX --> ADM_B
        NGNX -->|/api| API_C
        API_C --> PG
        API_C --> VOL
    end

    classDef brand fill:#0F3D2E,stroke:#6FA088,color:#fff;
    classDef data fill:#F4F7F5,stroke:#6FA088,color:#0F3D2E;
    class NGNX,API_C brand;
    class PG,VOL data;
```

- `docker-compose up -d` 一键启动（NFR-23）。
- 开发环境可不启用 PostgreSQL 容器，使用本地 SQLite（PRD §4.1）。
- 生产启用 HTTPS（NFR-12），Nginx 终止 TLS。

### 2.4 工程目录结构

```
stk-home/
├── backend/                      # FastAPI 后端
│   ├── app/
│   │   ├── main.py               # 应用入口、路由挂载、中间件
│   │   ├── core/
│   │   │   ├── config.py         # pydantic-settings 读取 .env
│   │   │   ├── security.py       # JWT、bcrypt、权限依赖
│   │   │   └── deps.py           # DB Session、当前用户依赖
│   │   ├── db/
│   │   │   ├── base.py           # Base、engine、SessionLocal
│   │   │   └── session.py
│   │   ├── models/               # SQLAlchemy 模型（§5.3）
│   │   ├── schemas/              # Pydantic 请求/响应模型
│   │   ├── routers/              # API 路由（前台 /admin 分组）
│   │   ├── services/             # 业务逻辑（权限、内容聚合、导出等）
│   │   └── utils/
│   │       ├── storage.py        # 存储抽象（本地/OSS）
│   │       ├── sanitize.py       # 富文本 XSS 清洗
│   │       ├── limiter.py        # 限流（slowapi/redis）
│   │       └── excel.py          # 导出 CSV/Excel
│   ├── alembic/                  # 迁移脚本
│   │   ├── env.py
│   │   └── versions/
│   ├── scripts/
│   │   └── seed.py               # 种子数据（超管、栏目、单店、配置）
│   ├── uploads/                  # 本地上传目录（gitignore）
│   ├── .env / .env.prod
│   ├── requirements.txt
│   └── Dockerfile
├── web/                          # 前台官网 React + TS + Vite + Tailwind
│   ├── src/
│   │   ├── api/                  # axios 封装 + 各模块请求
│   │   ├── components/           # 公共组件（Nav/Footer/Card/Carousel...）
│   │   ├── pages/                # 各路由页面
│   │   ├── hooks/                # 业务 hooks
│   │   ├── store/                # Zustand / Context
│   │   ├── styles/               # tokens.css、tailwind 配置引用
│   │   └── router.tsx
│   ├── tailwind.config.js        # 设计令牌注入（§4.2）
│   └── vite.config.ts
├── admin/                        # 后台 React + TS + Vite + AntD 5
│   ├── src/
│   │   ├── api/
│   │   ├── layout/               # 手风琴导航、顶栏
│   │   ├── pages/                # 各管理模块
│   │   ├── components/           # Table/Drawer/Modal/Upload 封装
│   │   └── router.tsx
│   └── vite.config.ts
├── nginx/
│   └── nginx.conf                # SPA 路由 + /api 反代 + 静态托管
└── docker-compose.yml
```

---

## 3. 后端开发规范与流程

### 3.1 工程分层

| 层 | 目录 | 职责 | 依赖方向 |
|----|------|------|---------|
| Router | `routers/` | 接收 HTTP、参数校验、调用 Service、组装响应 | → Service |
| Service | `services/` | 业务规则、状态流转、权限判断、聚合 | → Model / Schema |
| Model | `models/` | ORM 实体（数据库映射） | → db Base |
| Schema | `schemas/` | Pydantic 入参/出参模型 | 无依赖 |
| Core | `core/` | 配置、安全、依赖注入 | — |

> 依赖方向单向：Router → Service → Model；Schema 作为数据契约在层间传递，不反向依赖。禁止在 Router 写 SQL/业务逻辑。

### 3.2 配置管理（`core/config.py`）

使用 `pydantic-settings` 读取 `.env`：

```python
class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./app.db"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天（BR-04）
    UPLOAD_DIR: str = "uploads"
    UPLOAD_MAX_MB: int = 5
    RATE_LIMIT_PER_MIN: int = 5
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:5174"]

    class Config:
        env_file = ".env"
```

- `dev` / `prod` 通过 `.env` 与 `.env.prod` 区分（NFR-22）。
- 切换数据库仅改 `DATABASE_URL`，无需改代码（ADR-001）。

### 3.3 ORM 与 Alembic 迁移流程

- `db/base.py` 定义 `Base = DeclarativeBase()` 与公共字段 mixin：`is_activate`、`created_at`（创建人）、`created_date`、`updated_at`（修改人）、`updated_date`。
- 模型继承 `Base` 与 `CommonMixin`（含以上公共字段）。
- 迁移初始化（M1）：
  1. `alembic init alembic`
  2. 配置 `env.py` 中 `sqlalchemy.url = settings.DATABASE_URL` 并 `target_metadata = Base.metadata`
  3. `alembic revision --autogenerate -m "init schema"` → 生成初始迁移
  4. `alembic upgrade head` 落库
- 后续变更：修改 model → `alembic revision --autogenerate` → `upgrade head`。开发与生产共用同一套迁移脚本（PRD §4.2）。

### 3.4 鉴权与权限（详见 §7.1）

- `core/security.py`：`create_access_token(sub, role_id)`、`decode_token()`、`verify_password()`（bcrypt）。
- 依赖 `get_current_user`（解析 Bearer、查库、返回 `SysUser`）。
- 权限依赖 `require_perm(perm_code)`：从 `sys_role_permission` + `sys_permission` 解析当前用户权限集合，缺码返回 `40300`。
- 所有 `/api/admin/*` 路由默认 `get_current_user`；写操作路由附加 `require_perm(...)`。

### 3.5 统一响应与异常处理

- 封装 `success(data=..., message="ok")` → `{code:0, message, data}`。
- 全局异常处理器：`RequestValidationError` → 40000；`JWTError` → 40100；自定义 `BizError(code, msg)` → 对应 code；未预期异常 → 50000 并记录日志。
- 响应体 `data` 由 Pydantic `response_model` 序列化，保证字段契约稳定。

### 3.6 文件上传服务（§7.4）

- `POST /api/admin/upload`：校验类型（jpg/png/webp，NFR-09）、大小（≤5MB，BR-19）、随机文件名（uuid + 原扩展名）、写入 `UPLOAD_DIR`。
- 返回 `{ "url": "/static/uploads/xxxx.webp" }`；Nginx 或 FastAPI `StaticFiles` 暴露 `/static/uploads`。
- 压缩：上传后异步压缩/转 WebP（NFR-05），原始图可保留。
- 存储抽象：`StorageBackend` 接口（`save`, `delete`, `url`），本地实现默认；OSS 实现后续接入（ADR-002）。

### 3.7 富文本 XSS 清洗（`utils/sanitize.py`）

- 入库前 `clean_html(html)`：使用 `bleach` 白名单清洗，`bleach.sanitizer.Cleaner(allowed_tags=[...], allowed_attributes={'a':['href'],'img':['src','alt']})`。
- 去除 `style` 中的 `expression`、所有 `on*` 属性、`javascript:` 链接。
- 输出仍由前端渲染层二次转义兜底。

### 3.8 开发 → 联调流程

1. 启动数据库（开发用 SQLite，自动建表或 `alembic upgrade head`）。
2. `uvicorn app.main:app --reload`（开发），访问 `/docs` 查看 Swagger（NFR-18）。
3. `python scripts/seed.py` 注入种子数据（超管、栏目、单店、配置）。
4. 前端 `npm run dev` 联调，`/api` 经 Vite proxy 指向后端（见 §4.1/§4.2）。
5. 接口联调按 §6 规格逐条核对；PR/合并前跑 lint（Ruff/Black，NFR-17）与类型检查。

---

## 4. 前端开发规范与流程

### 4.1 前台官网 `web`（React + TS + Vite + Tailwind）

![前台系统架构（web 模块图）](diagrams/web-architecture.svg)

**设计令牌落地**（承接 UI-UX §2.1）：

`tailwind.config.js` 注入品牌令牌：

```js
theme: {
  extend: {
    colors: {
      ink:   "#0F3D2E",   // 深墨绿 主色
      inklt: "#6FA088",   // 浅墨绿 点缀/CTA
      cream: "#FAF8F5",   // 米白 背景
      mist:  "#F4F7F5",   // 浅灰绿 次级背景
      weak:  "#9E9E9E",   // 弱化灰
    },
    boxShadow: { soft: "0 2px 12px rgba(0,0,0,.06)" },
    borderRadius: { xl: "12px", "2xl": "16px" },
    letterSpacing: { title: ".14em", sub: ".06em" },
  }
}
```

- 全局 CSS 定义字体栈（`ui-ux §2.1`）、`.ph`（墨绿渐变占位）、`.img-zoom`（hover scale≤1.05）、`focus-visible` 焦点环（补 UI-UX 附录 B 高优先级项）。
- 组件库（UI-UX §4）：Button / Card / Carousel / Tab / Pagination / Breadcrumb / Skeleton / Empty / Form，全部按令牌与交互规范实现。
- 路由（`react-router-dom` v6）+ **路由级代码分割**（`React.lazy`，NFR-16/FR-56）：
  `home / products / product-detail / cases / case-detail / news / news-detail / jobs / job-detail / about-stk / timeline / brand / appointment / contact / policy / faq`（UI-UX §5）。
- 状态管理：`React Context`（全局：购物车无、仅需"当前门店/联系信息缓存"）+ `Zustand`（复杂跨页如预约草稿，可选）。不引入 Redux（PRD §4.2）。
- 请求层：`src/api/client.ts` 封装 Axios：baseURL `/api`、统一响应解包（`response.data.data`）、错误 toast、401 跳登录、提交防重复（`loading` 锁）。
- 响应式断点：桌面 ≥1024 / 平板 768–1024 / 移动 <768（NFR-14）；移动汉堡菜单（UI-UX §3.2）。
- 无障碍：图标按钮 `aria-label`、图片 `alt`、可见焦点环、键盘可达（UI-UX §11，CRITICAL）。

### 4.2 后台 `admin`（React + TS + Vite + AntD 5）

![后台系统架构（admin 模块图）](diagrams/admin-architecture.svg)

- **布局**：左侧固定深墨绿（`--sider #0F3D2E`）侧边栏 + 顶栏（面包屑/用户/角色）+ 内容区（`--bg #f0f2f5` 浅灰底 + 白色卡片）（UI-UX §6.1）。
- **手风琴二级导航**（UI-UX §6.2 核心规范）：父级默认折叠，点击展开（箭头 `rotate(180deg)`），**同组仅展开当前页父级、其余自动折叠**；`.role-only-admin` 组（系统管理）仅超管可见。实现可用 AntD `Menu` `mode="inline"` + 受控 `openKeys`（仅保留当前父级）。
- **组件范式**：表格（密集但留白）、`Form + Drawer`（编辑/详情，UI-UX §7 `openDrawer`）、`Modal` 二次确认删除（"此操作不可撤销"）、`Upload` 虚线框、Toast（右上角）、状态 `.tag` 五色（UI-UX §7）。
- **富文本**：`wangEditor`（UI-UX §13.2 建议，中文生态好、轻量）。
- **状态标签色收敛**（UI-UX 附录 B 中优先级项）：建议"待处理"改橙/中性，红色保留给"已关闭/已淘汰"；角色标签确认是否沿用 AntD 蓝 `#1677ff` 或改墨绿系——**当前按原型保留五色，后续评审收敛**。
- **图标**：统一 SVG（Lucide/Heroicons），替换工作台 emoji（UI-UX 附录 B 中，优先级中）。
- 请求层同 `web`，额外在拦截器注入 `Authorization`、401 清 token 跳登录、403 toast。
- 权限入口：登录后 `/api/admin/auth/me` 返回权限点集合，前端据此控制菜单/按钮显隐（仅视觉，服务端强制）。

### 4.3 联调与走查

- 前台 `vite.config.ts` 配置 `server.proxy['/api'] → http://localhost:8000`，免 CORS 联调。
- 后端 `/docs` Swagger 作为接口事实源（NFR-18）。
- 走查按 UI-UX §13 验收清单（视觉/组件/响应式/无障碍）逐条核对。

---

## 5. 数据库设计详述

### 5.1 设计原则（承接 PRD §10.1）

- 开发 SQLite / 生产 PostgreSQL，经 `DATABASE_URL` 切换，业务代码无感知。
- 公共字段：`id`、`is_activate`、`created_at`(创建人)、`created_date`、`updated_at`(修改人)、`updated_date`（详见 §1.3.7）。
- 通用"内容页"统一存 `page_content`（`content_type` 区分）。
- 多图/参数类（`images`、`specs`、`space_tags`）用 JSON 字段，跨库兼容。
- 状态以 `is_activate` 为主（1激活/0禁用），禁用即等效软删除，关键业务可追溯。
- 双库兼容：统一用跨库通用类型；SQL 全由 ORM 生成，不写方言 SQL。

### 5.2 ER 关系（核心关联）

![数据库 ER 图（21 张表）](diagrams/er-diagram.svg)

> 图示由「架构图与流程图绘制专家」技能生成（可缩放 SVG，位于 `diagrams/er-diagram.svg`）。Mermaid 源码可展开编辑：

<details><summary>查看 / 编辑 ER 图 Mermaid 源码</summary>

```mermaid
erDiagram
    SYS_USER {
        bigint id PK
        string username
        string password_hash
        bigint dept_id FK
        bigint role_id FK
        bool must_change_pwd
    }
    DEPARTMENT {
        bigint id PK
        string dept_name
        bigint parent_id FK
    }
    SYS_ROLE {
        bigint id PK
        string role_name
    }
    SYS_PERMISSION {
        bigint id PK
        string perm_code
        string menu_key
    }
    SYS_ROLE_PERMISSION {
        bigint role_id FK
        bigint permission_id FK
    }
    SYS_OPERATION_LOG {
        bigint id PK
        bigint user_id FK
        string module
        string action
        string detail
    }
    PRODUCT_CATEGORY {
        bigint id PK
        string name
    }
    PRODUCT {
        bigint id PK
        bigint category_id FK
        string name
        smallint status
    }
    CASE_INFO {
        bigint id PK
        string title
        json space_tags
        smallint status
    }
    NEWS_CATEGORY {
        bigint id PK
        string name
    }
    NEWS_ARTICLE {
        bigint id PK
        bigint category_id FK
        string title
    }
    JOB {
        bigint id PK
        string title
        smallint category
        string location
        smallint status
    }
    JOB_APPLICATION {
        bigint id PK
        bigint job_id FK
        string name
        string phone
        string resume_url
        smallint status
    }
    PAGE_CONTENT {
        bigint id PK
        string content_type
        string title
    }
    MILESTONE_ITEM {
        bigint id PK
        string year
        string title
    }
    FAQ {
        bigint id PK
        string question
    }
    STORE {
        bigint id PK
        string name
        string city
        string address
    }
    BANNER {
        bigint id PK
        string image_url
    }
    APPOINTMENT {
        bigint id PK
        string name
        string phone
        string store_name
        smallint status
    }
    MESSAGE {
        bigint id PK
        string name
        string phone
        string content
        smallint status
    }
    SYS_CONFIG {
        bigint id PK
        string config_key
        text config_value
    }

    SYS_ROLE ||--o{ SYS_USER : "拥有"
    DEPARTMENT ||--o{ SYS_USER : "归属部门"
    SYS_ROLE ||--o{ SYS_ROLE_PERMISSION : "授予"
    SYS_PERMISSION ||--o{ SYS_ROLE_PERMISSION : "被授权"
    SYS_USER ||--o{ SYS_OPERATION_LOG : "产生"
    PRODUCT_CATEGORY ||--o{ PRODUCT : "包含"
    NEWS_CATEGORY ||--o{ NEWS_ARTICLE : "包含"
    JOB ||--o{ JOB_APPLICATION : "收到投递"
```

</details>

> 关系说明：用户归属部门（多对一）；用户归属角色（多对一）；角色经 `sys_role_permission` 多对多关联权限点；用户产生操作日志；产品归属系列、新闻归属栏目、简历投递归属职位（均为一对多）。其余表（case_info、banner、faq、milestone_item、store、appointment、message、page_content、sys_config）为内容/配置/留资实体，无外键关联，详见 §5.3 逐表定义。

### 5.3 表结构（PostgreSQL DDL + 关键说明）

> 以下给出生产 PostgreSQL DDL（含索引）；SQLite 由 SQLAlchemy 同模型自动建表，类型自动降级（如 JSON→TEXT）。公共字段（`id` 及每表 DDL 末尾的 `is_activate`/`created_at`/`created_date`/`updated_at`/`updated_date`）在模型 mixin 中统一定义，DDL 中显式列出以明确契约。

#### 1) sys_user（管理员用户）

```sql
CREATE TABLE sys_user (
  id               BIGSERIAL PRIMARY KEY,
  username         VARCHAR(50)  NOT NULL UNIQUE,   -- 登录名
  password_hash    VARCHAR(255) NOT NULL,
  name             VARCHAR(50),                     -- 姓名
  nickname         VARCHAR(50),                     -- 昵称
  mobile           VARCHAR(20),                     -- 手机号
  email            VARCHAR(100),
  gender           SMALLINT     NOT NULL DEFAULT 0,  -- 0未知/1男/2女
  position         VARCHAR(50),                     -- 岗位
  dept_id          BIGINT       REFERENCES department(id),  -- 部门编号
  role_id          BIGINT       NOT NULL REFERENCES sys_role(id),        -- 角色编号
  last_login_at    TIMESTAMP,
  must_change_pwd  BOOLEAN      NOT NULL DEFAULT TRUE,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_sys_user_role_id ON sys_user(role_id);
CREATE INDEX ix_sys_user_dept_id ON sys_user(dept_id);
```

#### department（部门，系统管理域）

```sql
CREATE TABLE department (
  id          BIGSERIAL PRIMARY KEY,
  dept_name   VARCHAR(100) NOT NULL,            -- 部门名称
  parent_id   BIGINT       REFERENCES department(id),  -- 上级部门(自关联)
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_department_parent_id ON department(parent_id);
```

#### 2) sys_role / sys_permission / sys_role_permission

```sql
CREATE TABLE sys_role (
  id          BIGSERIAL PRIMARY KEY,
  role_name   VARCHAR(50) NOT NULL UNIQUE,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE TABLE sys_permission (
  id         BIGSERIAL PRIMARY KEY,
  perm_code  VARCHAR(80) NOT NULL UNIQUE,  -- e.g. product:edit
  perm_name  VARCHAR(80),
  menu_key   VARCHAR(50),                 -- 关联后台菜单
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE TABLE sys_role_permission (
  role_id       BIGINT NOT NULL REFERENCES sys_role(id),
  permission_id BIGINT NOT NULL REFERENCES sys_permission(id),
  PRIMARY KEY (role_id, permission_id),
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
```

内置角色：`super_admin`（超级管理员，全量权限）、`content_editor`（内容编辑，仅内容类模块，无系统管理）。权限点按后台菜单/功能模块粒度拆分（BR-62），如 `product:view/create/edit/delete/status`、`news:*`、`recruit:*`、`reservation:*`、`message:*`、`system:user/role/log`。

#### 3) product_category（产品系列）

```sql
CREATE TABLE product_category (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  cover_url  VARCHAR(255),
  sort_order INT         NOT NULL DEFAULT 0,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_pcat_sort ON product_category(sort_order);
```

#### 4) product（产品）

```sql
CREATE TABLE product (
  id           BIGSERIAL PRIMARY KEY,
  category_id  BIGINT      NOT NULL,                 -- 所属空间分类
  name         VARCHAR(100) NOT NULL,
  series       VARCHAR(50),                    -- 所属系列，如「胡桃禮」
  product_no   VARCHAR(50) NOT NULL,           -- 产品编号（唯一）
  description  TEXT,                           -- 富文本（已清洗）
  specs        JSON,                           -- [{"name":"材质","value":"胡桃木"}]
  cover_url    VARCHAR(255),                   -- 封面图片 URL
  images       JSON,                           -- 其它图片 URL（JSON 数组）
  status       SMALLINT     NOT NULL DEFAULT 1, -- 发布状态：0 草稿 / 1 上架 / 2 下架
  is_top       SMALLINT     NOT NULL DEFAULT 0, -- 是否置顶：1 置顶 / 0 否
  sort_order   INT          NOT NULL DEFAULT 0, -- 排序值（越大越靠前）
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
ALTER TABLE product ADD CONSTRAINT fk_product_category_id FOREIGN KEY (category_id) REFERENCES product_category(id);
CREATE UNIQUE INDEX uq_product_no ON product(product_no);
CREATE INDEX ix_product_cat    ON product(category_id);
CREATE INDEX ix_product_status ON product(status);
CREATE INDEX ix_product_top    ON product(is_top);
```

#### 5) case_info（实景案例）

```sql
CREATE TABLE case_info (
  id           BIGSERIAL PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  cover_url    VARCHAR(255),
  space_tags   JSON,                         -- ["客厅","卧室"]
  city         VARCHAR(50),
  area         VARCHAR(50),
  finished_at  VARCHAR(30),
  content      TEXT,                         -- 富文本
  images       JSON,                         -- 实景图集
  sort_order   INT          NOT NULL DEFAULT 0,
  status       SMALLINT     NOT NULL DEFAULT 1, -- 1发布/0下线
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
```

#### 6) news_category / news_article（新闻）

```sql
CREATE TABLE news_category (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE TABLE news_article (
  id            BIGSERIAL PRIMARY KEY,
  category_id   BIGINT      NOT NULL,                 -- 所属分类
  title         VARCHAR(200) NOT NULL,
  cover_url     VARCHAR(255),                   -- 封面图 URL
  summary       VARCHAR(300),                   -- 摘要
  content       TEXT,                           -- 正文（富文本 HTML，已清洗）
  source        VARCHAR(100),                   -- 来源（转载标注）
  is_published  SMALLINT     NOT NULL DEFAULT 0, -- 是否发布：1 已发布 / 0 未发布
  is_top        SMALLINT     NOT NULL DEFAULT 0, -- 是否置顶/推荐：1 是 / 0 否
  publish_time  TIMESTAMP,                      -- 发布时间
  end_time      TIMESTAMP,                      -- 截止时间（置顶/展示有效期，可空）
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
ALTER TABLE news_article ADD CONSTRAINT fk_news_article_category_id FOREIGN KEY (category_id) REFERENCES news_category(id);
CREATE INDEX ix_news_cat ON news_article(category_id);
CREATE INDEX ix_news_published ON news_article(is_published);
CREATE INDEX ix_news_top ON news_article(is_top);
CREATE INDEX ix_news_pubtime ON news_article(publish_time);
```

#### 7) job（招聘职位）

```sql
CREATE TABLE job (
  id             BIGSERIAL PRIMARY KEY,
  title          VARCHAR(100) NOT NULL,
  category       SMALLINT     NOT NULL,        -- 1社会招聘/2校园招聘
  location       VARCHAR(100) NOT NULL DEFAULT '上海',
  job_type       VARCHAR(20),                  -- 全职/实习/校招
  salary_range   VARCHAR(50),
  responsibility TEXT,                         -- 富文本 岗位职责
  requirement    TEXT,                         -- 富文本 任职要求
  contact        VARCHAR(200) NOT NULL,        -- 简历投递邮箱/联系方式
  is_urgent      SMALLINT     NOT NULL DEFAULT 0, -- 1急招
  status         SMALLINT     NOT NULL DEFAULT 1, -- 1招聘中/0已关闭
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_job_cat ON job(category);
CREATE INDEX ix_job_status ON job(status);
```

#### 8) page_content（单页内容）

```sql
CREATE TABLE page_content (
  id          BIGSERIAL PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL UNIQUE,  -- about_stk/brand_intro/after_sales_policy
  title       VARCHAR(150),
  content     TEXT,                          -- 富文本
  cover_url   VARCHAR(255),
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
```

#### 9) milestone_item（发展历程）

```sql
CREATE TABLE milestone_item (
  id          BIGSERIAL PRIMARY KEY,
  year        VARCHAR(10) NOT NULL,
  title       VARCHAR(150),
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,        -- 时间倒序展示
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
```

#### 10) faq / store / banner

```sql
CREATE TABLE faq (
  id         BIGSERIAL PRIMARY KEY,
  category   VARCHAR(50),                    -- 可选分类
  question   VARCHAR(300) NOT NULL,
  answer     TEXT,                           -- 富文本
  sort_order INT         NOT NULL DEFAULT 0,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE TABLE store (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  city            VARCHAR(50)  NOT NULL DEFAULT '上海',
  address         VARCHAR(255) NOT NULL,
  phone           VARCHAR(50)  NOT NULL,
  business_hours  VARCHAR(100),
  longitude       VARCHAR(30),               -- 单店本期不填
  latitude        VARCHAR(30),
  sort_order      INT          NOT NULL DEFAULT 0,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE TABLE banner (
  id         BIGSERIAL PRIMARY KEY,
  image_url  VARCHAR(255) NOT NULL,
  title      VARCHAR(100),
  subtitle   VARCHAR(200),
  link_url   VARCHAR(255),
  sort_order INT         NOT NULL DEFAULT 0,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
```

#### 11) appointment / job_application / message（留资）

```sql
CREATE TABLE appointment (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(50)  NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  store_name      VARCHAR(100) NOT NULL DEFAULT '上海旗舰店', -- 固定归属
  appointment_date TIMESTAMP,
  intention       VARCHAR(200),                  -- 意向产品/系列
  remark          TEXT,
  status          SMALLINT     NOT NULL DEFAULT 0, -- 0待处理/1已联系/2已到店/3已关闭
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_appointment_phone ON appointment(phone);
CREATE INDEX ix_appointment_status ON appointment(status);

CREATE TABLE job_application (
  id         BIGSERIAL PRIMARY KEY,
  job_id     BIGINT      NOT NULL REFERENCES job(id),
  name       VARCHAR(50) NOT NULL,
  phone      VARCHAR(20) NOT NULL,
  email      VARCHAR(100),
  resume_url VARCHAR(255) NOT NULL,            -- 简历附件路径
  note       TEXT,                             -- 自我推荐/备注
  status     SMALLINT     NOT NULL DEFAULT 0,  -- 0待处理/1已联系/2已淘汰/3已录用
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_jobapp_job ON job_application(job_id);
CREATE INDEX ix_jobapp_phone ON job_application(phone);

CREATE TABLE message (
  id        BIGSERIAL PRIMARY KEY,
  name      VARCHAR(50)  NOT NULL,
  phone     VARCHAR(20)  NOT NULL,
  email     VARCHAR(100),
  content   TEXT         NOT NULL,
  status    SMALLINT     NOT NULL DEFAULT 0,  -- 0待处理/1已处理
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_message_phone ON message(phone);
```

#### 12) sys_operation_log（操作日志）

```sql
CREATE TABLE sys_operation_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,
  module     VARCHAR(50),    -- product/news/...
  action     VARCHAR(50),    -- create/update/delete/status/export/login
  detail     VARCHAR(500),   -- "下架产品：胡桃木餐桌"
  ip         VARCHAR(50),
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_oplog_user ON sys_operation_log(user_id);
CREATE INDEX ix_oplog_module ON sys_operation_log(module);
```

#### 13) sys_config（系统配置键值）

```sql
CREATE TABLE sys_config (
  id           BIGSERIAL PRIMARY KEY,
  config_key   VARCHAR(100) NOT NULL UNIQUE,  -- contact.address/contact.phone/highlight.title_1/brand.slogan
  config_value TEXT,
  is_activate   SMALLINT     NOT NULL DEFAULT 1,   -- 1激活/0禁用
  created_at    BIGINT,                        -- 创建人(sys_user.id)
  created_date  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at    BIGINT,                        -- 修改人(sys_user.id)
  updated_date  TIMESTAMP    NOT NULL DEFAULT now()
);
```

> **索引策略**（PRD §10.2）：所有外键、`status`/`is_published`、`sort_order`、`publish_time`、`phone` 建立索引；列表查询/排序/筛选字段覆盖。

### 5.4 SQLAlchemy 模型示例（代表性）

```python
from app.db.base import Base, CommonMixin
from sqlalchemy import BigInteger, String, Text, SmallInteger, Numeric, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

class Product(Base, CommonMixin):
    __tablename__ = "product"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("product_category.id"))
    name: Mapped[str] = mapped_column(String(100))
    series: Mapped[str | None] = mapped_column(String(50))
    product_no: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    specs: Mapped[list | None] = mapped_column(JSON)
    cover_url: Mapped[str | None] = mapped_column(String(255))
    images: Mapped[list | None] = mapped_column(JSON)
    status: Mapped[int] = mapped_column(SmallInteger, default=1)  # 0草稿/1上架/2下架
    is_top: Mapped[int] = mapped_column(SmallInteger, default=0)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)
```

> 其余表模型同构，均继承 `Base + CommonMixin`（含 `is_activate` 等公共字段），类型使用跨库通用类型（ADR-001）。

### 5.5 Alembic 迁移策略

- 初始迁移：`init schema`（M1）一次性生成全部 21 张表。
- 变更：修改 model → `alembic revision --autogenerate -m "<desc>"` → review 生成的 `upgrade()/downgrade()` → `alembic upgrade head`。
- 索引、外键在 autogenerate 中确认无误；JSON 类型在两端均被支持（SQLite 存 TEXT 序列化，PostgreSQL 存原生 JSON）。
- 生产迁移前在 staging 验证；`pg_dump` 备份后执行（NFR-20）。

### 5.6 种子数据（`scripts/seed.py`）

首次部署注入：

1. **超管账号**：`username=admin`，随机强密码写入 `.env` 或控制台提示，首次登录强制改密（BR-06）。
2. **内置角色**：`super_admin`、`content_editor` 及其权限点关联。
3. **新闻栏目**：企业新闻、行业资讯（BR-26）。
4. **单店**：上海旗舰店（名称/地址/电话/营业时间，BR-43）。
5. **sys_config 初始键值**：联系信息、品牌 Slogan/副标语、首页企业亮点文案（BR-51）、页脚信息。
6. **首页轮播**：可选占位 1 条。

---

## 6. 详细接口设计

### 6.1 统一约定（见 §1.3）

- Base URL：`/api`；后台前缀 `/api/admin`。
- 后台接口需 `Authorization: Bearer <token>`；`perm` 列标注所需权限点（服务端强制，NFR-07）。
- 列表统一分页包装（§1.3.1）。错误码见 §1.3.2。

### 6.2 前台公开接口

#### 6.2.1 首页聚合 `GET /api/home`

无需鉴权。聚合：轮播（启用）、企业亮点（来自 `sys_config`）、精选产品（`is_top=1`，最多 8）、精选案例（发布、按 `sort_order` 取前 N）、最新新闻（`is_published=1`、按 `publish_time` 倒序前 N）。

**响应 `data` 示例**：
```json
{
  "banners":     [{ "id": 1, "image_url": "/static/uploads/b1.webp", "title": "..." , "link_url": ""}],
  "highlights":  [{ "title": "原创设计", "desc": "..." }, { "title": "人体工程学", "desc": "..." }],
  "slogan":      { "title": "本然之美", "subtitle": "回归生活本质" },
  "products":    [{ "id": 12, "name": "胡桃木餐桌", "cover_url": "...", "category_name": "餐桌" }],
  "cases":       [{ "id": 3, "title": "上海徐汇平层", "cover_url": "...", "space_tags": ["客厅","餐厅"] }],
  "news":        [{ "id": 9, "title": "...", "publish_time": "2026.08.10", "category_name": "企业新闻" }]
}
```

#### 6.2.2 产品系列 `GET /api/categories`

**响应**：`[{ "id":1, "name":"餐桌","cover_url":null,"sort_order":1 }]`（仅启用）。

#### 6.2.3 产品列表 `GET /api/products`

**Query**：`category_id`(可选)、`keyword`(可选)、`sort=default|latest`(默认 default)、`page`、`page_size`(默认 12)。
**响应 items**：
```json
[{
  "id": 12, "name": "胡桃木餐桌", "category_name": "餐桌",
  "cover_url": "/static/uploads/p12.webp",
  "status": 1
}]
```

#### 6.2.4 产品详情 `GET /api/products/{id}`

**响应**：
```json
{
  "id":12,"name":"胡桃木餐桌","category_name":"餐桌",
  "status":1,
  "cover_url":"/static/...","images":["/static/...","/static/..."],
  "description":"<p>设计理念...</p>",
  "specs":[{"name":"材质","value":"胡桃木"},{"name":"尺寸","value":"1600×900×750"}],
  "same_series":[{ "id":13,"name":"胡桃木餐椅","cover_url":"..." }]
}
```

#### 6.2.5 案例列表 `GET /api/cases`

**Query**：`space_tag`(可选筛选)、`page`、`page_size`。响应含 `cover_url/title/space_tags`。

#### 6.2.6 案例详情 `GET /api/cases/{id}`

**响应**：`title, space_tags, city, area, finished_at, content(富文本), images[]`。

#### 6.2.7 新闻栏目 `GET /api/news/categories`

响应：`[{ "id":1,"name":"企业新闻"},{"id":2,"name":"行业资讯"}]`。

#### 6.2.8 新闻列表 `GET /api/news`

**Query**：`category_id`、`page`。仅返回 `is_published=1` 已发布（FR-34）；`publish_time` 格式化为 `YYYY.MM.DD`（FR-33）。

#### 6.2.9 新闻详情 `GET /api/news/{id}`

响应：`title, category_name, source, publish_time, content(富文本)`。

#### 6.2.10 职位列表 `GET /api/jobs`

**Query**：`category=1|2`（社会/校园）。仅 `status=1` 招聘中（FR-38）。响应卡片：`id,title,location,category,created_at,is_urgent`。

#### 6.2.11 职位详情 `GET /api/jobs/{id}`

响应：`title,location,job_type,salary_range,is_urgent,responsibility(富文本),requirement(富文本),contact`。

#### 6.2.12 单页内容 `GET /api/page/{content_type}`

`content_type` ∈ `about_stk | brand_intro | after_sales_policy`。响应：`title, content(富文本), cover_url`。

#### 6.2.13 发展历程 `GET /api/milestones`

响应：`[{ "year":"2018","title":"品牌创立","description":"..." }]`（按 `sort_order` 倒序）。

#### 6.2.14 FAQ `GET /api/faqs`

响应：`[{ "id":1,"category":null,"question":"...","answer":"<p>...</p>" }]`（仅启用）。

#### 6.2.15 门店 `GET /api/stores`

响应唯一上海旗舰店：`{ "name":"上海旗舰店","address":"...","phone":"...","business_hours":"...","city":"上海" }`（FR-53）。

#### 6.2.16 公共配置 `GET /api/config/public`

响应：`{ "contact": {"address":"...","phone":"...","email":"..."}, "footer": {"copyright":"© 2026 STK本然家居"} }`（FR-03 动态版权）。

#### 6.2.17 提交在线预约 `POST /api/appointments`（限流 5/min/IP）

**Body**：
```json
{ "name":"张三","phone":"13800000000","appointment_date":"2026-09-01 14:00","intention":"餐桌系列","remark":"希望看实木款" }
```
- 校验：姓名必填、手机号正则 `^1[3-9]\d{9}$`、隐私提示前端勾选（FR-43/44）。
- `store_name` 固定"上海旗舰店"（FR-43）；`status=0` 待处理（FR-46）。
- 成功：`{ "code":0,"message":"预约成功，我们将在 1-2 个工作日内与您联系" }`。

#### 6.2.18 提交在线留言 `POST /api/messages`（限流 5/min/IP）

**Body**：`{ "name","phone","email?"(格式校验),"content" }`。成功提示"留言成功，我们将尽快与您联系"（FR-49/50）。

#### 6.2.19 简历投递 `POST /api/jobs/{id}/apply`（限流 5/min/IP）

> 注：PRD §11.1 未单列此路径，本文档据 FR-37/BR-69 补全为独立资源接口，与职位关联更清晰。
**Body**（multipart/form-data）：`name*, phone*, email, resume*(PDF/Word ≤10MB), note`。
- 落库 `job_application`（`job_id` 关联，`status=0`）；成功提示"我们将在 1–3 个工作日内与您联系"（FR-37）。

#### 6.2.20 静态资源 `GET /static/uploads/*`

Nginx/FastAPI 静态托管上传图片。

### 6.3 后台接口（均需 JWT）

> `perm` 列标注权限点；未标注 `perm` 的表示仅需登录（如 dashboard、me）。

#### 6.3.1 认证

| 方法 | 路径 | perm | 说明 |
|------|------|------|------|
| POST | `/api/admin/auth/login` | — | Body `{username,password}`；返回 `{access_token, token_type:"bearer", user:{...}}`（BR-01） |
| GET | `/api/admin/auth/me` | — | 当前用户 + 权限点集合 |
| PUT | `/api/admin/auth/password` | — | `{old_password,new_password}`（BR-05，强度校验） |

登录失败连续 N 次限流（BR-02）；错误提示不泄露账号是否存在（NFR-06）。

#### 6.3.2 工作台 `GET /api/admin/dashboard`

响应：`{ products, cases, news, jobs, pending_appointments, pending_messages }`（BR-07/08）。

#### 6.3.3 产品系列

| 方法 | 路径 | perm | 说明 |
|------|------|------|------|
| GET | `/api/admin/categories` | `product:view` | 列表（筛选/搜索/分页） |
| POST | `/api/admin/categories` | `product:create` | 新增（BR-10） |
| PUT | `/api/admin/categories/{id}` | `product:edit` | 编辑 |
| DELETE | `/api/admin/categories/{id}` | `product:delete` | 删除；**有关联产品则 409 禁止**（BR-11） |

#### 6.3.4 产品

| 方法 | 路径 | perm | 说明 |
|------|------|------|------|
| GET | `/api/admin/products` | `product:view` | 列表（category/status 筛选、name 搜索） |
| POST | `/api/admin/products` | `product:create` | 新增（BR-15，图片 URL 由 upload 接口先传） |
| PUT | `/api/admin/products/{id}` | `product:edit` | 编辑 |
| DELETE | `/api/admin/products/{id}` | `product:delete` | 置为禁用（is_activate=0）（BR-17） |
| PUT | `/api/admin/products/{id}/status` | `product:status` | 上下架切换（BR-16） |

**新增/编辑 Body 示例**：
```json
{
  "category_id": 1, "name": "胡桃木餐桌", "series": "胡桃禮",
  "product_no": "STK-0001",
  "cover_url": "/static/uploads/p12.webp",
  "images": ["/static/uploads/p12a.webp"],
  "description": "<p>...</p>",
  "specs": [{"name":"材质","value":"胡桃木"}],
  "is_top": 1, "sort_order": 1, "status": 1
}
```

#### 6.3.5 案例

`GET/POST /api/admin/cases`、`PUT/DELETE /api/admin/cases/{id}`（perm `case:view/create/edit/delete`）；`PUT /api/admin/cases/{id}/status` 发布/下线（BR-23）。Body 含 `space_tags[]`、`city/area/finished_at`、富文本 `content`、`images[]`。

#### 6.3.6 新闻栏目 / 文章

- 栏目：`GET/POST /api/admin/news/categories`、`PUT/DELETE /api/admin/news/categories/{id}`（perm `news:*`）；删除有文章则 409（BR-28）。
- 文章：`GET/POST /api/admin/news`、`PUT/DELETE /api/admin/news/{id}`（BR-29~33）；`status` 草稿/已发布（BR-31）。

#### 6.3.7 招聘职位 / 简历投递

- 职位：`GET/POST /api/admin/jobs`、`PUT/DELETE /api/admin/jobs/{id}`（perm `recruit:*`）；`PUT .../status` 招聘中/已关闭（BR-36）。Body 含 `category,location(默认上海),job_type,salary_range,is_urgent,responsibility,requirement,contact`。
- 简历投递：`GET /api/admin/job-applications`（筛选 status/job、搜索 name/phone）、`GET/PUT /api/admin/job-applications/{id}`（详情/状态流转 BR-71）、`GET /api/admin/exports/job-applications`（导出 BR-72）。

#### 6.3.8 单页内容 / 历程 / FAQ

- 单页：`GET/PUT /api/admin/pages/{content_type}`（perm `content:*`；BR-39）。
- 历程：`GET/POST /api/admin/milestones`、`PUT/DELETE /api/admin/milestones/{id}`（BR-40）。
- FAQ：`GET/POST /api/admin/faqs`、`PUT/DELETE /api/admin/faqs/{id}`（BR-41）；`status` 启用/停用。

#### 6.3.9 门店 / 轮播 / 配置

- 门店：`GET /api/admin/stores`、`PUT /api/admin/stores/{id}`（单店，不开放新增/删除，BR-43~46）。
- 轮播：`GET/POST /api/admin/banners`、`PUT/DELETE /api/admin/banners/{id}`、`PUT .../status`（BR-47~50）。
- 配置：`GET/PUT /api/admin/config`（品牌标语、亮点文案、联系信息，BR-51/42）。

#### 6.3.10 留资管理

- 预约：`GET /api/admin/appointments`（status/时间筛选、name/phone 搜索）、`GET /api/admin/appointments/{id}`、`PUT /api/admin/appointments/{id}/status`（待处理→已联系→已到店→已关闭，可回退 BR-54）、`GET /api/admin/exports/appointments`（BR-52~56）。
- 留言：`GET /api/admin/messages`、`PUT /api/admin/messages/{id}/status`（待处理→已处理 BR-59）、`GET /api/admin/exports/messages`（BR-57~60）。

#### 6.3.11 文件上传 `POST /api/admin/upload`（perm `upload` 或随模块）

`multipart/form-data` 字段 `file`；校验类型 jpg/png/webp、≤5MB；返回 `{ "url":"/static/uploads/uuid.webp" }`（BR-19/NFR-09）。

#### 6.3.12 系统管理（仅超管）

| 方法 | 路径 | perm | 说明 |
|------|------|------|------|
| GET/POST | `/api/admin/users` | `system:user` | 用户列表/新增（BR-61） |
| PUT/DELETE | `/api/admin/users/{id}` | `system:user` | 编辑/禁用(is_activate=0)/重置密码 |
| GET/PUT | `/api/admin/roles` | `system:role` | 角色列表/权限点配置（BR-62） |
| GET | `/api/admin/logs` | `system:log` | 操作日志查询（分页筛选，只读 BR-63） |

#### 6.3.13 接口-权限矩阵（节选）

| 模块 | 权限点 | 超级管理员 | 内容编辑 |
|------|--------|-----------|---------|
| 产品 | `product:*` | ✅ | ✅ |
| 案例 | `case:*` | ✅ | ✅ |
| 新闻 | `news:*` | ✅ | ✅ |
| 招聘 | `recruit:*` | ✅ | ✅ |
| 内容 | `content:*` | ✅ | ✅ |
| 首页配置 | `home:*` | ✅ | ✅ |
| 留资 | `lead:*` | ✅ | ✅ |
| 系统 | `system:user/role/log` | ✅ | ❌（不可见） |

> 内容编辑访问系统管理接口返回 `40300`（验收 §16.2-1）。

---

## 7. 关键模块实现指引

### 7.1 鉴权与 RBAC（ADR-003）

- **Token**：登录成功签发 JWT（HS256），payload 含 `sub=user_id`、`role_id`、`exp`。
- **依赖链**：`get_current_user`（解析+查库+激活状态校验 `is_activate=1`）→ `require_perm(code)`（查 `sys_role_permission` 关联，校验 code 是否在用户权限集合）。
- **权限集合构建**：用户 → `role_id` → `sys_role_permission` → `sys_permission.perm_code`，缓存于 token 或请求级（避免每次查库，可加短缓存）。
- **前端显隐**：`/me` 返回权限点，前端做菜单/按钮隐藏；**服务端为唯一权威**（NFR-07）。
- **强制改密**：`must_change_pwd=true` 时仅允许访问 `PUT /auth/password`（BR-06）。

### 7.2 富文本与 XSS（NFR-08 / R2）

- 入库：`clean_html()`（bleach 白名单）清洗所有富文本字段。
- 出库：返回已清洗 HTML；前端用 `dangerouslySetInnerHTML` 渲染时确保内容来自后端清洗结果，并对动态拼接部分做转义。
- 白名单标签：`p,br,b,i,em,strong,ul,ol,li,a,img,blockquote,h2,h3,span`；属性仅 `a[href]`、`img[src,alt]`；`href` 必须 `http(s)://` 或相对路径。

### 7.3 留资限流（NFR-11 / R3）

- 使用 `slowapi` 或 Redis 令牌桶；键 = `ip + path`，窗口 60s，阈值 5（§1.3.5）。
- 超限返回 `42900`；前端按钮置灰 + 倒计时提示。
- 后台可按 `phone` 查重（R3 补充），避免同一号码刷量。

### 7.4 状态机（预约 / 留言 / 简历）

**预约状态机**（BR-54，支持回退）

```mermaid
stateDiagram-v2
    [*] --> 待处理 : 提交
    待处理 --> 已联系 : 运营跟进
    已联系 --> 已到店 : 到店参观
    已联系 --> 已关闭 : 放弃
    已到店 --> 已关闭 : 结束
    已联系 --> 待处理 : 回退
```

**留言状态机**（BR-59）

```mermaid
stateDiagram-v2
    [*] --> 待处理 : 提交
    待处理 --> 已处理 : 处理完成
```

**简历投递状态机**（BR-71，支持回退）

```mermaid
stateDiagram-v2
    [*] --> 待处理 : 投递
    待处理 --> 已联系 : 跟进
    已联系 --> 已淘汰 : 不合适
    已联系 --> 已录用 : 录用
    已联系 --> 待处理 : 回退
```

- 预约：`0待处理→1已联系→2已到店→3已关闭`，支持回退（BR-54）。
- 留言：`0待处理→1已处理`（BR-59）。
- 简历：`0待处理→1已联系→2已淘汰 / 3已录用`，支持回退（BR-71）。
- 状态流转统一在 Service 层做合法性校验（禁止跨越非法跃迁），并写操作日志（BR-63）。

### 7.5 图片上传与处理（NFR-05 / BR-19）

- 上传组件（前后台统一）：选择 → 客户端预览 → 上传 `/admin/upload` → 回显 URL → 支持删除（仅移除引用，文件保留或软删）。
- 服务端：类型白名单、大小校验、随机文件名、写入 `UPLOAD_DIR`；异步压缩转 WebP，首页大图 ≤300KB（NFR-05）。
- 存储抽象（ADR-002）：`LocalStorageBackend` 默认；后续 `OssStorageBackend` 实现同一接口，切换不改业务。

### 7.6 导出（BR-56/60/72）

- `GET /api/admin/exports/*`：服务端按筛选条件查询 → 生成 CSV（默认）/ Excel（`openpyxl`）→ 流式返回 `text/csv` 或 `application/vnd.openpyxl`。
- 导出动作写操作日志（BR-63）。

---

## 8. 非功能需求落地

| NFR | 落地方案 |
|-----|---------|
| NFR-01 首屏<3s | 路由分包、图片懒加载（IntersectionObserver）、WebP 压缩、CDN/OSS 预案 |
| NFR-02/03 接口 P95 | 索引覆盖、分页查询、避免 N+1（SQLAlchemy `joinedload`/`selectinload`）；列表字段投影 |
| NFR-04 100 并发 | PostgreSQL 连接池（`pool_size`）、FastAPI 异步；SQLite 仅开发用 |
| NFR-05 大图优化 | 上传压缩/转 WebP，单图 ≤300KB（§7.5） |
| NFR-06 认证安全 | JWT + bcrypt + 登录限流 + 不泄露账号存在 |
| NFR-07 权限安全 | 服务端 `require_perm` 强制校验（§7.1） |
| NFR-08 输入安全 | Pydantic 校验、ORM 参数化（防注入）、富文本清洗（§7.2） |
| NFR-09 上传安全 | 类型白名单、大小限制、随机名、禁执行文件 |
| NFR-10 隐私合规 | 表单隐私提示、最小化收集、内部使用（PRD §8.7） |
| NFR-11 接口限流 | §7.3 |
| NFR-12 传输安全 | 生产 HTTPS（Nginx 终止） |
| NFR-13/14 兼容/响应式 | Chrome/Edge/FF/Safari 近两版；断点 768/1024（§4.1） |
| NFR-15 可访问性 | alt、语义化、焦点环、aria-label（UI-UX §11） |
| NFR-16 容错 | 骨架屏/重试/空状态，不白屏 |
| NFR-17 代码规范 | ESLint+Prettier / Ruff+Black；提交规范 |
| NFR-18 API 文档 | FastAPI 自动 Swagger `/docs` |
| NFR-19 日志 | 访问/错误日志落盘 + 操作日志表 |
| NFR-20 备份 | 生产 `pg_dump` 每日定时 + 保留 N 天（Docker 定时任务） |
| NFR-21/22/23 部署 | Docker Compose（nginx+web+admin+api+pg）；dev/prod `.env`；`docker compose up -d` |

---

## 9. 开发流程与里程碑

### 9.1 工程流程

1. **环境搭建（M1）**：初始化 `backend/web/admin` 三个工程；`docker-compose` 起 PostgreSQL；Alembic 初始迁移；`seed.py` 注入数据；登录链路打通。
2. **分支策略**：`main`（保护）/ `dev`（集成分支）/ `feature/*`；PR 需 review + CI（lint+type+test）通过。
3. **开发顺序**（沿用 PRD M1–M7，后端先行）：
   - M1 骨架+认证；M2 后台产品/新闻/内容/轮播；M3 案例/招聘/门店/FAQ/历程/留资/导出；M4 前台核心（首页/产品/案例/新闻）；M5 前台扩展（招聘/关于我们/联系/服务）；M6 系统管理（用户/角色/日志）；M7 联调+上线。
   - M2~M3 与 M4~M5 可并行（后端先行产出接口，前端并行联调）。
4. **联调**：前端 proxy 指向后端；按 §6 逐接口核对；Swagger 为事实源。
5. **走查**：UI-UX §13 验收清单（视觉/组件/响应式/无障碍）。
6. **上线**：`docker compose up -d`；HTTPS；备份任务；数据初始化。

> 合计约 9 周（2 人团队，PRD §14）。

### 9.2 风险应对（承接 PRD §15）

- R1 素材不足：后台预留占位图/占位文案机制。
- R2 XSS：服务端清洗 + 前端转义（§7.2）。
- R3 刷单：限流 + 按 phone 查重（§7.3）。
- R4 并发：索引优化 + OSS 迁移预案（ADR-002）。
- R5 需求变更：内容模型按 `content_type`/可新增栏目扩展（§5.3）。
- R6 地图合规：腾讯/高德标准 iframe（FR-48）。
- R7 个人信息合规：隐私提示 + 最小化收集 + 仅内部使用（§1.3.6/PRD §8.7）。

---

## 10. 附录

### 10.1 ADR 决策记录

#### ADR-001：双库切换（开发 SQLite / 生产 PostgreSQL）

- **状态**：Accepted
- **上下文**：开发期需零配置启动；生产需高并发与强一致。
- **决策**：通过 `DATABASE_URL` 环境变量切换；ORM 统一使用跨库通用类型；SQL 全由 ORM 生成。
- **后果**：业务代码零改动切换；SQLite 不支持部分 PG 特性（如原生 JSON 函数），故避免在查询中依赖方言函数。

#### ADR-002：文件存储抽象层预留 OSS

- **状态**：Accepted
- **上下文**：本期本地存储简单，但运营期需 CDN/OSS 降本提速。
- **决策**：定义 `StorageBackend` 接口（`save/delete/url`）；默认 `LocalStorageBackend`；后续新增 `OssStorageBackend` 不改业务。
- **后果**：当前多一处抽象成本；未来迁移平滑。

#### ADR-003：RBAC 角色-权限点模型

- **状态**：Accepted
- **上下文**：需区分超管与内容编辑，并预留更多角色（如招聘专员）。
- **决策**：用户→角色→权限点（`sys_permission.perm_code`）；服务端 `require_perm` 强制校验。
- **后果**：权限粒度细、可扩展；新增角色仅配权限点，无需改接口。

#### ADR-004：状态字段与禁用策略（原“软删除”）

- **状态**：Accepted
- **上下文**：留资/内容数据需可追溯，误删可恢复；统一以状态位控制可见性，避免物理删除。
- **决策**：业务表统一 `is_activate`（1激活/0禁用）；“禁用”等效于软删除，查询默认 `is_activate=1`；物理删除仅用于无关联的配置类（如 `sys_config`）。公共字段（创建人/创建时间/修改人/修改时间）由 mixin 统一注入。
- **后果**：数据可追溯、可恢复；查询基类默认应用 `is_activate=1` 过滤；与数据库设计文档 §1 公共字段约定完全一致。

### 10.2 术语表

| 术语 | 含义 |
|------|------|
| C端/B端 | 消费者 / 企业客户 |
| 留资 | 收集客户联系信息（预约/留言/简历） |
| perm_code | 权限点编码，如 `product:edit` |
| 状态字段 is_activate | 1激活/0禁用；禁用等效软删除，查询默认 `is_activate=1` |
| DDL | 数据库定义语言（建表语句） |

### 10.3 接口清单速查

- **前台公开**：`/api/home`、`/api/categories`、`/api/products[/{id}]`、`/api/cases[/{id}]`、`/api/news/categories`、`/api/news[/{id}]`、`/api/jobs[/{id}]`、`/api/page/{type}`、`/api/milestones`、`/api/faqs`、`/api/stores`、`/api/config/public`、`POST /api/appointments`、`POST /api/messages`、`POST /api/jobs/{id}/apply`、`/static/uploads/*`。
- **后台**：`/admin/auth/{login,me,password}`、`/admin/dashboard`、`/admin/categories[/{id}]`、`/admin/products[/{id}][/status]`、`/admin/cases[/{id}][/status]`、`/admin/news/categories[/{id}]`、`/admin/news[/{id}]`、`/admin/jobs[/{id}][/status]`、`/admin/job-applications[/{id}]`、`/admin/pages/{type}`、`/admin/milestones[/{id}]`、`/admin/faqs[/{id}]`、`/admin/stores[/{id}]`、`/admin/banners[/{id}][/status]`、`/admin/config`、`/admin/appointments[/{id}][/status]`、`/admin/messages[/{id}/status]`、`/admin/exports/{appointments,messages,job-applications}`、`/admin/upload`、`/admin/users[/{id}]`、`/admin/roles`、`/admin/logs`。

---

*本文档 V1.2，依据 PRD V1.9 与 UI-UX V1.0 撰写。后续随实现演进以变更记录更新。*
