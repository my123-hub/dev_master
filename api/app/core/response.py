# -*- coding: utf-8 -*-
"""
【模块功能】统一响应结构与业务错误码
——所有接口（含错误）返回统一结构 {code, message, data}（开发技术文档 §1.3.1）。
code=0 表示成功；非 0 表示业务/校验失败，message 供前端直接 toast 展示。
"""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

# 泛型参数：用于构造分页/数据包装对象的类型标注
T = TypeVar("T")


# ---------- 业务错误码定义（开发技术文档 §1.3.2） ----------
class Code:
    """【类说明】集中管理业务错误码常量，便于统一维护与检索"""

    OK = 0               # 成功
    VALIDATE_ERROR = 40000   # 参数校验失败（Pydantic 校验错误）
    UNAUTHORIZED = 40100     # 未认证 / Token 无效或过期
    FORBIDDEN = 40300        # 无权限（服务端强制校验，PRD NFR-07）
    NOT_FOUND = 40400        # 资源不存在
    CONFLICT = 40900         # 数据冲突（如唯一键重复、有关联数据禁止删除）
    TOO_LARGE = 41300        # 上传文件过大
    RATE_LIMITED = 42900     # 触发限流
    SERVER_ERROR = 50000     # 服务器内部错误
    # 业务自定义码（≥100000 段）
    PASSWORD_EXPIRED = 10001  # 首次登录需强制修改密码（PRD BR-06）
    OLD_PASSWORD_WRONG = 10002 # 修改密码时原密码错误（PRD BR-05）
    LOGIN_FAILED = 10003      # 登录失败（不区分账号不存在/密码错误，防枚举，PRD BR-02）


class ApiResponse(BaseModel, Generic[T]):
    """【类说明】统一响应包装模型：
    - code：业务码（0 成功）
    - message：人类可读提示
    - data：业务数据（可为任意类型/None）
    """

    code: int = Code.OK
    message: str = "ok"
    data: T | None = None


class PageData(BaseModel, Generic[T]):
    """【类说明】分页列表 data 结构（开发技术文档 §1.3.1）：
    items 当前页数据、total 总条数、page 当前页码、page_size 每页条数、pages 总页数
    """

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


def ok(data: Any = None, message: str = "ok") -> ApiResponse:
    """【函数说明】构造成功响应（code=0）"""
    return ApiResponse(code=Code.OK, message=message, data=data)


def fail(code: int, message: str, data: Any = None) -> ApiResponse:
    """【函数说明】构造失败响应（非 0 业务码 + 可读提示）"""
    return ApiResponse(code=code, message=message, data=data)
