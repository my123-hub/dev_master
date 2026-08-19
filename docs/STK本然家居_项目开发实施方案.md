# STK本然家居 项目开发实施方案

| 文档信息 | 内容 |
|---------|------|
| 文档名称 | STK本然家居企业官网 项目开发实施方案 |
| 版本 | V1.0 |
| 文档状态 | V1.0（2026-08-19 依据 PRD V1.9 + UI-UX V1.0 + 数据库设计 V1.3 + 开发技术文档 V1.2 编制） |
| 编制依据 | `STK本然家居企业官网PRD.md`（V1.9）、`STK本然家居_UI-UX设计规范.md`（V1.0）、`STK本然家居_数据库设计文档.md`（V1.3）、`STK本然家居_开发技术文档.md`（V1.2） |
| 页面基线 | `STK本然家居_官网原型.html`（前台）、`STK本然家居_后台管理系统原型.html`（后台）——以原型实现为准（UI-UX §1 文档说明） |
| 技术栈 | 后端 FastAPI + SQLAlchemy 2.0 + Alembic；开发 SQLite / 生产 PostgreSQL；前台 React+TS+Vite+Tailwind；后台 React+TS+Vite+AntD 5 |
| 部署 | Docker Compose（nginx + web + admin + api + postgres） |
| 总工期 | 约 9 周（2 人团队），按 PRD §14 里程碑 |

---

## 目录

1. [方案概述](#1-方案概述)
2. [总体实施策略](#2-总体实施策略)
3. [里程碑与任务拆解（M1~M7）](#3-里程碑与任务拆解m1m7)
4. [后端实施要点](#4-后端实施要点)
5. [前端实施要点](#5-前端实施要点)
6. [部署实施方案](#6-部署实施方案)
7. [测试与验收方案](#7-测试与验收方案)
8. [风险与应对](#8-风险与应对)
9. [待确认事项](#9-待确认事项)
10. [执行确认机制与后续安排](#10-执行确认机制与后续安排)

---

## 1. 方案概述

### 1.1 编制依据与职责边界

| 文档 | 版本 | 方案中的职责 |
|------|------|-------------|
| PRD | V1.9 | 功能需求（FR-01~57、BR-01~72）、信息架构、验收标准——**功能以 PRD 为准** |
| UI-UX 设计规范 | V1.0 | 设计令牌、前后台组件库、页面级规范、交互动效、响应式、无障碍——**视觉以 UI-UX 为准** |
| 数据库设计文档 | V1.3 | 21 张表的数据字典、建表 SQL、种子、迁移、双库切换——**数据库以本文档为准** |
| 开发技术文档 | V1.2 | 工程目录、分层规范、接口设计（§6）、关键模块实现（§7）、里程碑（§9） |
| 官网原型 HTML | — | 前台页面效果的事实基线（UI-UX 已提炼锚点 `#L行号`） |
| 后台原型 HTML | — | 后台页面效果的事实基线（UI-UX 已提炼锚点） |

> 冲突裁定：PRD 与原型不一致时以原型实现为准并在 UI-UX 附录 B 标注；本文档不重新定义需求，只编排可执行实施。

### 1.2 实施目标

按 PRD §2 项目目标落地，本期交付两套子系统：

1. **前台展示系统（web）**：首页、产品中心/详情、新案例、新闻（企业新闻/行业资讯）、招聘入口（社会/校园 + 投递简历）、关于我们（关于STK/发展历程/品牌介绍/在线预约/联系我们）、服务支持（售后政策/FAQ）；无在线商城、无登录体系、不做 SEO（PRD §3.2 非目标）。
2. **后台管理系统（admin）**：登录与 RBAC、工作台、产品管理、案例管理、新闻管理、招聘管理（含简历投递）、内容管理、门店管理（单店）、首页配置、留资管理（预约/留言）、系统管理（用户/角色/日志/改密）。

### 1.3 核心实施原则

| 编号 | 原则 | 说明 |
|------|------|------|
| P1 | 内容驱动 | 前台所有展示内容由后台维护，运营自助更新（PRD §1.3） |
| P2 | 双库无缝 | 开发 SQLite / 生产 PostgreSQL，仅改 `DATABASE_URL`，业务代码无感知（ADR-001） |
| P3 | 原型优先 | 页面效果以两份高保真原型 + UI-UX 规范为基线 |
| P4 | 阶段门禁 | 按 M1~M7 分阶段交付，每阶段完成并验证后**等待用户确认再进入下一阶段** |
| P5 | 服务端权威 | 权限点在服务端强制校验（NFR-07），前端仅隐藏入口 |
| P6 | 数据可追溯 | 统一 `is_activate`（1激活/0禁用）禁用等效软删除，查询默认 `is_activate=1`（ADR-004） |

---

## 2. 总体实施策略

### 2.1 阶段门禁式推进流程

```mermaid
flowchart TD
    A[阶段门禁: 每阶段完成 → 自测验证 → 提交交付说明] --> B{用户回复<br>已确认，执行下一步?}
    B -- 否/需修改 --> A
    B -- 是 --> C[进入下一阶段]
    C --> A
```

- 每个里程碑完成后：交付物落盘 + 运行验证报告（dev tools / headless Chrome 端到端验证）。
- **未获得用户"已确认，执行下一步"回复前，不擅自进入下一阶段**。
- 待确认事项（§9）未决前，涉及项先按"推荐默认值"实施并在交付说明中标注。

### 2.2 技术栈基线（承接 PRD §4 / 开发技术文档 §2）

| 层次 | 选型 | 关键约束 |
|------|------|---------|
| 前台 | React 18 + TS + Vite 5 + Tailwind 3 + React Router v6 | 状态 Context/Zustand；不引入 Redux |
| 后台 | React 18 + TS + Vite 5 + AntD 5 | 富文本 wangEditor；图标 Lucide/Heroicons SVG |
| 后端 | FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2 | 统一响应 `{code,message,data}`；全局异常处理 |
| 认证 | JWT（HS256）+ bcrypt | access token 7 天（BR-04）；`must_change_pwd` 强制改密 |
| 数据库 | SQLite（开发）/ PostgreSQL 16+（生产） | 跨库通用类型，ORM 生成 SQL，不写方言 |
| 文件 | 本地 `uploads/` + `StorageBackend` 抽象 | 图片 jpg/png/webp ≤5MB；简历 PDF/Word ≤10MB |
| 限流 | slowapi（或 Redis 令牌桶） | 前台留资 5/min/IP；登录失败 N 次限流 |

### 2.3 工程目录（承接开发技术文档 §2.4）

```
stk-home/
├── backend/          # FastAPI：app/(main|core|db|models|schemas|routers|services|utils) + alembic + scripts/seed.py + uploads/
├── web/              # 前台：React+TS+Vite+Tailwind（api/components/pages/hooks/store/styles/router）
├── admin/            # 后台：React+TS+Vite+AntD（api/layout/pages/components/router）
├── nginx/nginx.conf  # SPA 路由 + /api 反代 + 静态托管
└── docker-compose.yml
```

> 工程根目录命名为 `stk-home/`，创建于 `D:/学习/jiaju/dev_master/` 下，与现有 docs/static 目录并行。

### 2.4 环境与配置管理（NFR-22）

| 项 | 开发（.env） | 生产（.env.prod） |
|----|-------------|------------------|
| DATABASE_URL | `sqlite:///./app.db` | `postgresql://user:pass@host:5432/stk_db` |
| JWT_SECRET | 本地随机 | 生产强随机 |
| UPLOAD_DIR | `uploads` | 挂载 volume |
| CORS_ORIGINS | `http://localhost:5173`(web) / `5174`(admin) | 同域（Nginx 托管，无需 CORS） |
| 运行方式 | 本机 `uvicorn --reload` + `vite dev` | Docker Compose |

> 开发期建议直接本机运行（SQLite 零配置），Docker Compose 用于生产联调与上线（NFR-21/23）。

---

## 3. 里程碑与任务拆解（M1~M7）

> 工期承接 PRD §14（约 9 周，2 人团队）；M2~M3 与 M4~M5 可部分并行（后端先行）。

### 3.1 M1 项目搭建（约 1 周）

**目标**：可运行骨架 + 登录链路打通。

| 编号 | 任务 | 依据 | 交付物/验证 |
|------|------|------|------------|
| M1-1 | 初始化 `backend/web/admin` 三工程 + 依赖 + ESLint/Prettier/Ruff/Black | 开发技术文档 §2.4、NFR-17 | 三工程可启动 |
| M1-2 | 后端分层骨架（core/db/models/schemas/routers/services/utils） | 开发技术文档 §3.1 | 目录规范落地 |
| M1-3 | SQLAlchemy 21 张表模型（Base + CommonMixin 公共字段） | 数据库设计文档 §3、§5.3 | 模型与数据字典一致 |
| M1-4 | Alembic 初始迁移 `init schema`（双库兼容） | 数据库设计文档 §5.2、开发技术文档 §3.3 | `alembic upgrade head` 成功 |
| M1-5 | 种子脚本 `scripts/seed.py`：角色/权限/部门/超管/栏目/单店/配置/单页模板 | 数据库设计文档 §5.1 | 种子注入成功 |
| M1-6 | JWT 认证 + bcrypt + 登录接口 + 强制改密拦截 + 登录限流 | BR-01~06、开发技术文档 §7.1 | 登录/改密/401 流程可用 |
| M1-7 | 统一响应/异常处理/错误码 | 开发技术文档 §1.3 | Swagger `/docs` 可用 |

### 3.2 M2 后台基础模块（约 2 周）

**目标**：产品、新闻、内容、首页配置后台 CRUD 可用。

| 编号 | 任务 | 依据 | 交付物/验证 |
|------|------|------|------------|
| M2-1 | 产品系列管理（列表/新增/编辑/删除保护/排序） | BR-09~12 | 系列 CRUD + 有产品禁删 |
| M2-2 | 产品管理（图集多图/富文本/动态规格参数/上下架/软删除/首页推荐 is_top） | BR-13~20、BR-15 无价格字段（PRD V1.9） | 产品 CRUD + 上下架 |
| M2-3 | 新闻栏目 + 文章管理（草稿/发布/置顶/发布时间） | BR-26~33 | 栏目/文章 CRUD |
| M2-4 | 内容管理：单页（关于STK/品牌/售后）、发展历程、FAQ、联系信息 | BR-39~42 | 单页富文本可编辑 |
| M2-5 | 首页配置：轮播管理 + 品牌标语/亮点文案（sys_config） | BR-47~51 | 轮播 CRUD + 配置保存 |
| M2-6 | 统一上传组件（类型/大小/随机名/回显） | BR-19、NFR-09 | 图片上传可用 |
| M2-7 | 统一富文本组件（wangEditor）接入各编辑表单 | UI-UX §13.2 | 编辑表单富文本可用 |
| M2-8 | 后台前端骨架：手风琴二级导航 + 布局 + 请求层 + 权限入口 | UI-UX §6、开发技术文档 §4.2 | 导航/布局按原型呈现 |

### 3.3 M3 后台扩展模块（约 1 周）

**目标**：案例、招聘、门店、留资、导出等后台模块全部可用。

| 编号 | 任务 | 依据 | 交付物/验证 |
|------|------|------|------------|
| M3-1 | 案例管理（空间标签/项目信息/富文本/图集/发布状态） | BR-21~25 | 案例 CRUD + 状态控制 |
| M3-2 | 招聘职位管理（分类/地点默认上海/急招/富文本/投递邮箱） | BR-34~38 | 职位 CRUD + 状态控制 |
| M3-3 | 简历投递管理（列表/详情/附件下载/状态流转/删除） | BR-69~72 | 投递管理闭环 |
| M3-4 | 门店管理（单店编辑，不开放新增/删除） | BR-43~46 | 单店信息可编辑 |
| M3-5 | 留资管理：预约（状态流转可回退/筛选/详情/导出）+ 留言（标记处理/删除/导出） | BR-52~60 | 留资闭环 + 导出 |
| M3-6 | 导出服务（CSV/Excel） | 开发技术文档 §7.6 | 导出文件可下载 |

### 3.4 M4 前台核心页面（约 2 周）

**目标**：首页、产品、案例、新闻前台可用（后端接口先行）。

| 编号 | 任务 | 依据 | 交付物/验证 |
|------|------|------|------------|
| M4-1 | 前台工程骨架：设计令牌（tailwind.config）+ 全局样式 + 请求层 + 路由分包 | UI-UX §2.1、§3、开发技术文档 §4.1 | 令牌/路由落地 |
| M4-2 | 全局组件：浮动导航（含下拉/CTA/汉堡）、页脚（门店信息+动态版权）、骨架屏、空状态、404 | FR-01~07、UI-UX §3.2/§3.3 | 导航/页脚按原型 |
| M4-3 | 首页聚合（轮播/标语/亮点/精选产品/精选案例/最新新闻/预约CTA） | FR-08~15、接口 `GET /api/home` | 首页模块完整 |
| M4-4 | 产品中心：系列筛选/搜索/卡片（价格面议）/分页/排序/空状态 | FR-16~21 | 产品列表页 |
| M4-5 | 产品详情：图集切换/富文本描述/规格参数表/同系列推荐 | FR-22~26 | 产品详情页 |
| M4-6 | 新案例：列表（标签筛选/分页）+ 详情（项目信息/图集） | FR-27~29 | 案例页 |
| M4-7 | 新闻：栏目 Tab + 列表 + 详情（日期 YYYY.MM.DD） | FR-30~34 | 新闻页 |
| M4-8 | 图片懒加载（IntersectionObserver）+ 响应式三端适配 | FR-05、FR-55、NFR-01/14 | 性能与适配达标 |

### 3.5 M5 前台扩展页面（约 1 周）

**目标**：招聘、关于我们（含预约/留言表单）、服务支持全部完成。

| 编号 | 任务 | 依据 | 交付物/验证 |
|------|------|------|------------|
| M5-1 | 招聘：分类 Tab + 职位卡片（急招标签）+ 职位详情 | FR-35~38 | 招聘页 |
| M5-2 | 投递简历表单（姓名*/电话*/邮箱/附件* PDF·Word≤10MB/自我推荐）+ 成功反馈 | FR-37、`POST /api/jobs/{id}/apply` | 投递闭环落库 |
| M5-3 | 关于我们：关于STK（富文本）/发展历程（时间轴）/品牌介绍 | FR-39~41 | 三个内容页 |
| M5-4 | 在线预约表单（姓名*/电话*手机号校验/时间/意向/备注，无门店选择）+ 隐私提示 + 成功提示 | FR-43~46、合规提示 | 预约闭环落库 |
| M5-5 | 联系我们：联系信息 + 地图 iframe + 留言表单 + 隐私提示 | FR-47~50 | 联系页 + 留言闭环 |
| M5-6 | 服务支持：售后政策（富文本）+ FAQ（手风琴） | FR-51~52 | 服务支持页 |

### 3.6 M6 系统管理（约 1 周）

**目标**：用户、角色权限、操作日志体系完整。

| 编号 | 任务 | 依据 | 交付物/验证 |
|------|------|------|------------|
| M6-1 | 用户管理（列表/新增/停用启用/重置密码） | BR-61 | 用户管理可用 |
| M6-2 | 角色管理 + 权限点配置（勾选式，服务端强制） | BR-62、NFR-07 | RBAC 配置可用 |
| M6-3 | 操作日志（关键操作自动记录 + 分页查询，只读） | BR-63 | 日志查询可用 |
| M6-4 | 权限点全量清单（按菜单/功能拆分，种子数据固化） | 开发技术文档 §6.3.13、数据库设计文档 §5.1 | 权限矩阵一致 |

### 3.7 M7 联调与上线（约 1 周）

**目标**：端到端联调、走查、部署上线。

| 编号 | 任务 | 依据 | 交付物/验证 |
|------|------|------|------------|
| M7-1 | 前后端全量接口联调（Swagger 为事实源） | 开发技术文档 §6 | 接口全部打通 |
| M7-2 | UI 走查（视觉/组件/响应式/无障碍） | UI-UX §13 验收清单 | 走查问题清零 |
| M7-3 | 性能与安全检查（首屏<3s、XSS、上传、限流） | NFR-01~12 | 检查项通过 |
| M7-4 | 数据初始化（正式素材替换占位、种子重跑） | 数据库设计文档 §5.1 | 正式数据就绪 |
| M7-5 | Docker Compose 一键部署 + HTTPS + 每日备份任务 | NFR-20/21/23 | `docker compose up -d` 上线 |

---

## 4. 后端实施要点

### 4.1 分层与编码规范（开发技术文档 §3.1）

- 依赖单向：Router → Service → Model；Schema 作为数据契约在层间传递；**禁止 Router 写 SQL/业务逻辑**。
- 代码规范 Ruff/Black（NFR-17）；接口自动生成 Swagger `/docs`（NFR-18）。
- 全局异常处理：Pydantic 校验 40000 / JWT 40100 / 权限 40300 / 不存在 40400 / 冲突 40900 / 上传 41300 / 限流 42900 / 内部 50000（开发技术文档 §1.3.2）。

### 4.2 数据库实施（以数据库设计文档 V1.3 为准）

| 项 | 实施方式 |
|----|---------|
| 模型 | 21 张表按 §3 数据字典建 SQLAlchemy 模型，统一继承 `Base + CommonMixin`（id/is_activate/created_at创建人/created_date/updated_at修改人/updated_date） |
| JSON 字段 | `specs`/`images`/`space_tags` 用 SQLAlchemy `JSON` 类型（SQLite 存 TEXT、PG 原生 JSONB） |
| 迁移 | Alembic：`alembic init` → 配置 `DATABASE_URL` + `target_metadata` → 初始迁移 `init schema` → `upgrade head`；变更走 autogenerate + 人工复核 |
| 索引 | 按 §5.5 索引策略：外键、status/is_published、sort_order、publish_time、phone 全覆盖 |
| 种子 | `scripts/seed.py`：super_admin/content_editor 角色 + 权限点 + 部门树 + 初始超管（must_change_pwd=TRUE）+ 新闻双栏目 + 上海旗舰店单条 + sys_config 初始键值 + page_content 空模板（§5.1） |
| 查询约定 | 所有列表/详情默认 `WHERE is_activate = 1`；物理删除仅用于 sys_operation_log 等追加型表 |

### 4.3 认证与 RBAC（ADR-003）

1. 登录签发 JWT（HS256），payload：`sub=user_id`、`role_id`、`exp`；access token 有效期 7 天（BR-04）。
2. 依赖链：`get_current_user`（解析 + 查库 + `is_activate=1` 校验）→ `require_perm(perm_code)`（经 sys_role_permission → sys_permission 解析权限集合）。
3. 权限集合请求级缓存，避免每次查库；`/api/admin/*` 默认 `get_current_user`，写操作附加 `require_perm`。
4. `must_change_pwd=true` 时仅放行 `PUT /auth/password`（BR-06）。
5. 登录失败提示不泄露账号是否存在；连续失败 N 次限流（BR-02）。

### 4.4 接口实现顺序

**后台先行**（M1~M3 交付后台接口）→ **前台消费**（M4~M5）：

- 认证 3 个 → 工作台 → 系列/产品 → 新闻栏目/文章 → 单页/历程/FAQ → 门店/轮播/配置 → 案例 → 职位/简历投递 → 预约/留言/导出 → 上传 → 用户/角色/日志。
- 前台公开接口（开发技术文档 §6.2）：home / categories / products / cases / news / jobs / page / milestones / faqs / stores / config/public / appointments / messages / jobs/{id}/apply / static。

### 4.5 关键模块实现要点

| 模块 | 要点 |
|------|------|
| 富文本 XSS | 入库 `clean_html()`（bleach 白名单：p/br/b/i/em/strong/ul/ol/li/a/img/blockquote/h2/h3/span；仅 a[href]、img[src,alt]；剔除 on* 与 javascript:） |
| 图片上传 | `/api/admin/upload`：jpg/png/webp、≤5MB、uuid 随机名、写入 uploads/；异步压缩转 WebP（首页大图≤300KB） |
| 简历上传 | 随 `POST /api/jobs/{id}/apply` multipart 一并提交（开发技术文档 §6.2.19）：PDF/Word ≤10MB，落库 `resume_url` |
| 留资限流 | 前台提交接口 5/min/IP（slowapi），超限 42900；后台支持按 phone 查重 |
| 状态机 | 预约 0→1→2→3（可回退）；留言 0→1；简历 0→1→2/3（可回退）；Service 层校验非法跃迁并写操作日志 |
| 导出 | `/api/admin/exports/*`：按筛选查询 → CSV（默认）/Excel（openpyxl）→ 流式返回；导出写操作日志 |
| 存储抽象 | `StorageBackend`（save/delete/url）接口，本地默认，预留 OSS（ADR-002） |

---

## 5. 前端实施要点

### 5.1 前台 web（React + TS + Vite + Tailwind）

- **设计令牌**：`tailwind.config.js` 注入 ink `#0F3D2E` / inklt `#6FA088` / cream `#FAF8F5` / mist `#F4F7F5` / weak `#9E9E9E`、`shadow-soft`、圆角、`tracking-title`（UI-UX §2.1）。
- **全局样式**：字体栈、`.ph` 墨绿渐变占位、`.img-zoom`（hover scale≤1.05）、可见焦点环（补齐 UI-UX 附录 B 高优先级项）。
- **组件库**：Button / Card / Carousel（箭头无圆圈、reset() 复位）/ Tab（下划线）/ Pagination / Breadcrumb / Skeleton / Empty / Form（UI-UX §4）。
- **路由**（`React.lazy` 分包）：home / products / product-detail / cases / case-detail / news / news-detail / jobs / job-detail / about-stk / timeline / brand / appointment / contact / policy / faq（UI-UX §5）。
- **请求层**：Axios 封装 baseURL `/api`、统一解包、错误 toast、提交防重复；Vite proxy `/api → localhost:8000`。
- **状态管理**：Context（联系信息缓存）+ Zustand（可选，如预约草稿）；不引入 Redux。
- **响应式**：≥1024 / 768~1024 / <768 三档；移动汉堡菜单；触控目标 ≥44px（UI-UX §10）。
- **无障碍**：图标按钮 aria-label、图片 alt、可见焦点环、键盘可达、`prefers-reduced-motion`（UI-UX §11）。

### 5.2 后台 admin（React + TS + Vite + AntD 5）

- **布局**：左侧深墨绿 `--sider #0F3D2E` 侧边栏 + 顶栏（面包屑/用户/角色）+ 内容区 `--bg #f0f2f5` + 白色卡片（UI-UX §6.1）。
- **手风琴导航**：AntD `Menu mode="inline"` + 受控 `openKeys`（默认折叠、点击展开、同组仅展开当前父级、系统管理按角色显隐）（UI-UX §6.2）。
- **组件范式**：Table（缩略图/操作列同行水平/状态标签五色）+ `Form + Drawer` 编辑 + `Modal` 二次确认删除（"此操作不可撤销"）+ Upload 虚线框 + Toast（UI-UX §7）。
- **富文本**：wangEditor。
- **图标**：Lucide/Heroicons SVG，替换工作台 emoji（UI-UX 附录 B 中优先级，按 §9 待确认项 Q4 决定）。
- **权限入口**：登录后 `/api/admin/auth/me` 返回权限点集合，前端控制菜单/按钮显隐（仅视觉，服务端强制）。

---

## 6. 部署实施方案

```mermaid
flowchart LR
    NGNX[nginx:alpine<br>TLS终止+静态托管+反代] --> WEB[web 构建产物]
    NGNX --> ADM[admin 构建产物]
    NGNX -->|/api| API[FastAPI+uvicorn]
    API --> PG[(postgres:16)]
    API --> VOL[(volume: /uploads)]
```

| 项 | 方案 |
|----|------|
| 编排 | `docker-compose.yml`：nginx + web 产物 + admin 产物 + backend + postgres:16 + uploads volume（NFR-21） |
| Nginx | SPA 路由回退 `try_files`、`/api` 反代 FastAPI、`/static/uploads` 静态映射、HTTPS 终止（NFR-12） |
| 环境 | `.env`（dev）/ `.env.prod`（prod）双套配置（NFR-22） |
| 一键部署 | `docker compose up -d`（NFR-23） |
| 备份 | 生产 pg_dump 每日定时 + 保留 N 天（Docker 定时任务，NFR-20） |
| 开发期 | 本机 SQLite + uvicorn --reload + vite dev，免 Docker 快速迭代 |

---

## 7. 测试与验收方案

### 7.1 测试层次

| 层次 | 方式 | 覆盖 |
|------|------|------|
| 单元 | pytest（后端 Service/权限/状态机） | 状态流转合法性、权限判定、清洗函数 |
| 接口 | Swagger / 自动化接口冒烟 | 前台公开接口 + 后台 JWT 接口全量 |
| 端到端 | dev tools / headless Chrome | 前台页面渲染、表单提交落库、后台 CRUD 闭环 |
| UI 走查 | UI-UX §13 验收清单 | 视觉一致性 / 组件交互 / 响应式 / 无障碍 |

### 7.2 验收标准映射（PRD §16）

| 验收项 | 方案中的验证点 |
|--------|---------------|
| §16.1 前台：栏目可访问、移动端无错位 | M4~M5 每页端到端验证 + 375/768/1024/1440 四档走查 |
| §16.1 数据与状态即时一致 | 前后台联调：上下架/发布/停用即时生效 |
| §16.1 预约/留言校验完整、落库正确 | 表单提交 → 后台列表可见 → 状态流转 |
| §16.2 后台：权限隔离（403） | 内容编辑账号访问系统管理接口返回 40300 |
| §16.2 列表分页/搜索/筛选/二次确认/导出/日志 | M2~M3/M6 逐模块验证 |
| §16.3 系统：compose 一键启动、HTTPS、Swagger、备份 | M7 部署验证 |

---

## 8. 风险与应对（承接 PRD §15 / 开发技术文档 §9.2）

| 编号 | 风险 | 应对 |
|------|------|------|
| R1 | 内容素材（产品图/案例图/文案）不足 | 种子占位数据 + `.ph` 渐变占位图机制；上线前素材清单替换 |
| R2 | 富文本 XSS | 服务端 bleach 白名单清洗 + 前端受控渲染二次转义 |
| R3 | 预约/留言恶意刷单 | 接口限流 5/min/IP + 后台按 phone 查重 |
| R4 | 运营期并发增长 | PostgreSQL 索引 + 连接池 + OSS 迁移预案（存储抽象已预留） |
| R5 | 需求变更（新增栏目） | page_content.content_type / news_category 可扩展；重大变更走变更评审 |
| R6 | 地图合规 | 腾讯/高德标准 iframe 嵌入 |
| R7 | 个人信息合规 | 表单隐私提示、最小化收集、数据仅内部使用 |

---

## 9. 待确认事项

以下事项影响实施参数（涉及项先按推荐默认值推进，确认后调整）：

| 编号 | 事项 | 依据/现状 | 选项 | 推荐 |
|------|------|----------|------|------|
| Q1 | **门店与联系信息具体值**：上海旗舰店名称/地址/电话/营业时间、全国客服电话、联系邮箱 | PRD FR-03/53、BR-42~44 要求"地址明确"，文档未给具体值 | A. 您提供真实值；B. 先用占位值，上线前替换 | **A**（真实运营项目） |
| Q2 | **品牌 Slogan 与副标语初始文案** | 开发技术文档 §6.2.1 示例"本然之美 / 回归生活本质" | A. 采用文档示例；B. 您提供正式文案 | A |
| Q3 | **初始演示数据策略**（产品/案例/新闻/招聘） | 上线需素材（R1） | A. 种子内置少量占位示例数据（每类 2~4 条，占位图），保证联调可看；B. 仅建空结构，全部后台录入 | **A** |
| Q4 | **UI-UX 附录 B 设计收敛**（3 个子项） | UI-UX 附录 B 待规范收敛项 | 4a. 后台角色标签 tag-blue 是否保留 AntD 蓝 `#1677ff`：A. 改墨绿系；B. 保留蓝。4b. 预约/留言"待处理"红色标签：A. 改橙/中性（红色留给已关闭/已淘汰）；B. 保留红。4c. 前台标题字体：A. 按 UI-UX 无衬线宽字距；B. 改衬线标题 | 4a-A、4b-A、4c-A |
| Q5 | **初始超管密码策略** | BR-06 首次登录强制改密 | A. 种子生成随机强密码写入 `.env`/控制台；B. 固定初始密码（如 Admin@123456） | A |
| Q6 | **开发期运行方式** | NFR-21 开发可不启用数据库容器 | A. 本机直接运行（SQLite+uvicorn+vite），Docker 仅生产；B. 开发期即用 Compose | A |
| Q7 | **首页模块顺序配置** | FR-08"后台可配置高亮模块" vs BR-51 仅维护文案 | A. 本期仅维护标语/亮点文案，模块顺序固定为 PRD §8.2；B. 实现模块启停/排序配置（额外复杂度） | A |

> 除 Q1~Q7 外，其余均以四份文档既定内容为准，无需另行确认。

---

## 10. 执行确认机制与后续安排

1. **本方案确认**：您审阅本方案与 §9 待确认事项后，回复"已确认，执行下一步"（可附带 Q1~Q7 的答案或修改意见）。
2. **阶段门禁**：每个里程碑（M1~M7）完成并提交交付说明与运行验证报告后，等待您回复"已确认，执行下一步"再进入下一阶段。
3. **文档基线**：实施过程中若发现文档与原型冲突，按 §1.1 冲突裁定处理，并在交付说明中记录；重大偏差需您确认。
4. **交付形式**：每个阶段交付——代码落盘 + 变更说明 + 验证报告（dev tools / headless Chrome 端到端）。

---

*本文档 V1.0，依据四份基线文档编制；后续随实施演进以变更记录方式更新版本。*

---

## 11. 里程碑交付记录

### M6 系统管理（2026-08-19 交付）

| 层 | 交付内容 | 验证 |
|----|---------|------|
| 后端 | `app/schemas/system.py`（User/Role/Permission/Log 模型）；`app/routers/admin/system.py`（用户管理 / 角色权限 / 操作日志 / 部门接口，服务端 `require_perm` 强制校验 `system:user/role/log`）；`app/main.py` 挂载路由 | FastAPI TestClient 冒烟 19 项全通过（含超管权限保护 403、自身保护 403） |
| 前端 | `backend/src/pages/system/` 新增用户管理 / 角色权限（勾选式，按菜单分组）/ 操作日志（只读分页筛选）三页面；`App.tsx` 接入路由；`AdminLayout.tsx` 接入「系统管理」手风琴菜单（按权限显隐子项） | `npm run build`（tsc -b + vite build）0 错误 |
| 联调 | 运行后端 HTTP 实测 `GET /users`、`/roles`、`/logs`、`/departments` 均 200 | 端到端链路打通 |

**关键约束落地**
- RBAC 服务端强制校验（`require_perm`），前端仅做菜单/按钮隐藏（NFR-07）。
- 内置 `super_admin` 角色权限不可改（PUT 返回 40300）；禁止停用/降权自身账号。
- 权限点全量清单（M6-4）固化于 `api/scripts/seed.py` 的 `PERMISSIONS`（38 项，按后台菜单/功能模块拆分），种子已注入。
- 新增用户默认 `must_change_pwd=True`（首次登录强制改密，BR-06）；重置密码生成随机强密码并回显给管理员。
- 操作日志由关键操作自动写入 `sys_operation_log`（登录/增删改/状态流转/重置密码/角色权限更新），只读查询，日志列表附加操作人登录名。

**待用户确认后进入 M7（联调与上线）。**
