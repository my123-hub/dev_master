# -*- coding: utf-8 -*-
"""
【模块功能】后台-新闻管理接口：栏目 CRUD（有文章禁删）+ 文章 CRUD（草稿/发布/置顶）
依据：开发技术文档 §6.3.6；PRD BR-26~33；数据库设计文档 §3.4。
要点：
- 栏目删除保护：存在文章（含已禁用）→ 409（BR-28）；
- 文章发布：发布时若未指定 publish_time 则自动取当前时间（BR-31）。
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import NewsArticle, NewsCategory
from app.schemas.news import (
    NewsArticleCreate, NewsArticleOut, NewsArticleStatusRequest, NewsArticleUpdate,
    NewsCategoryCreate, NewsCategoryOut, NewsCategoryUpdate,
)
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()


# ============================================================
# 一、新闻栏目
# ============================================================

@router.get("/news/categories", summary="新闻栏目列表（BR-26）")
def list_news_categories(
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:view")),
):
    """【接口】栏目列表：全量返回（前台 Tab 展示），附带各栏目文章数（删除保护提示）"""
    cats = db.scalars(
        select(NewsCategory).order_by(NewsCategory.sort_order.asc(), NewsCategory.id.asc())
    ).all()
    # 按栏目统计文章数
    count_map = dict(
        db.execute(
            select(NewsArticle.category_id, func.count(NewsArticle.id))
            .group_by(NewsArticle.category_id)
        ).all()
    )
    items = [
        NewsCategoryOut.model_validate(c).model_copy(
            update={"article_count": count_map.get(c.id, 0)}
        ).model_dump()
        for c in cats
    ]
    return ok(items)


@router.post("/news/categories", summary="新增新闻栏目（BR-27）")
def create_news_category(
    body: NewsCategoryCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:create")),
):
    """【接口】新增栏目：名称查重"""
    if db.scalar(select(NewsCategory).where(NewsCategory.name == body.name)):
        raise BizError(Code.CONFLICT, f"栏目「{body.name}」已存在")
    cat = NewsCategory(**body.model_dump())
    db.add(cat)
    db.flush()
    add_operation_log(db, user_id=user.id, module="news", action="create",
                      detail=f"新增新闻栏目「{cat.name}」(id={cat.id})")
    db.commit()
    return ok(NewsCategoryOut.model_validate(cat).model_dump(), message="栏目创建成功")


@router.put("/news/categories/{cat_id}", summary="编辑新闻栏目")
def update_news_category(
    cat_id: int,
    body: NewsCategoryUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:edit")),
):
    """【接口】编辑栏目：名称查重（排除自身）"""
    cat = db.get(NewsCategory, cat_id)
    if cat is None:
        raise BizError(Code.NOT_FOUND, "栏目不存在")
    dup = db.scalar(select(NewsCategory).where(
        NewsCategory.name == body.name, NewsCategory.id != cat_id
    ))
    if dup:
        raise BizError(Code.CONFLICT, f"栏目「{body.name}」已存在")
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    add_operation_log(db, user_id=user.id, module="news", action="update",
                      detail=f"编辑新闻栏目「{cat.name}」(id={cat.id})")
    db.commit()
    return ok(NewsCategoryOut.model_validate(cat).model_dump(), message="栏目更新成功")


@router.delete("/news/categories/{cat_id}", summary="删除新闻栏目（有文章禁删，BR-28）")
def delete_news_category(
    cat_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:delete")),
):
    """【接口】删除栏目：存在文章（含已禁用）→ 409 禁止；否则物理删除"""
    cat = db.get(NewsCategory, cat_id)
    if cat is None:
        raise BizError(Code.NOT_FOUND, "栏目不存在")
    article_count = db.scalar(
        select(func.count(NewsArticle.id)).where(NewsArticle.category_id == cat_id)
    ) or 0
    if article_count > 0:
        raise BizError(Code.CONFLICT, f"该栏目下还有 {article_count} 篇文章，请先移除后再删除")
    name = cat.name
    db.delete(cat)
    add_operation_log(db, user_id=user.id, module="news", action="delete",
                      detail=f"删除新闻栏目「{name}」(id={cat_id})")
    db.commit()
    return ok(message="栏目删除成功")


# ============================================================
# 二、新闻文章
# ============================================================

def _article_to_out(a: NewsArticle) -> dict:
    """【工具函数】NewsArticle → Out dict：附加栏目名称"""
    return NewsArticleOut.model_validate(a).model_copy(
        update={"category_name": a.category.name if a.category else None}
    ).model_dump()


@router.get("/news", summary="新闻文章列表（BR-29）")
def list_news(
    page: int,
    page_size: int,
    category_id: int | None = None,    # 按栏目筛选
    is_published: int | None = None,   # 按发布状态筛选
    keyword: str | None = None,        # 标题模糊搜索
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:view")),
):
    """【接口】文章列表：栏目/发布状态筛选 + 标题搜索；默认仅显示未禁用"""
    stmt = select(NewsArticle).where(NewsArticle.is_activate == 1)
    if category_id is not None:
        stmt = stmt.where(NewsArticle.category_id == category_id)
    if is_published is not None:
        stmt = stmt.where(NewsArticle.is_published == is_published)
    if keyword:
        stmt = stmt.where(NewsArticle.title.contains(keyword))
    # 排序：置顶优先，再按发布时间倒序（BR-33 置顶 + 时间倒序）
    stmt = stmt.order_by(
        NewsArticle.is_top.desc(), NewsArticle.publish_time.desc().nullslast(),
        NewsArticle.id.desc(),
    )
    data = paginate(stmt, page, page_size, db)
    return ok({"items": [_article_to_out(a) for a in data.items], "total": data.total,
               "page": data.page, "page_size": data.page_size, "pages": data.pages})


@router.post("/news", summary="新增新闻文章（BR-30）")
def create_news(
    body: NewsArticleCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:create")),
):
    """【接口】新增文章：校验栏目存在；发布时未指定时间则自动取当前时间（BR-31）"""
    if db.get(NewsCategory, body.category_id) is None:
        raise BizError(Code.NOT_FOUND, "所属栏目不存在")
    payload = body.model_dump()
    # 发布语义：is_published=1 且未手动指定 publish_time → 自动取当前时间（BR-31）
    if payload["is_published"] == 1 and payload.get("publish_time") is None:
        payload["publish_time"] = datetime.now()
    article = NewsArticle(**payload)
    db.add(article)
    db.flush()
    add_operation_log(db, user_id=user.id, module="news", action="create",
                      detail=f"新增新闻「{article.title}」(id={article.id})")
    db.commit()
    return ok(_article_to_out(article), message="文章创建成功")


@router.put("/news/{article_id}", summary="编辑新闻文章")
def update_news(
    article_id: int,
    body: NewsArticleUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:edit")),
):
    """【接口】编辑文章：整体替换字段；栏目存在性校验"""
    article = db.get(NewsArticle, article_id)
    if article is None or article.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "文章不存在")
    if db.get(NewsCategory, body.category_id) is None:
        raise BizError(Code.NOT_FOUND, "所属栏目不存在")
    for k, v in body.model_dump().items():
        setattr(article, k, v)
    add_operation_log(db, user_id=user.id, module="news", action="update",
                      detail=f"编辑新闻「{article.title}」(id={article.id})")
    db.commit()
    return ok(_article_to_out(article), message="文章更新成功")


@router.delete("/news/{article_id}", summary="删除新闻文章")
def delete_news(
    article_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:delete")),
):
    """【接口】软删除：is_activate=0（关键内容可追溯）"""
    article = db.get(NewsArticle, article_id)
    if article is None or article.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "文章不存在")
    article.is_activate = 0
    add_operation_log(db, user_id=user.id, module="news", action="delete",
                      detail=f"删除新闻「{article.title}」(id={article.id})")
    db.commit()
    return ok(message="文章删除成功")


@router.put("/news/{article_id}/status", summary="发布/撤回文章（BR-31）")
def change_news_status(
    article_id: int,
    body: NewsArticleStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("news:status")),
):
    """【接口】发布/撤回：发布时未设 publish_time 自动取当前时间；撤回仅改状态"""
    article = db.get(NewsArticle, article_id)
    if article is None or article.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "文章不存在")
    article.is_published = body.is_published
    if body.is_published == 1 and article.publish_time is None:
        article.publish_time = datetime.now()
    add_operation_log(db, user_id=user.id, module="news", action="update",
                      detail=f"新闻「{article.title}」发布状态 → {body.is_published}")
    db.commit()
    return ok(message="发布状态已更新")
