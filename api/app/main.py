# -*- coding: utf-8 -*-
"""
【模块功能】FastAPI 应用入口
——装配配置、CORS、全局异常、路由；提供 /api/health 健康检查与 /static/uploads 静态资源。
依据：开发技术文档 §2（总体架构）、§1.3（统一响应）、NFR-22（环境隔离）。
启动：uvicorn app.main:app --reload --port 8000（在 api/ 目录下）
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.response import ok
from app.routers.admin import auth as admin_auth
from app.routers.admin import banners as admin_banners
from app.routers.admin import cases as admin_cases
from app.routers.admin import categories as admin_categories
from app.routers.admin import content as admin_content
from app.routers.admin import exports as admin_exports
from app.routers.admin import jobs as admin_jobs
from app.routers.admin import leads as admin_leads
from app.routers.admin import news as admin_news
from app.routers.admin import products as admin_products
from app.routers.admin import stores as admin_stores
from app.routers.admin import upload as admin_upload


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
    # 后台认证（登录/me/改密）
    app.include_router(admin_auth.router, prefix="/api/admin/auth", tags=["后台-认证"])
    # M2 后台基础模块：产品系列 / 产品 / 新闻 / 内容 / 轮播 / 上传
    app.include_router(admin_categories.router, prefix="/api/admin", tags=["后台-产品系列"])
    app.include_router(admin_products.router, prefix="/api/admin", tags=["后台-产品"])
    app.include_router(admin_news.router, prefix="/api/admin", tags=["后台-新闻"])
    app.include_router(admin_content.router, prefix="/api/admin", tags=["后台-内容/配置"])
    app.include_router(admin_banners.router, prefix="/api/admin", tags=["后台-首页轮播"])
    app.include_router(admin_upload.router, prefix="/api/admin", tags=["后台-上传"])
    # M3 后台扩展模块：案例 / 招聘职位+投递 / 门店 / 留资(预约+留言) / 导出
    app.include_router(admin_cases.router, prefix="/api/admin", tags=["后台-案例"])
    app.include_router(admin_jobs.router, prefix="/api/admin", tags=["后台-招聘"])
    app.include_router(admin_stores.router, prefix="/api/admin", tags=["后台-门店"])
    app.include_router(admin_leads.router, prefix="/api/admin", tags=["后台-留资"])
    app.include_router(admin_exports.router, prefix="/api/admin", tags=["后台-导出"])

    # 静态资源：上传图片目录（上传接口返回 /static/uploads/... 即映射此处）
    # 目录不存在时自动创建，保证启动即可用（NFR-09 图片回显）
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static/uploads", StaticFiles(directory=upload_dir), name="uploads")

    # ---------- 健康检查 ----------
    @app.get("/api/health", tags=["系统"], summary="健康检查")
    def health():
        """【接口】健康检查：容器编排与负载均衡探活使用（返回统一响应结构）"""
        return ok({"status": "up"})

    return app


# 模块级应用实例：uvicorn app.main:app 引用
app = create_app()
