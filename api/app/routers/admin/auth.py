# -*- coding: utf-8 -*-
"""
【模块功能】后台认证接口：登录 / 当前用户 / 修改密码
依据：PRD §9.1（BR-01 登录、BR-02 登录失败限流、BR-05 改密、BR-06 强制改密）、§11.2 接口清单。
限流：自研内存限流器（登录 10 次/分钟/IP，见 utils/rate_limit.py）。
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.core.security import create_access_token
from app.db.session import get_db
from app.models import SysUser
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserInfo
from app.services import auth as auth_service
from app.utils.log_util import add_operation_log
from app.utils.rate_limit import rate_limiter

router = APIRouter()

# 登录限流参数：从配置读取（默认 10 次/分钟/IP）
_LOGIN_LIMIT = 10
_LOGIN_WINDOW = 60


@router.post("/login", summary="账号密码登录（BR-01/BR-02）")
def login(
    request: Request,                 # 用于取客户端 IP（限流维度）
    body: LoginRequest,               # 请求体：用户名 + 密码
    db: Session = Depends(get_db),    # 数据库会话
):
    """【接口】登录：失败限流 → 认证 → 签发 JWT → 记录登录时间与操作日志"""
    # 登录限流：同一 IP 60 秒内最多 10 次（BR-02 防暴力破解；触发返回 42900）
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.check(f"login:{client_ip}", _LOGIN_LIMIT, _LOGIN_WINDOW):
        raise BizError(Code.RATE_LIMITED, "登录尝试过于频繁，请稍后再试")

    # 认证：失败统一抛 10003（不泄露账号是否存在，BR-02）
    user = auth_service.authenticate(db, body.username, body.password)
    # 签发 7 天有效期的 JWT（BR-04）
    token = create_access_token(user.id, user.role_id)
    # 更新最后登录时间并写入操作日志
    auth_service.update_last_login(db, user)
    add_operation_log(db, user_id=user.id, module="system", action="login",
                      detail=f"用户 {user.username} 登录系统", ip=client_ip)
    db.commit()
    return ok(TokenResponse(access_token=token, must_change_pwd=user.must_change_pwd).model_dump())


@router.get("/me", summary="当前用户信息与权限（BR-03）")
def me(user: SysUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """【接口】当前用户：基础信息 + 角色名 + 权限码集合（前端据此控制菜单/按钮显隐）"""
    permissions = auth_service.get_user_permissions(db, user)
    return ok(UserInfo(
        id=user.id,
        username=user.username,
        name=user.name,
        role_name=user.role.role_name if user.role else None,
        must_change_pwd=user.must_change_pwd,
        permissions=permissions,
    ).model_dump())


@router.put("/password", summary="修改密码（BR-05/BR-06）")
def change_password(
    body: ChangePasswordRequest,
    user: SysUser = Depends(get_current_user),   # 放行强制改密状态（不经过 require_perm）
    db: Session = Depends(get_db),
):
    """【接口】修改密码：校验原密码 → 更新哈希 → 清除强制改密标记"""
    auth_service.change_password(db, user, body.old_password, body.new_password)
    add_operation_log(db, user_id=user.id, module="system", action="update",
                      detail=f"用户 {user.username} 修改密码")
    db.commit()
    return ok(message="密码修改成功")
