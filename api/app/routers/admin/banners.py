# -*- coding: utf-8 -*-
"""
【模块功能】后台-首页配置接口：轮播图 CRUD + 启用/停用
依据：开发技术文档 §6.3.9；PRD BR-47~50；数据库设计文档 §3.8.1。
要点：轮播支持启用/停用独立切换（BR-50）；删除为软删除（is_activate=0）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Banner
from app.schemas.content import BannerCreate, BannerOut, BannerStatusRequest, BannerUpdate
from app.utils.log_util import add_operation_log

router = APIRouter()


@router.get("/banners", summary="轮播图列表（BR-47）")
def list_banners(
    db: Session = Depends(get_db),
    user=Depends(require_perm("home:view")),
):
    """【接口】轮播列表：全量返回（含已停用，管理端展示开关状态）"""
    items = db.scalars(
        select(Banner).order_by(Banner.sort_order.asc(), Banner.id.asc())
    ).all()
    return ok([BannerOut.model_validate(b).model_dump() for b in items])


@router.post("/banners", summary="新增轮播图（BR-48）")
def create_banner(
    body: BannerCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("home:edit")),
):
    """【接口】新增轮播：图片地址必填（由上传接口先行返回）"""
    b = Banner(**body.model_dump())
    db.add(b)
    db.flush()
    add_operation_log(db, user_id=user.id, module="home", action="create",
                      detail=f"新增轮播「{b.title or '(无标题)'}」(id={b.id})")
    db.commit()
    return ok(BannerOut.model_validate(b).model_dump(), message="轮播创建成功")


@router.put("/banners/{banner_id}", summary="编辑轮播图（BR-49）")
def update_banner(
    banner_id: int,
    body: BannerUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("home:edit")),
):
    """【接口】编辑轮播：整体替换字段"""
    b = db.get(Banner, banner_id)
    if b is None or b.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "轮播不存在")
    for k, v in body.model_dump().items():
        setattr(b, k, v)
    add_operation_log(db, user_id=user.id, module="home", action="update",
                      detail=f"编辑轮播「{b.title or '(无标题)'}」(id={b.id})")
    db.commit()
    return ok(BannerOut.model_validate(b).model_dump(), message="轮播更新成功")


@router.delete("/banners/{banner_id}", summary="删除轮播图")
def delete_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("home:edit")),
):
    """【接口】软删除轮播：is_activate=0（历史配置可追溯）"""
    b = db.get(Banner, banner_id)
    if b is None or b.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "轮播不存在")
    b.is_activate = 0
    add_operation_log(db, user_id=user.id, module="home", action="delete",
                      detail=f"删除轮播(id={banner_id})")
    db.commit()
    return ok(message="轮播删除成功")


@router.put("/banners/{banner_id}/status", summary="轮播启用/停用（BR-50）")
def change_banner_status(
    banner_id: int,
    body: BannerStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("home:edit")),
):
    """【接口】启用/停用：仅切换 is_activate（前台首页只展示启用项）"""
    b = db.get(Banner, banner_id)
    if b is None:
        raise BizError(Code.NOT_FOUND, "轮播不存在")
    b.is_activate = body.is_activate
    add_operation_log(db, user_id=user.id, module="home", action="update",
                      detail=f"轮播(id={banner_id})启用状态 → {body.is_activate}")
    db.commit()
    return ok(message="状态已更新")
