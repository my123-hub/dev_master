# -*- coding: utf-8 -*-
"""
【模块功能】ORM 基类与公共字段混入（Mixin）
——所有 21 张表统一继承 Base + CommonMixin（数据库设计文档 §1.3 公共字段规范）：
  id / is_activate / created_at(创建人) / created_date / updated_at(修改人) / updated_date
命名与类型严格遵循数据库设计文档 V1.3，确保 SQLite 与 PostgreSQL 双库兼容。
"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, SmallInteger
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """【类说明】SQLAlchemy 声明式基类：
    所有 ORM 模型继承本类；Alembic 通过 Base.metadata 生成迁移。
    """


class AuditFieldsMixin:
    """【类说明】审计字段混入（不含主键）：
    - is_activate：1 激活 / 0 禁用（统一软删除标记，查询默认 is_activate=1）
    - created_at：创建人（引用 sys_user.id，系统/种子操作可为 NULL）
    - created_date：创建时间（默认当前时间）
    - updated_at：修改人（引用 sys_user.id，可为 NULL）
    - updated_date：修改时间（可为 NULL）
    用途：供复合主键表（如 sys_role_permission）复用，避免继承自增 id 主键。
    """

    # 激活状态：1 激活 / 0 禁用；禁用等效软删除，关键业务数据可追溯（ADR-004）
    is_activate: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1, server_default="1")

    # 创建人：引用 sys_user.id；系统初始化/种子数据可为空
    created_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # 创建时间：默认取 Python 当前时间（跨库一致，避免数据库方言差异）
    created_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    # 修改人：引用 sys_user.id；可为空
    updated_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # 修改时间：可为空（未修改过则为 NULL）
    updated_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CommonMixin(AuditFieldsMixin):
    """【类说明】公共字段混入（数据库设计文档 §1.3）：
    在审计字段基础上补充 id 主键，供普通表（含单列自增主键）使用。
    """

    # 主键：使用方言变体类型保证双库自增一致
    # - SQLite：仅支持 INTEGER PRIMARY KEY 自增（BigInteger 不会自增，会插入 NULL）
    # - PostgreSQL：使用 BIGINT（映射 BIGSERIAL 8 字节自增），符合文档"id BIGINT PK"
    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
