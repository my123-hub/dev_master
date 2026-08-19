# -*- coding: utf-8 -*-
"""
【模块功能】数据库引擎与会话管理
——按 DATABASE_URL 创建引擎（开发 SQLite / 生产 PostgreSQL），提供请求级 Session 依赖。
依据：数据库设计文档 §5.3（双库切换）、§4.2（SQLite 外键需 PRAGMA 开启）。
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _build_engine():
    """【函数说明】按连接串构建引擎：
    - SQLite：设置 check_same_thread=False（FastAPI 多线程访问），并注册事件开启外键约束
    - PostgreSQL：生产环境经 DATABASE_URL 切换，SQLAlchemy 自动使用 psycopg 驱动
    """
    connect_args = {}
    # SQLite 专用参数：允许跨线程使用连接（FastAPI 异步/多线程场景必需）
    if settings.DATABASE_URL.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)

    # SQLite 默认不启用外键约束，需注册事件在每次连接建立时执行 PRAGMA（数据库设计文档 §4.2）
    if settings.DATABASE_URL.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()

    return engine


# 全局引擎实例（应用启动时创建一次）
engine = _build_engine()

# 会话工厂：业务代码通过 SessionLocal() 获取数据库会话
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_db():
    """【函数说明】FastAPI 依赖：请求级数据库会话。
    每次请求创建一个 Session，请求结束自动关闭（finally 保证释放连接）。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
