# -*- coding: utf-8 -*-
"""
【模块功能】FastAPI 应用入口
——装配配置、CORS、全局异常、路由；提供 /api/health 健康检查。
依据：开发技术文档 §2（总体架构）、§1.3（统一响应）、NFR-22（环境隔离）。
启动：uvicorn app.main:app --reload --port 8000（在 api/ 目录下）
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.response import ok
from app.routers.admin import auth as admin_auth


def create_app() -> FastAPI:
    """【函数说明】应用工厂：集中装配所有组件，便于测试时创建独立实例"""
    app = FastAPI(
        title="STK 本然家居 API",
        description="STK本然家居企业官网 后台管理系统与前台数据接口（FastAPI）",
        version="1.0.0",
        docs_url="/docs",          # Swagger 文档（NFR-18）
        redoc_url=None,
    )

    # CORS：开发期允许前台/后台 Vite dev server 跨域调用（生产同域 Nginx 托管无需 CORS）
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 全局异常处理器（BizError/校验/框架异常/兜底）
    register_exception_handlers(app)

    # ---------- 路由挂载 ----------
    # 后台认证（登录/me/改密）；后续模块按 M2~M3 逐步追加
    app.include_router(admin_auth.router, prefix="/api/admin/auth", tags=["后台-认证"])

    # ---------- 健康检查 ----------
    @app.get("/api/health", tags=["系统"], summary="健康检查")
    def health():
        """【接口】健康检查：容器编排与负载均衡探活使用（返回统一响应结构）"""
        return ok({"status": "up"})

    return app


# 模块级应用实例：uvicorn app.main:app 引用
app = create_app()
