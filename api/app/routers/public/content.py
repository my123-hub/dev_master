# -*- coding: utf-8 -*-
"""
【模块功能】前台-内容公开接口：案例 / 新闻 / 单页 / 历程 / FAQ / 门店 / 公共配置（§6.2.5~6.2.16）
依据：开发技术文档 §6.2；PRD FR-27~34/39~53。
关键规则：
- 案例：仅发布（status=1）；列表支持 space_tag 筛选；详情含项目信息/富文本/图集。
- 新闻：仅已发布（is_published=1）；publish_time 格式化 YYYY.MM.DD（FR-33）。
- 单页：content_type ∈ about_stk | brand_intro | after_sales_policy。
- 历程：sort_order 倒序（时间倒序展示，FR-40）。
- 公共配置：contact（address/phone/email）+ footer（动态版权，FR-03）。
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import (
    CaseInfo,
    Faq,
    MilestoneItem,
    NewsArticle,
    NewsCategory,
    PageContent,
    Store,
    SysConfig,
)

router = APIRouter()


# ============================================================
# 一、案例（§6.2.5~6.2.6）
# ============================================================

@router.get("/cases", summary="案例列表（§6.2.5）")
def list_cases(
    space_tag: str | None = None,         # 空间标签筛选（FR-29）
    page: int = Query(1, ge=1),
    page_size: int = Query(9, ge=1, le=60),
    db: Session = Depends(get_db),
):
    """【接口】案例列表：仅发布（status=1）；支持 space_tag 标签筛选与分页"""
    # 基础条件：激活 + 已发布（BR-23）
    base = (CaseInfo.is_activate == 1, CaseInfo.status == 1)
    stmt = select(CaseInfo).where(*base)
    if space_tag:
        # JSON 数组包含匹配：JSON 转 TEXT 后 LIKE 匹配（SQLite/PostgreSQL 双库兼容）
        # 注意：cast 需用 SQLAlchemy String 类型而非 Python str（否则 TypeError）
        stmt = stmt.where(CaseInfo.space_tags.cast(String).contains(space_tag))
    stmt = stmt.order_by(CaseInfo.sort_order.asc(), CaseInfo.id.desc())

    count_stmt = select(func.count(CaseInfo.id)).where(*base)
    if space_tag:
        count_stmt = count_stmt.where(CaseInfo.space_tags.cast(String).contains(space_tag))
    total = db.scalar(count_stmt) or 0

    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    items = [
        {"id": c.id, "title": c.title, "cover_url": c.cover_url, "space_tags": c.space_tags or [],
         "city": c.city, "area": c.area}
        for c in rows
    ]
    return ok({
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 1,
    })


@router.get("/cases/{case_id}", summary="案例详情（§6.2.6）")
def get_case(case_id: int, db: Session = Depends(get_db)):
    """【接口】案例详情：项目信息（城市/面积/完工时间）+ 富文本介绍 + 实景图集"""
    case = db.scalar(
        select(CaseInfo).where(CaseInfo.id == case_id, CaseInfo.is_activate == 1, CaseInfo.status == 1)
    )
    if case is None:
        raise BizError(Code.NOT_FOUND, "案例不存在")
    return ok({
        "id": case.id,
        "title": case.title,
        "cover_url": case.cover_url,
        "space_tags": case.space_tags or [],
        "city": case.city,
        "area": case.area,
        "finished_at": case.finished_at,
        "content": case.content,
        "images": case.images or [],
    })


# ============================================================
# 二、新闻（§6.2.7~6.2.9）
# ============================================================

@router.get("/news/categories", summary="新闻栏目（§6.2.7）")
def list_news_categories(db: Session = Depends(get_db)):
    """【接口】新闻栏目：仅启用（is_activate=1），sort_order 升序（FR-30）"""
    cats = db.scalars(
        select(NewsCategory).where(NewsCategory.is_activate == 1)
        .order_by(NewsCategory.sort_order.asc(), NewsCategory.id.asc())
    ).all()
    return ok([{"id": c.id, "name": c.name} for c in cats])


@router.get("/news", summary="新闻列表（§6.2.8）")
def list_news(
    category_id: int | None = None,       # 栏目筛选（FR-31）
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=60),
    db: Session = Depends(get_db),
):
    """【接口】新闻列表：仅已发布（is_published=1，FR-34）；publish_time 格式化 YYYY.MM.DD（FR-33）"""
    base = (NewsArticle.is_activate == 1, NewsArticle.is_published == 1)
    stmt = select(NewsArticle).where(*base)
    count_stmt = select(func.count(NewsArticle.id)).where(*base)
    if category_id is not None:
        stmt = stmt.where(NewsArticle.category_id == category_id)
        count_stmt = count_stmt.where(NewsArticle.category_id == category_id)
    stmt = stmt.order_by(NewsArticle.publish_time.desc(), NewsArticle.id.desc())
    total = db.scalar(count_stmt) or 0

    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    items = [
        {
            "id": n.id,
            "title": n.title,
            "cover_url": n.cover_url,
            "summary": n.summary,
            "category_id": n.category_id,
            "publish_time": n.publish_time.strftime("%Y.%m.%d") if n.publish_time else "",
        }
        for n in rows
    ]
    return ok({
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 1,
    })


@router.get("/news/{news_id}", summary="新闻详情（§6.2.9）")
def get_news(news_id: int, db: Session = Depends(get_db)):
    """【接口】新闻详情：标题/栏目/来源/发布时间（YYYY.MM.DD）/富文本正文"""
    n = db.scalar(
        select(NewsArticle).options(joinedload(NewsArticle.category))
        .where(NewsArticle.id == news_id, NewsArticle.is_activate == 1, NewsArticle.is_published == 1)
    )
    if n is None:
        raise BizError(Code.NOT_FOUND, "新闻不存在")
    return ok({
        "id": n.id,
        "title": n.title,
        "category_name": n.category.name if n.category else "",
        "source": n.source,
        "publish_time": n.publish_time.strftime("%Y.%m.%d") if n.publish_time else "",
        "content": n.content,
    })


# ============================================================
# 三、单页 / 历程 / FAQ（§6.2.12~6.2.14）
# ============================================================

@router.get("/page/{content_type}", summary="单页内容（§6.2.12）")
def get_page(content_type: str, db: Session = Depends(get_db)):
    """【接口】单页内容：content_type ∈ about_stk/brand_intro/after_sales_policy"""
    if content_type not in {"about_stk", "brand_intro", "after_sales_policy"}:
        raise BizError(Code.NOT_FOUND, "页面类型不存在")
    page = db.scalar(
        select(PageContent).where(
            PageContent.content_type == content_type, PageContent.is_activate == 1
        )
    )
    if page is None:
        raise BizError(Code.NOT_FOUND, "页面内容未配置")
    return ok({"title": page.title, "content": page.content, "cover_url": page.cover_url})


@router.get("/milestones", summary="发展历程（§6.2.13）")
def list_milestones(db: Session = Depends(get_db)):
    """【接口】发展历程：仅启用，sort_order 倒序（时间倒序展示，FR-40）"""
    rows = db.scalars(
        select(MilestoneItem).where(MilestoneItem.is_activate == 1)
        .order_by(MilestoneItem.sort_order.desc(), MilestoneItem.id.asc())
    ).all()
    return ok([
        {"year": m.year, "title": m.title, "description": m.description} for m in rows
    ])


@router.get("/faqs", summary="常见问题（§6.2.14）")
def list_faqs(db: Session = Depends(get_db)):
    """【接口】FAQ：仅启用，sort_order 升序（手风琴展示，FR-52）"""
    rows = db.scalars(
        select(Faq).where(Faq.is_activate == 1)
        .order_by(Faq.sort_order.asc(), Faq.id.asc())
    ).all()
    return ok([
        {"id": f.id, "category": f.category, "question": f.question, "answer": f.answer}
        for f in rows
    ])


# ============================================================
# 四、门店 / 公共配置（§6.2.15~6.2.16）
# ============================================================

@router.get("/stores", summary="门店信息（§6.2.15）")
def get_store(db: Session = Depends(get_db)):
    """【接口】门店：返回唯一上海旗舰店（FR-53）；无启用门店时返回空对象"""
    store = db.scalar(
        select(Store).where(Store.is_activate == 1).order_by(Store.sort_order.asc(), Store.id.asc())
    )
    if store is None:
        return ok({})
    return ok({
        "id": store.id,
        "name": store.name,
        "city": store.city,
        "address": store.address,
        "phone": store.phone,
        "business_hours": store.business_hours,
        "longitude": store.longitude,
        "latitude": store.latitude,
    })


@router.get("/config/public", summary="公共配置（§6.2.16）")
def get_public_config(db: Session = Depends(get_db)):
    """【接口】公共配置：contact（地址/电话/邮箱）+ footer（动态版权，FR-03）"""
    config_map = {
        c.config_key: (c.config_value or "")
        for c in db.scalars(select(SysConfig).where(SysConfig.is_activate == 1)).all()
    }
    return ok({
        "contact": {
            "address": config_map.get("contact.address", ""),
            "phone": config_map.get("contact.phone", ""),
            "email": config_map.get("contact.email", ""),
        },
        "footer": {
            "copyright": config_map.get("footer.copyright", "© STK 本然家居"),
        },
    })
