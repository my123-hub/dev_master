# STK本然家居 · 数据库设计文档

> **版本**：V1.3　**日期**：2026-08-18　**基线**：PRD V1.7 §10 + 开发技术文档 §5
> **技术栈**：后端 FastAPI + SQLAlchemy 2.0；开发环境 SQLite，生产环境 PostgreSQL 16+，通过 `DATABASE_URL` 切换。
> **变更轨迹**：V1.1 所有表统一公共字段（`is_activate` / 创建人 `created_at` / 创建时间 `created_date` / 修改人 `updated_at` / 修改时间 `updated_date`）、新增 `department`、重构 `sys_user`、简化 `sys_role`（共 21 张表）；V1.2 产品/新闻表字段重构（series / product_no / cover_url / is_published / is_top / publish_time / end_time）；V1.3 修复 21 个建表 DDL 闭合（原 `);` 被吞入注释导致 `db/schema.sql` 不可执行）、消除 5 张分类/配置表（product_category / news_category / faq / store / banner）与 `is_activate` 语义重复的 `status` 列（仅保留业务生命周期表的 `status`）。

---

## 目录

1. [概述与约定](#1-概述与约定)
2. [ER 图](#2-er-图)
3. [数据字典（21 张表）](#3-数据字典21-张表)
4. [建表 SQL（PostgreSQL + SQLite 差异）](#4-建表-sqlpostgresql--sqlite-差异)
5. [补充与运维](#5-补充与运维)
6. [附录](#6-附录)

---

## 1. 概述与约定

### 1.1 文档目的与读者

| 项 | 说明 |
|----|------|
| 目的 | 在 PRD §10 与开发技术文档 §5 基础上，**抽离并补全为独立的数据库专项文档**，核心强化「数据字典」(§3) 与「建表 SQL」(§4)。 |
| 读者 | DBA、后端工程师、代码 reviewer |
| 覆盖范围 | ER 图、数据字典、建表 SQL、种子/迁移/双库运维 |
| 不覆盖 | 接口契约、前后端流程、状态机（见《开发技术文档》）；业务需求论证（见 PRD） |

### 1.2 设计原则（继承 PRD §10.1，V1.1 调整）

1. **双库切换**：开发 SQLite（零配置），生产 PostgreSQL 16+；业务代码经 SQLAlchemy + `DATABASE_URL` 无感知切换。
2. **状态字段 `is_activate`**：所有表含 `is_activate` 标记记录激活/禁用（`1` 激活 / `0` 禁用），替代原 `is_deleted` 软删除；列表/详情查询默认 `WHERE is_activate = 1`。
3. **统一公共字段**：**所有表**（含 `sys_permission`、`sys_role_permission`、`sys_operation_log`、`sys_config` 等，原例外已取消）统一含 `id / is_activate / created_at(创建人) / created_date / updated_at(修改人) / updated_date`。
4. **通用内容页**：关于 STK / 品牌介绍 / 售后政策等单页富文本统一存于 `page_content`，按 `content_type` 区分。
5. **JSON 字段**：图集、规格参数、空间标签等多值数据用 `JSON`；SQLite 自动降级为 `TEXT`，PostgreSQL 用 `JSONB`。
6. **跨库通用类型**：统一使用 `Integer / String / Text / Boolean / DateTime / Numeric / JSON`，避免方言专有类型；SQL 全部由 ORM 生成。

### 1.3 公共字段规范（所有表统一）

| 字段 | 类型 | 可空 | 默认 | 说明 |
|------|------|------|------|------|
| `id` | BIGINT | 否 | 自增主键 | 全局唯一标识 |
| `is_activate` | SMALLINT | 否 | `1` | 状态：`1` 激活 / `0` 禁用 |
| `created_at` | BIGINT | 是 | NULL | 创建人（`sys_user.id` 引用）；系统/种子操作可为 NULL |
| `created_date` | TIMESTAMP | 否 | `now()` | 创建时间 |
| `updated_at` | BIGINT | 是 | NULL | 修改人（`sys_user.id` 引用） |
| `updated_date` | TIMESTAMP | 是 | NULL | 修改时间 |

> 命名说明：V1.1 起 `created_at`/`updated_at` 语义由「时间戳」调整为「创建人/修改人」（引用 `sys_user.id`），时间信息由 `created_date`/`updated_date` 承载。

### 1.4 命名规范

| 类别 | 规则 | 示例 |
|------|------|------|
| 表名 | 小写下划线，系统表 `sys_` 前缀 | `sys_user`、`product`、`department` |
| 外键 | `fk_<表>_<字段>` | `fk_sys_user_dept_id` |
| 普通索引 | `ix_<表>_<字段>` | `ix_product_status` |
| 唯一索引 | `uq_<表>_<字段>` | `uq_sys_user_username` |
| 状态字段 | `is_activate`：`1`=激活，`0`=禁用；业务状态见附录 A | `is_activate` |

### 1.5 ER 图阅读说明

- ER 图（§2）将 21 张表按**系统管理域（6）**、**内容与业务域（11）**、**首页/配置/留资域（4）** 三个域分组。
- `||--o{` 表示「一（左）对多（右）」关系；箭头指向子表（外键持有方）。
- 仅持久化外键（`dept_id`、`role_id`、`category_id`、`job_id`、`parent_id` 等）在图中连线。

---

## 2. ER 图

> 图示由「架构图与流程图绘制专家」技能生成（可缩放 SVG，位于 `diagrams/er-diagram.svg`）。Mermaid 源码可展开编辑：

![数据库 ER 图（21 张表）](diagrams/er-diagram.svg)

<details>
<summary>展开 Mermaid 源码</summary>

```mermaid
erDiagram
    DEPARTMENT ||--o{ DEPARTMENT : "上级部门 parent_id"
    DEPARTMENT ||--o{ SYS_USER : "归属 dept_id"
    SYS_ROLE ||--o{ SYS_USER : "拥有 role_id"
    SYS_ROLE ||--o{ SYS_ROLE_PERMISSION : "授予 role_id"
    SYS_PERMISSION ||--o{ SYS_ROLE_PERMISSION : "被授权 permission_id"
    SYS_USER ||--o{ SYS_OPERATION_LOG : "产生 user_id"
    PRODUCT_CATEGORY ||--o{ PRODUCT : "包含 category_id"
    NEWS_CATEGORY ||--o{ NEWS_ARTICLE : "包含 category_id"
    JOB ||--o{ JOB_APPLICATION : "收到投递 job_id"
```
</details>

**关系汇总**

| 父表 | 子表 | 外键 | 关系 |
|------|------|------|------|
| `department` | `department` | `parent_id` | 1:N（自关联，上级部门） |
| `department` | `sys_user` | `dept_id` | 1:N（一部门多用户） |
| `sys_role` | `sys_user` | `role_id` | 1:N（一角色多用户） |
| `sys_role` | `sys_role_permission` | `role_id` | 1:N |
| `sys_permission` | `sys_role_permission` | `permission_id` | 1:N |
| `sys_user` | `sys_operation_log` | `user_id`/`created_at` | 1:N |
| `product_category` | `product` | `category_id` | 1:N |
| `news_category` | `news_article` | `category_id` | 1:N |
| `job` | `job_application` | `job_id` | 1:N |

其余表（`case_info`、`banner`、`faq`、`milestone_item`、`store`、`appointment`、`message`、`page_content`、`sys_config`）为内容/配置/留资实体，无持久化外键，详见 §3。

---

## 3. 数据字典（21 张表）

字段字典列含义：**字段名 / 类型 / 可空 / 默认值 / 键 / 索引 / 说明**。每一表均含统一公共字段（见 §1.3）。

### 3.1 系统管理（6 张）

#### 3.1.1 `sys_user` — 后台管理员账号

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| username | VARCHAR(50) | 否 | — | UQ | — | 登录名，唯一 |
| password_hash | VARCHAR(255) | 否 | — | — | — | bcrypt 密码哈希（登录必需，原设计保留） |
| name | VARCHAR(50) | 是 | — | — | — | 姓名 |
| nickname | VARCHAR(50) | 是 | — | — | — | 昵称 |
| mobile | VARCHAR(20) | 是 | — | — | — | 手机号 |
| email | VARCHAR(100) | 是 | — | — | — | 邮箱 |
| gender | SMALLINT | 否 | 0 | — | — | 性别 0未知/1男/2女 |
| position | VARCHAR(50) | 是 | — | — | — | 岗位 |
| dept_id | BIGINT | 是 | — | FK | ix_sys_user_dept_id | 部门编号 → department.id |
| role_id | BIGINT | 否 | — | FK | ix_sys_user_role_id | 角色编号 → sys_role.id |
| last_login_at | TIMESTAMP | 是 | — | — | — | 最后登录时间（原设计保留） |
| must_change_pwd | BOOLEAN | 否 | TRUE | — | — | 首次登录强制改密（原设计保留） |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

> FK：`fk_sys_user_dept_id`（→ department）；`fk_sys_user_role_id`（→ sys_role）。

#### 3.1.2 `department` — 部门

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| dept_name | VARCHAR(100) | 否 | — | — | — | 部门名称 |
| parent_id | BIGINT | 是 | — | FK | ix_department_parent_id | 上级部门（自关联） → department.id |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

> FK：`fk_department_parent_id`（→ department）。

#### 3.1.3 `sys_role` — 角色

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| role_name | VARCHAR(50) | 否 | — | UQ | — | 角色名称，唯一 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.1.4 `sys_permission` — 权限点

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| perm_code | VARCHAR(80) | 否 | — | UQ | — | 权限码，如 product:edit |
| perm_name | VARCHAR(80) | 是 | — | — | — | 权限名称 |
| menu_key | VARCHAR(50) | 是 | — | — | — | 关联后台菜单 key |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.1.5 `sys_role_permission` — 角色-权限关联

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| role_id | BIGINT | 否 | — | PK, FK | — | 角色 ID → sys_role.id |
| permission_id | BIGINT | 否 | — | PK, FK | — | 权限点 ID → sys_permission.id |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

> FK：`fk_sys_role_permission_role_id`（→ sys_role）；`fk_sys_role_permission_permission_id`（→ sys_permission）。

> 复合主键 `(role_id, permission_id)`；含统一公共字段。

#### 3.1.6 `sys_operation_log` — 操作日志

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| user_id | BIGINT | 是 | — | — | ix_oplog_user | 操作人 → sys_user.id（逻辑，保留用于审计查询） |
| module | VARCHAR(50) | 是 | — | — | ix_oplog_module | 模块，如 product |
| action | VARCHAR(50) | 是 | — | — | — | 动作：create/update/delete/status/export/login |
| detail | VARCHAR(500) | 是 | — | — | — | 操作详情，如「下架产品：胡桃木餐桌」 |
| ip | VARCHAR(50) | 是 | — | — | — | 来源 IP |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

### 3.2 产品管理（2 张）

#### 3.2.1 `product_category` — 产品系列

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| name | VARCHAR(100) | 否 | — | — | — | 系列名称 |
| cover_url | VARCHAR(255) | 是 | — | — | — | 封面图 |
| sort_order | INT | 否 | 0 | — | ix_pcat_sort | 排序（小在前） |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.2.2 `product` — 产品

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| category_id | BIGINT | 否 | — | FK | ix_product_cat | 所属空间分类 → product_category.id |
| name | VARCHAR(100) | 否 | — | — | — | 产品名称 |
| series | VARCHAR(50) | 是 | — | — | — | 所属系列，如「胡桃禮」 |
| product_no | VARCHAR(50) | 否 | — | UQ | uq_product_no | 产品编号（唯一） |
| description | TEXT | 是 | — | — | — | 产品描述（富文本，已清洗） |
| specs | JSON | 是 | — | — | — | 规格参数（JSON 串）[{"name":"材质","value":"胡桃木"}] |
| cover_url | VARCHAR(255) | 是 | — | — | — | 封面图片 URL |
| images | JSON | 是 | — | — | — | 其它图片 URL（JSON 数组） |
| status | SMALLINT | 否 | 1 | — | ix_product_status | 发布状态：0 草稿 / 1 上架 / 2 下架 |
| is_top | SMALLINT | 否 | 0 | — | ix_product_top | 是否置顶：1 置顶 / 0 否 |
| sort_order | INT | 否 | 0 | — | — | 排序值（越大越靠前） |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

> FK：`fk_product_category_id`（→ product_category）。

### 3.3 案例管理（1 张）

#### 3.3.1 `case_info` — 实景案例

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| title | VARCHAR(150) | 否 | — | — | — | 标题 |
| cover_url | VARCHAR(255) | 是 | — | — | — | 封面图 |
| space_tags | JSON | 是 | — | — | — | 空间标签数组 ["客厅","卧室"] |
| city | VARCHAR(50) | 是 | — | — | — | 城市 |
| area | VARCHAR(50) | 是 | — | — | — | 面积 |
| finished_at | VARCHAR(30) | 是 | — | — | — | 完工时间 |
| content | TEXT | 是 | — | — | — | 项目介绍（富文本） |
| images | JSON | 是 | — | — | — | 实景图集 |
| sort_order | INT | 否 | 0 | — | — | 排序 |
| status | SMALLINT | 否 | 1 | — | — | 1 发布 / 0 下线 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

### 3.4 新闻管理（2 张）

#### 3.4.1 `news_category` — 新闻栏目

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| name | VARCHAR(50) | 否 | — | — | — | 栏目名称 |
| sort_order | INT | 否 | 0 | — | — | 排序 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.4.2 `news_article` — 新闻文章

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| category_id | BIGINT | 否 | — | FK | ix_news_cat | 所属分类（企业新闻/行业资讯）→ news_category.id |
| title | VARCHAR(200) | 否 | — | — | — | 标题 |
| cover_url | VARCHAR(255) | 是 | — | — | — | 封面图 URL |
| summary | VARCHAR(300) | 是 | — | — | — | 摘要 |
| content | TEXT | 是 | — | — | — | 正文（富文本 HTML，已清洗） |
| source | VARCHAR(100) | 是 | — | — | — | 来源（转载标注） |
| is_published | SMALLINT | 否 | 0 | — | ix_news_published | 是否发布：1 已发布 / 0 未发布 |
| is_top | SMALLINT | 否 | 0 | — | ix_news_top | 是否置顶/推荐：1 是 / 0 否 |
| publish_time | TIMESTAMP | 是 | — | — | ix_news_pubtime | 发布时间 |
| end_time | TIMESTAMP | 是 | — | — | — | 截止时间（置顶/展示有效期，可空） |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

> FK：`fk_news_article_category_id`（→ news_category）。

### 3.5 招聘管理（2 张）

#### 3.5.1 `job` — 招聘职位

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| title | VARCHAR(100) | 否 | — | — | — | 职位名称 |
| category | SMALLINT | 否 | — | — | ix_job_cat | 1 社会招聘 / 2 校园招聘 |
| location | VARCHAR(100) | 否 | '上海' | — | — | 工作地点 |
| job_type | VARCHAR(20) | 是 | — | — | — | 全职/实习/校招 |
| salary_range | VARCHAR(50) | 是 | — | — | — | 薪资范围 |
| responsibility | TEXT | 是 | — | — | — | 岗位职责（富文本） |
| requirement | TEXT | 是 | — | — | — | 任职要求（富文本） |
| contact | VARCHAR(200) | 否 | — | — | — | 简历投递邮箱/联系方式 |
| is_urgent | SMALLINT | 否 | 0 | — | — | 1 急招 / 0 普通 |
| status | SMALLINT | 否 | 1 | — | ix_job_status | 1 招聘中 / 0 已关闭 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.5.2 `job_application` — 简历投递

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| job_id | BIGINT | 否 | — | FK | ix_jobapp_job | 应聘职位 → job.id |
| name | VARCHAR(50) | 否 | — | — | — | 姓名 |
| phone | VARCHAR(20) | 否 | — | — | ix_jobapp_phone | 手机号 |
| email | VARCHAR(100) | 是 | — | — | — | 邮箱 |
| resume_url | VARCHAR(255) | 否 | — | — | — | 简历附件路径 |
| note | TEXT | 是 | — | — | — | 自我推荐/备注 |
| status | SMALLINT | 否 | 0 | — | — | 0 待处理/1 已联系/2 已淘汰/3 已录用 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

> FK：`fk_job_application_job_id`（→ job）。

### 3.6 内容管理（3 张）

#### 3.6.1 `page_content` — 单页富文本内容

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| content_type | VARCHAR(50) | 否 | — | UQ | — | 类型：about_stk/brand_intro/after_sales_policy 等 |
| title | VARCHAR(150) | 是 | — | — | — | 标题 |
| content | TEXT | 是 | — | — | — | 富文本正文 |
| cover_url | VARCHAR(255) | 是 | — | — | — | 封面图 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.6.2 `milestone_item` — 发展历程条目

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| year | VARCHAR(10) | 否 | — | — | — | 年份 |
| title | VARCHAR(150) | 是 | — | — | — | 事件标题 |
| description | TEXT | 是 | — | — | — | 事件说明 |
| sort_order | INT | 否 | 0 | — | — | 排序（时间倒序展示） |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.6.3 `faq` — 常见问题

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| category | VARCHAR(50) | 是 | — | — | — | 可选分类 |
| question | VARCHAR(300) | 否 | — | — | — | 问题 |
| answer | TEXT | 是 | — | — | — | 答案（富文本） |
| sort_order | INT | 否 | 0 | — | — | 排序 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

### 3.7 门店管理（1 张）

#### 3.7.1 `store` — 门店信息

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| name | VARCHAR(100) | 否 | — | — | — | 门店名称 |
| city | VARCHAR(50) | 否 | '上海' | — | — | 城市（本期固定上海） |
| address | VARCHAR(255) | 否 | — | — | — | 地址 |
| phone | VARCHAR(50) | 否 | — | — | — | 联系电话 |
| business_hours | VARCHAR(100) | 是 | — | — | — | 营业时间 |
| longitude | VARCHAR(30) | 是 | — | — | — | 经度（单店本期不填） |
| latitude | VARCHAR(30) | 是 | — | — | — | 纬度（单店本期不填） |
| sort_order | INT | 否 | 0 | — | — | 排序 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

### 3.8 首页配置（1 张）

#### 3.8.1 `banner` — 首页轮播图

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| image_url | VARCHAR(255) | 否 | — | — | — | 图片地址 |
| title | VARCHAR(100) | 是 | — | — | — | 标题 |
| subtitle | VARCHAR(200) | 是 | — | — | — | 副标题 |
| link_url | VARCHAR(255) | 是 | — | — | — | 跳转链接 |
| sort_order | INT | 否 | 0 | — | — | 排序 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

### 3.9 首页/系统配置（1 张）

#### 3.9.1 `sys_config` — 系统配置键值

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| config_key | VARCHAR(100) | 否 | — | UQ | — | 键：contact.address/contact.phone/brand.slogan/highlight.title_1 |
| config_value | TEXT | 是 | — | — | — | 值 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

### 3.10 留资管理（2 张）

#### 3.10.1 `appointment` — 在线预约

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| name | VARCHAR(50) | 否 | — | — | — | 姓名 |
| phone | VARCHAR(20) | 否 | — | — | ix_appointment_phone | 手机号 |
| store_name | VARCHAR(100) | 否 | '上海旗舰店' | — | — | 门店（本期固定，前台不提供选择） |
| appointment_date | TIMESTAMP | 是 | — | — | — | 预约到店时间 |
| intention | VARCHAR(200) | 是 | — | — | — | 意向产品/系列 |
| remark | TEXT | 是 | — | — | — | 备注 |
| status | SMALLINT | 否 | 0 | — | ix_appointment_status | 0 待处理/1 已联系/2 已到店/3 已关闭 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |

#### 3.10.2 `message` — 在线留言

| 字段名 | 类型 | 可空 | 默认 | 键 | 索引 | 说明 |
|--------|------|------|------|----|------|------|
| id | BIGINT | 否 | — | PK | — | 主键 |
| name | VARCHAR(50) | 否 | — | — | — | 姓名 |
| phone | VARCHAR(20) | 否 | — | — | ix_message_phone | 手机号 |
| email | VARCHAR(100) | 是 | — | — | — | 邮箱 |
| content | TEXT | 否 | — | — | — | 留言内容 |
| status | SMALLINT | 否 | 0 | — | — | 0 待处理 / 1 已处理 |
| is_activate | SMALLINT | 否 | 1 | — | — | 状态：1 激活 / 0 禁用 |
| created_at | BIGINT | 是 | — | — | — | 创建人（sys_user.id 引用）；系统/种子操作可为 NULL |
| created_date | TIMESTAMP | 否 | now() | — | — | 创建时间 |
| updated_at | BIGINT | 是 | — | — | — | 修改人（sys_user.id 引用） |
| updated_date | TIMESTAMP | 是 | — | — | — | 修改时间 |


---

## 4. 建表 SQL（PostgreSQL + SQLite 差异）

> 生产基线为 **PostgreSQL 16+**，完整脚本另存为 `db/schema.sql`（可直接 `psql -f db/schema.sql` 执行）。以下为建表主体（含列注释、索引、外键约束）。

### 4.1 PostgreSQL 建表脚本（主体）

```sql
-- ---------- 系统管理：sys_user（后台管理员账号） ----------
CREATE TABLE sys_user (  id               BIGSERIAL NOT NULL,
  username         VARCHAR(50) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  name             VARCHAR(50),
  nickname         VARCHAR(50),
  mobile           VARCHAR(20),
  email            VARCHAR(100),
  gender           SMALLINT NOT NULL DEFAULT 0,
  position         VARCHAR(50),
  dept_id          BIGINT,
  role_id          BIGINT NOT NULL,
  last_login_at    TIMESTAMP,
  must_change_pwd  BOOLEAN NOT NULL DEFAULT TRUE,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
ALTER TABLE sys_user ADD CONSTRAINT fk_sys_user_dept_id FOREIGN KEY (dept_id) REFERENCES department(id);
ALTER TABLE sys_user ADD CONSTRAINT fk_sys_user_role_id FOREIGN KEY (role_id) REFERENCES sys_role(id);
CREATE INDEX ix_sys_user_dept_id ON sys_user(dept_id);
CREATE INDEX ix_sys_user_role_id ON sys_user(role_id);

-- ---------- 系统管理：department（部门） ----------
CREATE TABLE department (  id               BIGSERIAL NOT NULL,
  dept_name        VARCHAR(100) NOT NULL,
  parent_id        BIGINT,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
ALTER TABLE department ADD CONSTRAINT fk_department_parent_id FOREIGN KEY (parent_id) REFERENCES department(id);
CREATE INDEX ix_department_parent_id ON department(parent_id);

-- ---------- 系统管理：sys_role（角色） ----------
CREATE TABLE sys_role (  id               BIGSERIAL NOT NULL,
  role_name        VARCHAR(50) NOT NULL UNIQUE,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 系统管理：sys_permission（权限点） ----------
CREATE TABLE sys_permission (  id               BIGSERIAL NOT NULL,
  perm_code        VARCHAR(80) NOT NULL UNIQUE,
  perm_name        VARCHAR(80),
  menu_key         VARCHAR(50),
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 系统管理：sys_role_permission（角色-权限关联） ----------
CREATE TABLE sys_role_permission (  role_id          BIGINT NOT NULL,
  permission_id    BIGINT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
ALTER TABLE sys_role_permission ADD CONSTRAINT fk_sys_role_permission_role_id FOREIGN KEY (role_id) REFERENCES sys_role(id);
ALTER TABLE sys_role_permission ADD CONSTRAINT fk_sys_role_permission_permission_id FOREIGN KEY (permission_id) REFERENCES sys_permission(id);

-- ---------- 系统管理：sys_operation_log（操作日志） ----------
CREATE TABLE sys_operation_log (  id               BIGSERIAL NOT NULL,
  user_id          BIGINT,
  module           VARCHAR(50),
  action           VARCHAR(50),
  detail           VARCHAR(500),
  ip               VARCHAR(50),
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
CREATE INDEX ix_oplog_user ON sys_operation_log(user_id);
CREATE INDEX ix_oplog_module ON sys_operation_log(module);

-- ---------- 产品管理：product_category（产品系列） ----------
CREATE TABLE product_category (  id               BIGSERIAL NOT NULL,
  name             VARCHAR(100) NOT NULL,
  cover_url        VARCHAR(255),
  sort_order       INT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
CREATE INDEX ix_pcat_sort ON product_category(sort_order);

-- ---------- 产品管理：product（产品） ----------
CREATE TABLE product (  id               BIGSERIAL NOT NULL,
  category_id      BIGINT NOT NULL,
  name             VARCHAR(100) NOT NULL,
  series           VARCHAR(50),
  product_no       VARCHAR(50) NOT NULL,
  description      TEXT,
  specs            JSON,
  cover_url        VARCHAR(255),
  images           JSON,
  status           SMALLINT NOT NULL DEFAULT 1,
  is_top           SMALLINT NOT NULL DEFAULT 0,
  sort_order       INT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
ALTER TABLE product ADD CONSTRAINT fk_product_category_id FOREIGN KEY (category_id) REFERENCES product_category(id);
CREATE UNIQUE INDEX uq_product_no ON product(product_no);
CREATE INDEX ix_product_cat ON product(category_id);
CREATE INDEX ix_product_top ON product(is_top);
CREATE INDEX ix_product_status ON product(status);

-- ---------- 案例管理：case_info（实景案例） ----------
CREATE TABLE case_info (  id               BIGSERIAL NOT NULL,
  title            VARCHAR(150) NOT NULL,
  cover_url        VARCHAR(255),
  space_tags       JSON,
  city             VARCHAR(50),
  area             VARCHAR(50),
  finished_at      VARCHAR(30),
  content          TEXT,
  images           JSON,
  sort_order       INT NOT NULL DEFAULT 0,
  status           SMALLINT NOT NULL DEFAULT 1,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 新闻管理：news_category（新闻栏目） ----------
CREATE TABLE news_category (  id               BIGSERIAL NOT NULL,
  name             VARCHAR(50) NOT NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 新闻管理：news_article（新闻文章） ----------
CREATE TABLE news_article (  id               BIGSERIAL NOT NULL,
  category_id      BIGINT NOT NULL,
  title            VARCHAR(200) NOT NULL,
  cover_url        VARCHAR(255),
  summary          VARCHAR(300),
  content          TEXT,
  source           VARCHAR(100),
  is_published     SMALLINT NOT NULL DEFAULT 0,
  is_top           SMALLINT NOT NULL DEFAULT 0,
  publish_time     TIMESTAMP,
  end_time         TIMESTAMP,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
ALTER TABLE news_article ADD CONSTRAINT fk_news_article_category_id FOREIGN KEY (category_id) REFERENCES news_category(id);
CREATE INDEX ix_news_cat ON news_article(category_id);
CREATE INDEX ix_news_published ON news_article(is_published);
CREATE INDEX ix_news_top ON news_article(is_top);
CREATE INDEX ix_news_pubtime ON news_article(publish_time);

-- ---------- 招聘管理：job（招聘职位） ----------
CREATE TABLE job (  id               BIGSERIAL NOT NULL,
  title            VARCHAR(100) NOT NULL,
  category         SMALLINT NOT NULL,
  location         VARCHAR(100) NOT NULL DEFAULT '上海',
  job_type         VARCHAR(20),
  salary_range     VARCHAR(50),
  responsibility   TEXT,
  requirement      TEXT,
  contact          VARCHAR(200) NOT NULL,
  is_urgent        SMALLINT NOT NULL DEFAULT 0,
  status           SMALLINT NOT NULL DEFAULT 1,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
CREATE INDEX ix_job_cat ON job(category);
CREATE INDEX ix_job_status ON job(status);

-- ---------- 招聘管理：job_application（简历投递） ----------
CREATE TABLE job_application (  id               BIGSERIAL NOT NULL,
  job_id           BIGINT NOT NULL,
  name             VARCHAR(50) NOT NULL,
  phone            VARCHAR(20) NOT NULL,
  email            VARCHAR(100),
  resume_url       VARCHAR(255) NOT NULL,
  note             TEXT,
  status           SMALLINT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
ALTER TABLE job_application ADD CONSTRAINT fk_job_application_job_id FOREIGN KEY (job_id) REFERENCES job(id);
CREATE INDEX ix_jobapp_job ON job_application(job_id);
CREATE INDEX ix_jobapp_phone ON job_application(phone);

-- ---------- 内容管理：page_content（单页富文本内容） ----------
CREATE TABLE page_content (  id               BIGSERIAL NOT NULL,
  content_type     VARCHAR(50) NOT NULL UNIQUE,
  title            VARCHAR(150),
  content          TEXT,
  cover_url        VARCHAR(255),
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 内容管理：milestone_item（发展历程条目） ----------
CREATE TABLE milestone_item (  id               BIGSERIAL NOT NULL,
  year             VARCHAR(10) NOT NULL,
  title            VARCHAR(150),
  description      TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 内容管理：faq（常见问题） ----------
CREATE TABLE faq (  id               BIGSERIAL NOT NULL,
  category         VARCHAR(50),
  question         VARCHAR(300) NOT NULL,
  answer           TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 门店管理：store（门店信息） ----------
CREATE TABLE store (  id               BIGSERIAL NOT NULL,
  name             VARCHAR(100) NOT NULL,
  city             VARCHAR(50) NOT NULL DEFAULT '上海',
  address          VARCHAR(255) NOT NULL,
  phone            VARCHAR(50) NOT NULL,
  business_hours   VARCHAR(100),
  longitude        VARCHAR(30),
  latitude         VARCHAR(30),
  sort_order       INT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 首页配置：banner（首页轮播图） ----------
CREATE TABLE banner (  id               BIGSERIAL NOT NULL,
  image_url        VARCHAR(255) NOT NULL,
  title            VARCHAR(100),
  subtitle         VARCHAR(200),
  link_url         VARCHAR(255),
  sort_order       INT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 首页/系统配置：sys_config（系统配置键值） ----------
CREATE TABLE sys_config (  id               BIGSERIAL NOT NULL,
  config_key       VARCHAR(100) NOT NULL UNIQUE,
  config_value     TEXT,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);

-- ---------- 留资管理：appointment（在线预约） ----------
CREATE TABLE appointment (  id               BIGSERIAL NOT NULL,
  name             VARCHAR(50) NOT NULL,
  phone            VARCHAR(20) NOT NULL,
  store_name       VARCHAR(100) NOT NULL DEFAULT '上海旗舰店',
  appointment_date TIMESTAMP,
  intention        VARCHAR(200),
  remark           TEXT,
  status           SMALLINT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
CREATE INDEX ix_appointment_phone ON appointment(phone);
CREATE INDEX ix_appointment_status ON appointment(status);

-- ---------- 留资管理：message（在线留言） ----------
CREATE TABLE message (  id               BIGSERIAL NOT NULL,
  name             VARCHAR(50) NOT NULL,
  phone            VARCHAR(20) NOT NULL,
  email            VARCHAR(100),
  content          TEXT NOT NULL,
  status           SMALLINT NOT NULL DEFAULT 0,
  is_activate      SMALLINT     NOT NULL DEFAULT 1,   -- 1 激活 / 0 禁用
  created_at       BIGINT,                        -- 创建人（sys_user.id 引用）；系统/种子操作可为 NULL
  created_date     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at       BIGINT,                        -- 修改人（sys_user.id 引用）
  updated_date     TIMESTAMP                        -- 修改时间
);
CREATE INDEX ix_message_phone ON message(phone);

```

> **列注释**：`db/schema.sql` 在 `COMMENT ON TABLE/COLUMN` 段补充了中文注释（见 §4.3 说明），上述主体省略以免冗长。完整 `is_activate`、外键、业务状态注释均在 `schema.sql` 中。

### 4.2 SQLite 差异说明

| 维度 | PostgreSQL | SQLite（开发期） |
|------|-----------|-----------------|
| 主键自增 | `BIGSERIAL`（8 字节） | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| JSON | `JSONB` | `TEXT`（SQLAlchemy `JSON` 类型自动存为 TEXT） |
| 布尔 | `BOOLEAN` | `INTEGER`（0/1），`must_change_pwd` 用 `INTEGER DEFAULT 1` |
| 数值 | `NUMERIC(10,2)` | `NUMERIC`（类型亲和） |
| 外键 | 声明式 `FOREIGN KEY ... REFERENCES` 生效 | 需 `PRAGMA foreign_keys = ON;`；建表兼容，约束名保留 |
| 默认值函数 | `DEFAULT now()` | `DEFAULT CURRENT_TIMESTAMP` |
| 创建人/修改人 | `BIGINT`（引用 `sys_user.id`） | 同（`INTEGER`） |
| 字符串长度 | `VARCHAR(n)` 强制长度 | `TEXT`（忽略长度约束，仅文档约定） |
| 索引/唯一 | 同 | 同 |

> 实践建议：开发期直接由 SQLAlchemy `Base.metadata.create_all()` 建表（`sqlite:///app.db`），保持与生产 DDL 逻辑一致；不手写为方言 SQL。

### 4.3 列注释（PostgreSQL `COMMENT` 段，节选）

```sql
COMMENT ON TABLE sys_user IS '后台管理员账号';
COMMENT ON COLUMN sys_user.is_activate IS '状态：1 激活 / 0 禁用';
COMMENT ON COLUMN sys_user.created_at IS '创建人（sys_user.id）';
COMMENT ON COLUMN sys_user.role_id IS '→ sys_role.id';
COMMENT ON COLUMN sys_user.dept_id IS '→ department.id';
COMMENT ON TABLE department IS '部门';
COMMENT ON COLUMN department.parent_id IS '上级部门（自关联）→ department.id';
COMMENT ON TABLE product IS '产品';
COMMENT ON COLUMN product.category_id IS '所属空间分类 → product_category.id';
COMMENT ON COLUMN product.series IS '所属系列，如「胡桃禮」';
COMMENT ON COLUMN product.name IS '产品名称';
COMMENT ON COLUMN product.product_no IS '产品编号（唯一）';
COMMENT ON COLUMN product.status IS '发布状态：0 草稿 / 1 上架 / 2 下架';
COMMENT ON COLUMN product.is_top IS '是否置顶：1 置顶 / 0 否';
COMMENT ON TABLE appointment IS '在线预约';
COMMENT ON COLUMN appointment.status IS '0 待处理/1 已联系/2 已到店/3 已关闭';
COMMENT ON TABLE job_application IS '简历投递';
COMMENT ON COLUMN job_application.status IS '0 待处理/1 已联系/2 已淘汰/3 已录用';
COMMENT ON TABLE message IS '在线留言';
COMMENT ON COLUMN message.status IS '0 待处理 / 1 已处理';
COMMENT ON TABLE sys_config IS '系统配置键值';
```

---

## 5. 补充与运维

### 5.1 种子数据（`scripts/seed.py`）

| 表 | 种子内容 | 说明 |
|----|---------|------|
| `sys_role` | `super_admin`（超级管理员）、`content_editor`（内容编辑） | 角色最小集 |
| `department` | 顶层部门如「总部」，及「内容部」「运营部」等 | 初始部门树 |
| `sys_permission` | `product:*`、`news:*`、`recruit:*`、`reservation:*`、`message:*`、`system:user/role/log` 等 | 权限点按菜单拆分 |
| `sys_role_permission` | `super_admin` 关联全部权限点；`content_editor` 关联内容类权限点 | RBAC 初始授权 |
| `sys_user` | 初始超管 `admin` + bcrypt 哈希，绑定 `super_admin` 与某部门，`must_change_pwd=TRUE` | 首次登录强制改密 |
| `news_category` | 内置栏目（如「品牌动态」「行业资讯」） | 便于演示 |
| `store` | 单条「上海旗舰店」 | 二期单店 |
| `sys_config` | `contact.address`、`contact.phone`、`brand.slogan`、`highlight.title_1` 等初始值 | 首页/页脚配置 |
| `page_content` | `about_stk`、`brand_intro`、`after_sales_policy` 空模板 | 单页内容占位 |

### 5.2 Alembic 迁移策略

- 采用 **Alembic** 管理版本化迁移；`env.py` 读取 `DATABASE_URL`，双库通用。
- 原则：新增列优先 `nullable` 或带默认值；禁止 `DROP COLUMN` 直接物理删除（改 `is_activate=0` 禁用）。
- `alembic revision --autogenerate` 生成差异，人工复核 `JSONB` / `BIGSERIAL` 映射后再 `upgrade`。

### 5.3 双库切换（`DATABASE_URL`）

```python
# app/core/config.py
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./app.db"          # 开发默认
    # 生产: "postgresql://user:pass@host:5432/stk_db"
)
```

- 业务层（SQLAlchemy `session`）与切换无关；仅连接串不同。
- 生产建议连接池 + `pool_pre_ping=True`；SQLite 单连接即可。

### 5.4 `is_activate` 查询约定

- 所有列表/详情查询默认附加 `WHERE is_activate = 1`（仅返回激活记录）。
- 物理删除仅用于 `sys_operation_log` 等追加型表（按保留期清理）。
- `is_activate` 仅 `0/1` 两态，禁止 `NULL`。

### 5.5 索引策略总结（PRD §10.2）

- 所有**外键字段**建索引（`dept_id`、`role_id`、`category_id`、`job_id`、`parent_id`）。
- 列表/筛选高频字段：`status`/`is_published`、`sort_order`、`publish_time`、`phone`。
- 留资检索：`appointment.phone`、`message.phone`、`job_application.phone` 建索引。
- 命名统一 `ix_<表>_<字段>`；唯一约束 `uq_<表>_<字段>`。

---

## 6. 附录

### A. 状态/枚举字典

| 表 | 字段 | 枚举值 |
|----|------|--------|
| 通用 | `is_activate` | 1 激活 · 0 禁用 |
| `sys_user` | gender | 0 未知 · 1 男 · 2 女 |
| `sys_user` | must_change_pwd | TRUE 需改密 · FALSE 正常 |
| 通用 | `status`（业务生命周期表：product / case_info / job / appointment / job_application / message） | 1 有效 · 0 无效；分类/配置类表（product_category / news_category / faq / store / banner）不再单独设 `status`，统一由 `is_activate` 承担启用/停用 |
| `product` | status | 0 草稿 · 1 上架 · 2 下架 |
| `product` | is_top | 1 置顶 · 0 否 |
| `case_info` | status | 1 发布 · 0 下线 |
| `news_article` | is_published | 1 已发布 · 0 未发布 |
| `news_article` | is_top | 1 置顶/推荐 · 0 否 |
| `job` | category | 1 社会招聘 · 2 校园招聘 |
| `job` | status | 1 招聘中 · 0 已关闭 |
| `job` | is_urgent | 1 急招 · 0 普通 |
| `appointment` | status | 0 待处理 · 1 已联系 · 2 已到店 · 3 已关闭 |
| `job_application` | status | 0 待处理 · 1 已联系 · 2 已淘汰 · 3 已录用 |
| `message` | status | 0 待处理 · 1 已处理 |

### B. 表清单速查（21 张）

| 序号 | 表名 | 归属模块 | 外键 |
|------|------|---------|------|
| 1 | sys_user | 系统管理 | dept_id→department、role_id→sys_role |
| 2 | department | 系统管理 | parent_id→department |
| 3 | sys_role | 系统管理 | — |
| 4 | sys_permission | 系统管理 | — |
| 5 | sys_role_permission | 系统管理 | role_id→sys_role、permission_id→sys_permission |
| 6 | sys_operation_log | 系统管理 | — |
| 7 | product_category | 产品管理 | — |
| 8 | product | 产品管理 | category_id→product_category |
| 9 | case_info | 案例管理 | — |
| 10 | news_category | 新闻管理 | — |
| 11 | news_article | 新闻管理 | category_id→news_category |
| 12 | job | 招聘管理 | — |
| 13 | job_application | 招聘管理 | job_id→job |
| 14 | page_content | 内容管理 | — |
| 15 | milestone_item | 内容管理 | — |
| 16 | faq | 内容管理 | — |
| 17 | store | 门店管理 | — |
| 18 | banner | 首页配置 | — |
| 19 | sys_config | 首页/系统配置 | — |
| 20 | appointment | 留资管理 | — |
| 21 | message | 留资管理 | — |

### C. 术语表

| 术语 | 说明 |
|------|------|
| 状态字段 `is_activate` | 记录激活/禁用标志（1 激活 / 0 禁用），V1.1 起替代软删除 `is_deleted` |
| 双库切换 | SQLite（开发）/ PostgreSQL（生产），经 `DATABASE_URL` |
| RBAC | 基于角色的访问控制（角色-权限点） |
| JSONB | PostgreSQL 二进制 JSON，支持索引 |
| BIGSERIAL | PostgreSQL 8 字节自增主键 |
| Alembic | SQLAlchemy 数据库迁移工具 |