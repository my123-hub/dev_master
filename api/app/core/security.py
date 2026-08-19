# -*- coding: utf-8 -*-
"""
【模块功能】安全工具：密码哈希（bcrypt）+ JWT 签发/校验
依据：PRD §9.1（BR-01/02 密码 bcrypt 加密、JWT 认证）、BR-04（7 天会话）。
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


# ---------- 密码哈希（bcrypt） ----------
def hash_password(plain: str) -> str:
    """【函数说明】生成 bcrypt 密码哈希（自动加盐）：
    bcrypt 内置盐值，每次哈希结果不同但均可校验，用于密码加密存储（PRD BR-02）。
    """
    # encode：字符串转字节；bcrypt.hashpw 返回带盐的哈希字节，解码为字符串存储
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """【函数说明】校验明文密码与存储哈希是否匹配：
    登录时使用；不匹配仅返回 False，不暴露账号是否存在（PRD BR-02）。
    """
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # 存储哈希格式非法时视为校验失败，避免异常泄露
        return False


# ---------- JWT 签发与校验 ----------
def create_access_token(user_id: int, role_id: int) -> str:
    """【函数说明】签发 JWT 访问令牌：
    payload 包含 sub（用户ID）、role_id（角色ID）、exp（过期时间=7 天，BR-04）；
    返回签名字符串，前端存于本地并在请求头 Authorization: Bearer <token> 携带。
    """
    now = datetime.now(timezone.utc)
    # exp 必须为 UTC 时间戳；jwt.encode 自动处理数据类型
    payload = {
        "sub": str(user_id),        # 统一字符串，避免 int 跨语言解析歧义
        "role_id": role_id,
        "iat": now,                 # 签发时间
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """【函数说明】校验并解析 JWT：
    - 签名无效/过期抛出 jwt.InvalidTokenError → 返回 None，由调用方判定 401；
    - 成功返回 payload 字典（含 sub/role_id/exp）。
    """
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
