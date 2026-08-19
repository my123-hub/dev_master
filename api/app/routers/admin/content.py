# -*- coding: utf-8 -*-
"""
【模块功能】后台-内容管理接口：单页内容 / 发展历程 / FAQ / 系统配置
依据：开发技术文档 §6.3.8/§6.3.9；PRD BR-39~42、BR-51；数据库设计文档 §3.6/§3.9。
要点：
- 单页按 content_type 唯一定位（GET 无记录返回空模板，PUT 无记录自动创建——种子已建模板）；
- 配置批量保存：GET 返回全部键值，PUT 只更新传入的键（未传入保持原值）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Faq, MilestoneItem, PageContent, SysConfig
from app.schemas.content import (
    ConfigItem, ConfigUpdateRequest, FaqCreate, FaqOut, FaqUpdate,
    MilestoneCreate, MilestoneOut, MilestoneUpdate, PageContentOut, PageContentUpdate,
)
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()


# ============================================================
# 一、单页内容（关于STK/品牌/售后等，BR-39）
# ============================================================

# 允许编辑的单页类型白名单（content_type 枚举，防任意键注入）
PAGE_TYPES = ("about_stk", "brand_intro", "after_sales_policy")


@router.get("/pages/{content_type}", summary="单页内容详情（BR-39）")
def get_page(
    content_type: str,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:view")),
):
    """【接口】单页详情：无记录时返回空模板（title/content/cover 均为空，前端可新建）"""
    if content_type not in PAGE_TYPES:
        raise BizError(Code.NOT_FOUND, "不支持的页面类型")
    page = db.scalar(select(PageContent).where(PageContent.content_type == content_type))
    if page is None:
        return ok({"content_type": content_type, "title": None, "content": None,
                   "cover_url": None, "is_activate": 1, "updated_date": None})
    return ok(PageContentOut.model_validate(page).model_dump())


@router.put("/pages/{content_type}", summary="保存单页内容（BR-39）")
def update_page(
    content_type: str,
    body: PageContentUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:edit")),
):
    """【接口】保存单页：记录存在则更新，不存在则自动创建（幂等）"""
    if content_type not in PAGE_TYPES:
        raise BizError(Code.NOT_FOUND, "不支持的页面类型")
    page = db.scalar(select(PageContent).where(PageContent.content_type == content_type))
    if page is None:
        # 自动创建：避免前台访问时无内容（种子已建 about_stk/brand_intro/after_sales_policy 模板）
        page = PageContent(content_type=content_type, **body.model_dump())
        db.add(page)
        add_operation_log(db, user_id=user.id, module="content", action="create",
                          detail=f"创建单页「{content_type}」")
    else:
        for k, v in body.model_dump().items():
            setattr(page, k, v)
        add_operation_log(db, user_id=user.id, module="content", action="update",
                          detail=f"更新单页「{content_type}」")
    db.commit()
    return ok(PageContentOut.model_validate(page).model_dump(), message="保存成功")


# ============================================================
# 二、发展历程（BR-40）
# ============================================================

@router.get("/milestones", summary="发展历程列表（BR-40）")
def list_milestones(
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:view")),
):
    """【接口】历程列表：按 sort_order 倒序（时间倒序展示，近期在前，PRD FR-40）"""
    items = db.scalars(
        select(MilestoneItem)
        .where(MilestoneItem.is_activate == 1)
        .order_by(MilestoneItem.sort_order.desc(), MilestoneItem.id.desc())
    ).all()
    return ok([MilestoneOut.model_validate(m).model_dump() for m in items])


@router.post("/milestones", summary="新增发展历程条目")
def create_milestone(
    body: MilestoneCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:edit")),
):
    """【接口】新增历程条目"""
    m = MilestoneItem(**body.model_dump())
    db.add(m)
    db.flush()
    add_operation_log(db, user_id=user.id, module="content", action="create",
                      detail=f"新增历程「{m.year} {m.title or ''}」(id={m.id})")
    db.commit()
    return ok(MilestoneOut.model_validate(m).model_dump(), message="创建成功")


@router.put("/milestones/{item_id}", summary="编辑发展历程条目")
def update_milestone(
    item_id: int,
    body: MilestoneUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:edit")),
):
    """【接口】编辑历程条目"""
    m = db.get(MilestoneItem, item_id)
    if m is None or m.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "历程条目不存在")
    for k, v in body.model_dump().items():
        setattr(m, k, v)
    add_operation_log(db, user_id=user.id, module="content", action="update",
                      detail=f"编辑历程「{m.year} {m.title or ''}」(id={m.id})")
    db.commit()
    return ok(MilestoneOut.model_validate(m).model_dump(), message="更新成功")


@router.delete("/milestones/{item_id}", summary="删除发展历程条目")
def delete_milestone(
    item_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:edit")),
):
    """【接口】软删除历程条目"""
    m = db.get(MilestoneItem, item_id)
    if m is None or m.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "历程条目不存在")
    m.is_activate = 0
    add_operation_log(db, user_id=user.id, module="content", action="delete",
                      detail=f"删除历程条目(id={item_id})")
    db.commit()
    return ok(message="删除成功")


# ============================================================
# 三、FAQ（BR-41）
# ============================================================

@router.get("/faqs", summary="FAQ 列表（BR-41）")
def list_faqs(
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:view")),
):
    """【接口】FAQ 列表：按 sort_order 小在前（前台手风琴顺序，PRD FR-52）"""
    items = db.scalars(
        select(Faq)
        .where(Faq.is_activate == 1)
        .order_by(Faq.sort_order.asc(), Faq.id.asc())
    ).all()
    return ok([FaqOut.model_validate(f).model_dump() for f in items])


@router.post("/faqs", summary="新增 FAQ")
def create_faq(
    body: FaqCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:edit")),
):
    """【接口】新增 FAQ"""
    f = Faq(**body.model_dump())
    db.add(f)
    db.flush()
    add_operation_log(db, user_id=user.id, module="content", action="create",
                      detail=f"新增 FAQ「{f.question[:30]}」(id={f.id})")
    db.commit()
    return ok(FaqOut.model_validate(f).model_dump(), message="创建成功")


@router.put("/faqs/{faq_id}", summary="编辑 FAQ")
def update_faq(
    faq_id: int,
    body: FaqUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:edit")),
):
    """【接口】编辑 FAQ"""
    f = db.get(Faq, faq_id)
    if f is None or f.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "FAQ 不存在")
    for k, v in body.model_dump().items():
        setattr(f, k, v)
    add_operation_log(db, user_id=user.id, module="content", action="update",
                      detail=f"编辑 FAQ「{f.question[:30]}」(id={f.id})")
    db.commit()
    return ok(FaqOut.model_validate(f).model_dump(), message="更新成功")


@router.delete("/faqs/{faq_id}", summary="删除 FAQ")
def delete_faq(
    faq_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("content:edit")),
):
    """【接口】软删除 FAQ"""
    f = db.get(Faq, faq_id)
    if f is None or f.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "FAQ 不存在")
    f.is_activate = 0
    add_operation_log(db, user_id=user.id, module="content", action="delete",
                      detail=f"删除 FAQ「{f.question[:30]}」(id={f.id})")
    db.commit()
    return ok(message="删除成功")


# ============================================================
# 四、系统配置（品牌标语/亮点文案/联系信息，BR-42/BR-51）
# ============================================================

@router.get("/config", summary="系统配置列表（BR-51）")
def list_config(
    db: Session = Depends(get_db),
    user=Depends(require_perm("home:view")),
):
    """【接口】配置列表：返回全部启用配置的键值对（前端按模块取用）"""
    rows = db.scalars(
        select(SysConfig).where(SysConfig.is_activate == 1).order_by(SysConfig.id.asc())
    ).all()
    return ok([{"config_key": r.config_key, "config_value": r.config_value} for r in rows])


@router.put("/config", summary="批量保存配置（BR-42/BR-51）")
def update_config(
    body: ConfigUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("home:edit")),
):
    """【接口】批量保存：按 config_key 定位，存在则更新值，不存在则自动创建（幂等）"""
    for item in body.items:
        row = db.scalar(select(SysConfig).where(SysConfig.config_key == item.config_key))
        if row is None:
            db.add(SysConfig(config_key=item.config_key, config_value=item.config_value))
        else:
            row.config_value = item.config_value
    add_operation_log(db, user_id=user.id, module="home", action="update",
                      detail=f"保存系统配置 {len(body.items)} 项")
    db.commit()
    return ok(message="配置保存成功")
