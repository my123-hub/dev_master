# -*- coding: utf-8 -*-
"""
【模块功能】应用全局配置管理
——统一从环境变量 / .env 文件读取配置项，供全项目使用。
依据：开发技术文档 §2.4（环境与配置管理）、数据库设计文档 §5.3（DATABASE_URL 双库切换）。
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """【类说明】项目配置项定义（pydantic-settings 自动读取环境变量与 .env）"""

    # ---------- 数据库 ----------
    # 开发默认 SQLite（零配置）；生产通过环境变量切换 PostgreSQL：
    # DATABASE_URL=postgresql://user:pass@host:5432/stk_db
    DATABASE_URL: str = "sqlite:///./app.db"

    # ---------- JWT 认证 ----------
    # 生产环境必须通过环境变量注入强随机密钥，禁止使用默认值
    JWT_SECRET: str = "stk-dev-secret-change-me-in-prod"
    JWT_ALGORITHM: str = "HS256"
    # 会话保持 7 天（PRD BR-04）：7*24*60 = 10080 分钟
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    # ---------- 文件存储 ----------
    # 本地上传目录（PRD §10.1 存储可演进 OSS，见开发技术文档 ADR-002）
    UPLOAD_DIR: str = "uploads"

    # ---------- 跨域（开发期前端 Vite dev server 需要） ----------
    # 前台 5173 / 后台 5174；生产同域 Nginx 托管无需 CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"

    # ---------- 限流（PRD NFR-11：前台留资 5/min/IP） ----------
    LEAD_RATE_LIMIT: str = "5/minute"
    # 登录失败限流（PRD BR-02：连续失败 N 次限流）
    LOGIN_FAIL_LIMIT: str = "10/minute"

    model_config = SettingsConfigDict(
        env_file=".env",          # 读取 api/.env（已被 .gitignore 排除，不提交）
        env_file_encoding="utf-8",
        extra="ignore",           # 忽略未声明的环境变量，避免报错
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """【方法说明】将逗号分隔的 CORS 白名单字符串转为列表，供 FastAPI 中间件使用"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """【函数说明】带缓存的配置单例，避免每次 import 重复解析 .env（性能优化）"""
    return Settings()


# 模块级默认实例：业务代码直接 `from app.core.config import settings` 使用
settings = get_settings()
