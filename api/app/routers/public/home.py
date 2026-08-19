# -*- coding: utf-8 -*-
"""
【模块功能】前台-首页聚合接口：一次请求聚合首页全部模块数据（§6.2.1）
依据：开发技术文档 §6.2.1；PRD FR-08~15。
聚合内容：
- banners：启用轮播（sort_order 升序）
- highlights：企业亮点（sys_config highlight.title_N / desc_N，最多 4 组）
- slogan：品牌标语（brand.slogan / brand.sub_slogan）
- products：精选产品（is_top=1 且上架，最多 8）
- cases：精选案例（已发布，sort_order 升序前 4）
- news：最新新闻（已发布，publish_time 倒序前 4，日期格式化 YYYY.MM.DD）
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.response import ok
from app.db.session import get_db
from app.models import Banner, CaseInfo, NewsArticle, Product, ProductCategory, SysConfig
from app.schemas.public import HomeData, HomeHighlights, HomeSlogan

router = APIRouter()


@router.get("/home", summary="首页聚合（§6.2.1）")
def get_home(db: Session = Depends(get_db)):
    """【接口】首页聚合：单次请求返回轮播/亮点/标语/精选产品/精选案例/最新新闻"""
    # 1) 轮播：仅启用（is_activate=1），按 sort_order 升序（BR-48）
    banners = db.scalars(
        select(Banner).where(Banner.is_activate == 1).order_by(Banner.sort_order.asc(), Banner.id.asc())
    ).all()
    banner_list = [
        {"id": b.id, "image_url": b.image_url, "title": b.title, "subtitle": b.subtitle, "link_url": b.link_url}
        for b in banners
    ]

    # 2) 企业亮点 + 品牌标语：从 sys_config 键值聚合（BR-51）
    config_map = {
        c.config_key: (c.config_value or "")
        for c in db.scalars(select(SysConfig).where(SysConfig.is_activate == 1)).all()
    }
    # 亮点：highlight.title_N + highlight.desc_N 成组读取，最多 4 组
    highlights: list[HomeHighlights] = []
    for i in range(1, 5):
        title = config_map.get(f"highlight.title_{i}")
        if title:
            highlights.append(HomeHighlights(title=title, desc=config_map.get(f"highlight.desc_{i}", "")))
    slogan = HomeSlogan(
        title=config_map.get("brand.slogan", ""),
        subtitle=config_map.get("brand.sub_slogan", ""),
    )

    # 3) 精选产品：is_top=1 且上架（status=1），最多 8 个（BR-20）；联表取系列名（防 N+1）
    rows = db.execute(
        select(Product, ProductCategory.name)
        .join(ProductCategory, ProductCategory.id == Product.category_id)
        .where(Product.is_activate == 1, Product.is_top == 1, Product.status == 1)
        .order_by(Product.sort_order.desc(), Product.id.desc())
        .limit(8)
    ).all()
    product_list = [
        {"id": p.id, "name": p.name, "cover_url": p.cover_url, "category_name": cat_name}
        for p, cat_name in rows
    ]

    # 4) 精选案例：已发布（status=1），sort_order 升序前 4（BR-23）
    cases = db.scalars(
        select(CaseInfo).where(CaseInfo.is_activate == 1, CaseInfo.status == 1)
        .order_by(CaseInfo.sort_order.asc(), CaseInfo.id.desc()).limit(4)
    ).all()
    case_list = [
        {"id": c.id, "title": c.title, "cover_url": c.cover_url, "space_tags": c.space_tags or []}
        for c in cases
    ]

    # 5) 最新新闻：已发布，publish_time 倒序前 4（BR-31/FR-33，日期格式化 YYYY.MM.DD）
    news_rows = db.scalars(
        select(NewsArticle).options(joinedload(NewsArticle.category)).where(
            NewsArticle.is_activate == 1, NewsArticle.is_published == 1
        ).order_by(NewsArticle.publish_time.desc(), NewsArticle.id.desc()).limit(4)
    ).all()
    news_list = [
        {
            "id": n.id,
            "title": n.title,
            "publish_time": n.publish_time.strftime("%Y.%m.%d") if n.publish_time else "",
            "category_name": n.category.name if n.category else "",
        }
        for n in news_rows
    ]

    data = HomeData(
        banners=banner_list,
        highlights=highlights,
        slogan=slogan,
        products=product_list,
        cases=case_list,
        news=news_list,
    )
    return ok(data.model_dump())
