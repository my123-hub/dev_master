# -*- coding: utf-8 -*-
"""
【模块功能】系统管理域模型（6 张表）：sys_user / department / sys_role / sys_permission / sys_role_permission / sys_operation_log
依据：数据库设计文档 V1.3 §3.1 数据字典；RBAC 权限模型（角色-权限点，PRD §5.2）。
"""
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey, SmallInteger, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import AuditFieldsMixin, Base, CommonMixin


class Department(CommonMixin, Base):
    """【表】department 部门：自关联上级部门（parent_id → department.id），用于后台账号组织归属"""

    __tablename__ = "department"

    dept_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="部门名称")
    # 自关联外键：上级部门；顶级部门该字段为 NULL
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("department.id"), nullable=True, index=True, comment="上级部门(自关联)"
    )

    # 关系：子部门列表（查询某部门下的所有子部门）
    children: Mapped[list["Department"]] = relationship(back_populates="parent")
    # 关系：上级部门对象（remote_side 指向"多"的一侧主键，即父级 id；用字符串避免类体内引用歧义）
    parent: Mapped["Department | None"] = relationship(
        back_populates="children", remote_side="Department.id"
    )


class Role(CommonMixin, Base):
    """【表】sys_role 角色：内置超级管理员/内容编辑（数据库设计文档 §5.1 种子）"""

    __tablename__ = "sys_role"

    role_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="角色名称(唯一)")
    # 角色说明：便于后台展示角色用途
    remark: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="角色说明")

    # 关系：该角色下的用户列表
    users: Mapped[list["SysUser"]] = relationship(back_populates="role")


class Permission(CommonMixin, Base):
    """【表】sys_permission 权限点：按后台菜单/功能模块拆分（如 product:edit），服务端强制执行（PRD NFR-07）"""

    __tablename__ = "sys_permission"

    perm_code: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, comment="权限码，如 product:edit")
    perm_name: Mapped[str | None] = mapped_column(String(80), nullable=True, comment="权限名称")
    menu_key: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="关联后台菜单 key")


class RolePermission(AuditFieldsMixin, Base):
    """【表】sys_role_permission 角色-权限关联：复合主键 (role_id, permission_id)，多对多关系
    两个主键列组合唯一，避免同一 (角色, 权限) 重复授权。
    注意：本表无自增 id 主键（数据库设计文档 V1.3 §3.1.5），故继承 AuditFieldsMixin 而非 CommonMixin。
    """

    __tablename__ = "sys_role_permission"

    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("sys_role.id"), primary_key=True, comment="角色 ID → sys_role.id"
    )
    permission_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("sys_permission.id"), primary_key=True, comment="权限点 ID → sys_permission.id"
    )


class SysUser(CommonMixin, Base):
    """【表】sys_user 后台管理员账号：登录名唯一、bcrypt 密码哈希、首次登录强制改密（PRD BR-06）"""

    __tablename__ = "sys_user"

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="登录名(唯一)")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, comment="bcrypt 密码哈希")
    name: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="姓名")
    nickname: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="昵称")
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="手机号")
    email: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="邮箱")
    gender: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, comment="性别 0未知/1男/2女")
    position: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="岗位")
    dept_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("department.id"), nullable=True, index=True, comment="部门 → department.id"
    )
    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("sys_role.id"), nullable=False, index=True, comment="角色 → sys_role.id"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="最后登录时间")
    # 首次登录强制改密标记（BR-06）：为 True 时仅允许访问修改密码接口
    must_change_pwd: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1", comment="首次登录强制改密"
    )

    # 关系：所属角色（登录后取权限集合需要）
    role: Mapped["Role"] = relationship(back_populates="users")
    # 关系：所属部门
    dept: Mapped["Department | None"] = relationship()


class OperationLog(CommonMixin, Base):
    """【表】sys_operation_log 操作日志：记录关键操作（登录/增删改/状态流转/导出），只读（PRD BR-63）"""

    __tablename__ = "sys_operation_log"

    user_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="操作人 → sys_user.id"
    )
    module: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True, comment="模块，如 product")
    action: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="动作 create/update/delete/status/export/login")
    detail: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="操作详情，如「下架产品：胡桃木餐桌」")
    ip: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="来源 IP")
