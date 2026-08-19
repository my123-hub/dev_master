# -*- coding: utf-8 -*-
"""
【模块功能】后台-统一文件上传接口：图片校验 + 随机文件名 + 本地存储 + URL 回显
依据：开发技术文档 §6.3.11；PRD BR-19、NFR-09。
规则：
- 仅接受 jpg/jpeg/png/webp 图片（BR-19 类型白名单）；
- 单文件 ≤5MB（NFR-09）；
- 文件名随机（uuid4 + 原扩展名），避免冲突与路径注入；
- 返回 {url: "/static/uploads/xxx.webp"}，前端直接拼接访问。
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.utils.log_util import add_operation_log

router = APIRouter()

# 允许的图片类型（按扩展名白名单校验，BR-19）
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
# 单文件大小上限 5MB（NFR-09）
MAX_SIZE = 5 * 1024 * 1024


@router.post("/upload", summary="图片上传（BR-19/NFR-09）")
async def upload_image(
    file: UploadFile,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """【接口】图片上传（开发技术文档 §6.3.11：perm 标注"upload 或随模块"，种子无独立 upload 权限点，仅需登录即可）：
    1. 校验扩展名与大小（流式读取，超限立即中断）；
    2. 生成随机文件名（uuid4 + 原扩展名）写入 uploads/ 目录；
    3. 返回静态资源 URL（/static/uploads/...）。
    """
    # 1) 扩展名白名单校验（BR-19）：不合法直接拒绝，不落盘
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise BizError(Code.VALIDATE_ERROR, f"仅支持图片格式：{', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # 2) 大小校验：流式读取并计数，超过 5MB 立即中断并删除已写部分（NFR-09）
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    # 随机文件名：uuid4 十六进制 + 原始扩展名（防冲突/防路径注入）
    filename = f"{uuid.uuid4().hex}{ext}"
    target = upload_dir / filename

    size = 0
    try:
        with target.open("wb") as f:
            while chunk := await file.read(1024 * 1024):   # 每次读 1MB
                size += len(chunk)
                if size > MAX_SIZE:
                    raise BizError(Code.TOO_LARGE, "图片大小不能超过 5MB")
                f.write(chunk)
    except BizError:
        # 超限：清理已落盘的部分文件，避免残留
        target.unlink(missing_ok=True)
        raise

    # 3) 返回静态资源 URL（由 main.py 挂载 /static/uploads 静态目录提供服务）
    url = f"/static/uploads/{filename}"
    add_operation_log(db, user_id=user.id, module="system", action="upload",
                      detail=f"上传图片 {filename} ({size} bytes)")
    db.commit()
    return ok({"url": url, "size": size}, message="上传成功")
