# -*- coding: utf-8 -*-
"""
【模块功能】认证与权限依赖（FastAPI Depends）
——get_current_user：解析 JWT 并加载用户；require_perm：服务端强制权限校验（PRD NFR-07）。
设计要点：
- 首次登录强制改密（must_change_pwd=True）用户仅可访问改密/me 接口，其余接口在 require_perm 中拦截（BR-06）；
- 权限码集合按请求加载（SQLite 下开销可忽略，生产可加缓存）。
"""
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.response import Code
from app.core.security import decode_token
from app.db.session import get_db
from app.models import SysUser
from app.services.auth import get_user_permissions

# 从 Authorization: Bearer <token> 提取令牌；auto_error=False 便于自定义 401 提示
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> SysUser:
    """【依赖】当前登录用户：
    - 无令牌/令牌无效/过期 → 40100；
    - 用户不存在或已禁用（is_activate=0）→ 40100。
    """
    if credentials is None:
        raise BizError(Code.UNAUTHORIZED, "未登录或登录已过期")
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise BizError(Code.UNAUTHORIZED, "登录已过期，请重新登录")

    user = db.get(SysUser, int(payload["sub"]))
    if user is None or user.is_activate != 1:
        raise BizError(Code.UNAUTHORIZED, "账号不存在或已禁用")
    return user


def require_perm(perm_code: str):
    """【依赖工厂】权限点校验：
    用法：`perm_user: SysUser = Depends(require_perm("product:edit"))`
    - 首次登录未改密 → 10001（前端拦截跳转改密页）；
    - 无对应权限码 → 40300（服务端强制，前端仅隐藏入口）。
    """
    def dependency(
        user: SysUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> SysUser:
        # 首次登录强制改密拦截：除改密/me 外全部管理接口均需通过本依赖（BR-06）
        if user.must_change_pwd:
            raise BizError(Code.PASSWORD_EXPIRED, "首次登录请先修改密码")

        permissions = get_user_permissions(db, user)
        if perm_code not in permissions:
            raise BizError(Code.FORBIDDEN, "无权限执行此操作")
        return user

    return dependency
