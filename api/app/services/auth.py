# -*- coding: utf-8 -*-
"""
【模块功能】认证服务层：登录校验 / 修改密码 / 权限码集合查询
——路由层只做参数透传，业务规则集中在此（分层约束：Router → Service → Model）。
依据：PRD §9.1（BR-01/02/05/06）、NFR-07（权限服务端强制）。
"""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.response import Code
from app.core.security import hash_password, verify_password
from app.models import Permission, RolePermission, SysUser


def authenticate(db: Session, username: str, password: str) -> SysUser:
    """【函数说明】登录认证：
    - 用户不存在或密码错误统一提示"用户名或密码错误"，不泄露账号是否存在（BR-02 防枚举）；
    - 禁用账号（is_activate=0）拒绝登录。
    返回通过认证的用户对象（调用方负责签发 JWT 与更新登录时间）。
    """
    user = db.scalar(select(SysUser).where(SysUser.username == username, SysUser.is_activate == 1))
    if user is None or not verify_password(password, user.password_hash):
        raise BizError(Code.LOGIN_FAILED, "用户名或密码错误")
    return user


def get_user_permissions(db: Session, user: SysUser) -> list[str]:
    """【函数说明】查询用户权限码集合（RBAC）：
    经 sys_role_permission → sys_permission 解析，供 /auth/me 与接口权限校验共用。
    """
    stmt = (
        select(Permission.perm_code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(
            RolePermission.role_id == user.role_id,
            Permission.is_activate == 1,
            RolePermission.is_activate == 1,
        )
    )
    return list(db.scalars(stmt).all())


def update_last_login(db: Session, user: SysUser) -> None:
    """【函数说明】更新最后登录时间（sys_user.last_login_at，BR-01）"""
    user.last_login_at = datetime.now()
    db.add(user)


def change_password(db: Session, user: SysUser, old_password: str, new_password: str) -> None:
    """【函数说明】修改密码：
    - 原密码校验失败抛 OLD_PASSWORD_WRONG（BR-05）；
    - 成功后更新哈希并清除强制改密标记（BR-06 流程闭环）。
    """
    if not verify_password(old_password, user.password_hash):
        raise BizError(Code.OLD_PASSWORD_WRONG, "原密码错误")
    user.password_hash = hash_password(new_password)
    user.must_change_pwd = False        # 首次登录强制改密完成后解除限制
    db.add(user)
