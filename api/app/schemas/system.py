# -*- coding: utf-8 -*-
"""
【模块功能】系统管理请求/响应模型（Pydantic v2）
——用户管理 / 角色权限 / 操作日志 / 部门 的数据契约。
依据：数据库设计文档 V1.3 §3.1；开发技术文档 §6.3.12；PRD BR-61/62/63。
"""
import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ==================== 用户管理（sys_user） ====================
class UserCreate(BaseModel):
    """【请求模型】新增用户（BR-61）：
    - username 登录名唯一；password 强度校验（字母+数字，≥8 位，BR-05）；
    - role_id 必填（绑定角色）；dept_id 可选（归属部门）。
    """

    username: str = Field(min_length=1, max_length=50, description="登录名(唯一)")
    password: str = Field(min_length=8, max_length=64, description="初始密码（首次登录强制修改）")
    name: str | None = Field(default=None, max_length=50, description="姓名")
    nickname: str | None = Field(default=None, max_length=50, description="昵称")
    mobile: str | None = Field(default=None, max_length=20, description="手机号")
    email: str | None = Field(default=None, max_length=100, description="邮箱")
    gender: int = Field(default=0, ge=0, le=2, description="性别 0未知/1男/2女")
    position: str | None = Field(default=None, max_length=50, description="岗位")
    dept_id: int | None = Field(default=None, description="部门 ID")
    role_id: int = Field(..., description="角色 ID（必填，关联 sys_role）")

    @field_validator("password")
    @classmethod
    def _validate_pwd(cls, value: str) -> str:
        """【校验】密码强度：≥8 位且同时含字母与数字（BR-05）"""
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("密码必须同时包含字母和数字，至少 8 位")
        return value


class UserUpdate(BaseModel):
    """【请求模型】编辑用户：字段均可选；is_activate 用于「停用/启用」切换（BR-61）"""

    name: str | None = Field(default=None, max_length=50)
    nickname: str | None = Field(default=None, max_length=50)
    mobile: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=100)
    gender: int | None = Field(default=None, ge=0, le=2)
    position: str | None = Field(default=None, max_length=50)
    dept_id: int | None = Field(default=None)
    role_id: int | None = Field(default=None)
    is_activate: int | None = Field(default=None, ge=0, le=1, description="1 启用 / 0 停用")


class UserOut(BaseModel):
    """【响应模型】用户输出：附加角色名/部门名（列表与详情通用）"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str | None = None
    nickname: str | None = None
    mobile: str | None = None
    email: str | None = None
    gender: int = 0
    position: str | None = None
    dept_id: int | None = None
    dept_name: str | None = None
    role_id: int
    role_name: str | None = None
    is_activate: int = 1
    must_change_pwd: bool = False
    last_login_at: datetime | None = None
    created_date: datetime | None = None


class UserPasswordReset(BaseModel):
    """【响应模型】重置密码：返回生成的新密码，供管理员告知用户（BR-61）"""

    new_password: str = Field(description="重置后的新密码（用户首次登录需再次修改）")


# ==================== 角色权限（sys_role / sys_permission / sys_role_permission） ====================
class RoleOut(BaseModel):
    """【响应模型】角色输出：含该角色权限码集合；is_builtin 标记内置超管（不可改权限）"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    role_name: str
    remark: str | None = None
    permissions: list[str] = Field(default_factory=list, description="该角色拥有的权限码集合")
    is_builtin: bool = False


class RolePermissionUpdate(BaseModel):
    """【请求模型】配置角色权限点（BR-62）：提交权限码集合（服务端强制校验，NFR-07）"""

    permission_codes: list[str] = Field(default_factory=list, description="角色权限码集合")
    remark: str | None = Field(default=None, max_length=200, description="角色说明（可选）")


# ==================== 操作日志（sys_operation_log） ====================
class LogItem(BaseModel):
    """【响应模型】操作日志输出：附加操作人登录名（user_id → sys_user.username，逻辑关联）"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    username: str | None = None
    module: str | None = None
    action: str | None = None
    detail: str | None = None
    ip: str | None = None
    created_date: datetime | None = None
