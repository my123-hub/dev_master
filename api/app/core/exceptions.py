# -*- coding: utf-8 -*-
"""
【模块功能】全局业务异常定义与异常处理
——业务层抛出自定义异常，由全局异常处理器统一转换为 {code, message, data} 响应结构。
依据：开发技术文档 §1.3.2（全局异常处理与错误码约定）。
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.response import Code

# 获取模块级日志器：异常统一记录到后端日志（PRD NFR-19）
logger = logging.getLogger("app")


class BizError(Exception):
    """【类说明】业务异常基类：
    - code：业务错误码（见 response.Code）
    - message：人类可读提示，直接透传给前端展示
    """

    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    """【函数说明】注册全局异常处理器到 FastAPI 应用：
    - BizError → 业务码响应
    - RequestValidationError → 40000 参数校验错误（提取首条错误信息）
    - HTTPException → 兼容框架级异常（401/403/404 等映射业务码）
    - Exception → 50000 兜底（记录完整堆栈，避免泄漏内部细节）
    """

    @app.exception_handler(BizError)
    async def biz_error_handler(request: Request, exc: BizError):
        """业务异常：直接返回约定错误码与提示"""
        return JSONResponse(
            status_code=200,  # 业务码在 body 中表达，HTTP 层统一 200 简化前端处理
            content={"code": exc.code, "message": exc.message, "data": None},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        """参数校验异常：提取第一条校验错误信息返回（如“name 字段必填”）"""
        errors = exc.errors()
        first = errors[0] if errors else {}
        # 定位出错字段路径，如 body.name → name
        loc = first.get("loc", [])
        field = loc[-1] if loc else "参数"
        msg = first.get("msg", "参数校验失败")
        return JSONResponse(
            status_code=200,
            content={"code": Code.VALIDATE_ERROR, "message": f"{field}: {msg}", "data": None},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException):
        """框架级 HTTP 异常：映射到统一业务码（401→40100 / 403→40300 / 404→40400）"""
        code_map = {
            401: Code.UNAUTHORIZED,
            403: Code.FORBIDDEN,
            404: Code.NOT_FOUND,
        }
        return JSONResponse(
            status_code=200,
            content={
                "code": code_map.get(exc.status_code, exc.status_code * 1000),
                "message": exc.detail if isinstance(exc.detail, str) else "请求错误",
                "data": None,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        """未捕获异常兜底：记录完整堆栈（含 URL 便于排查），返回 50000 通用提示"""
        logger.exception("Unhandled error: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=200,
            content={"code": Code.SERVER_ERROR, "message": "服务器内部错误，请稍后重试", "data": None},
        )
