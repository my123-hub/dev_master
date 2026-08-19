# -*- coding: utf-8 -*-
"""
【模块功能】Alembic 迁移环境配置
——将数据库连接串与 ORM metadata 绑定：
1. 连接串统一从 app.core.config（DATABASE_URL 环境变量）读取，实现开发 SQLite / 生产 PostgreSQL 双库切换（数据库设计文档 §5.2/§5.3）；
2. target_metadata 指向 Base.metadata（导入 app.models 触发全部 21 张表注册），供 autogenerate 比对生成迁移。
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# 确保能导入 app 包：脚本工作目录为 api/（prepend_sys_path = . 已配置）
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# 导入应用配置与全部模型：app.core.config 提供 DATABASE_URL；app.models 触发 Base.metadata 完整注册
from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401  （仅导入以注册所有表到 metadata）

# Alembic 配置对象：提供 ini 文件访问能力
config = context.config

# 将应用配置的数据库连接串注入 Alembic（覆盖 ini 中的占位配置）
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# 日志配置（alembic.ini [loggers] 段）
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 迁移目标：ORM 全部模型的 metadata（21 张表）
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式：仅生成 SQL 脚本（不连接数据库），用于预览/审计迁移语句"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,                      # 参数直接内联到 SQL，便于查看
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：连接数据库执行迁移（开发/生产通用）"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,                 # 迁移场景无需连接池，避免句柄残留
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
