# -*- coding: utf-8 -*-
"""
【模块功能】后台-门店管理接口：单店信息列表 + 编辑（不开放新增/删除，BR-43~46）
依据：开发技术文档 §6.3.9；PRD BR-43~46；数据库设计文档 §3.7。
本期仅一家门店（上海旗舰店），前端门店页展示本店信息；经纬度字段本期预留不填（FR-54 P2）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Store
from app.schemas.store import StoreOut, StoreUpdate
from app.utils.log_util import add_operation_log

router = APIRouter()


@router.get("/stores", summary="门店列表（BR-43）")
def list_stores(
    db: Session = Depends(get_db),
    user=Depends(require_perm("store:view")),
):
    """【接口】门店列表：本期仅返回唯一一家门店（不启用分页，单店场景）"""
    stores = db.scalars(
        select(Store).where(Store.is_activate == 1).order_by(Store.sort_order.asc(), Store.id.asc())
    ).all()
    return ok([StoreOut.model_validate(s).model_dump() for s in stores])


@router.put("/stores/{store_id}", summary="编辑门店信息（BR-45）")
def update_store(
    store_id: int,
    body: StoreUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("store:edit")),
):
    """【接口】编辑门店：整体替换字段（名称/城市/地址/电话/营业时间/经纬度预留/排序）"""
    store = db.get(Store, store_id)
    if store is None or store.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "门店不存在")
    for k, v in body.model_dump().items():
        setattr(store, k, v)
    add_operation_log(db, user_id=user.id, module="store", action="update",
                      detail=f"编辑门店「{store.name}」(id={store.id})")
    db.commit()
    return ok(StoreOut.model_validate(store).model_dump(), message="门店信息更新成功")
