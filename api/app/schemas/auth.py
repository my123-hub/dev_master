# -*- coding: utf-8 -*-
"""
【模块功能】认证相关 Pydantic 请求/响应模型（Schema）
——接口层数据契约：登录请求、令牌响应、改密请求、当前用户信息。
依据：PRD §9.1（BR-01~06）、开发技术文档 §6 接口设计。
"""
import re

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    """【请求模型】登录：用户名 + 密码（BR-01 登录名由管理员创建，支持字母/数字）"""

    username: str = Field(..., min_length=1, max_length=50, description="登录名")
    password: str = Field(..., min_length=1, max_length=64, description="密码")


class TokenResponse(BaseModel):
    """【响应模型】登录成功返回：JWT 令牌 + 首次登录强制改密标记（BR-06）"""

    access_token: str = Field(..., description="JWT 访问令牌")
    token_type: str = "bearer"                       # 固定认证方式，前端按 Bearer 携带
    must_change_pwd: bool = Field(..., description="是否需强制修改密码（首次登录为 True）")


class ChangePasswordRequest(BaseModel):
    """【请求模型】修改密码：原密码 + 新密码（BR-05 强度校验）"""

    old_password: str = Field(..., min_length=1, max_length=64, description="原密码")
    new_password: str = Field(..., min_length=8, max_length=64, description="新密码（至少 8 位）")

    @field_validator("new_password")
    @classmethod
    def validate_strength(cls, value: str) -> str:
        """【校验】新密码强度：至少 8 位且同时包含字母与数字（BR-05 强度校验）"""
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("新密码必须同时包含字母和数字")
        return value


class UserInfo(BaseModel):
    """【响应模型】当前用户信息：基础信息 + 角色名 + 权限码集合（前端控制菜单/按钮显隐）"""

    id: int
    username: str
    name: str | None = None
    role_name: str | None = None
    must_change_pwd: bool = False
    permissions: list[str] = Field(default_factory=list, description="权限码集合，如 ['product:view']")
