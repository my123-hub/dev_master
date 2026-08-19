# -*- coding: utf-8 -*-
"""
【模块功能】前台-产品目录接口：系列列表 / 产品列表 / 产品详情（§6.2.2~6.2.4）
依据：开发技术文档 §6.2；PRD FR-16~26。
- 产品列表：仅上架（status=1）；支持 category_id/keyword/sort=default|latest 筛选；
  page_size 默认 12；产品不公开标价，前台统一展示「价格面议」（PRD BR-20）。
- 产品详情：图集/富文本描述/规格参数表 + 同系列推荐（same_series，同 category 其他上架产品）。
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Product, ProductCategory

router = APIRouter()


@router.get("/categories", summary="产品系列列表（§6.2.2）")
def list_categories(db: Session = Depends(get_db)):
    """【接口】系列列表：仅启用（is_activate=1），sort_order 升序（FR-16）"""
    cats = db.scalars(
        select(ProductCategory).where(ProductCategory.is_activate == 1)
        .order_by(ProductCategory.sort_order.asc(), ProductCategory.id.asc())
    ).all()
    return ok([
        {"id": c.id, "name": c.name, "cover_url": c.cover_url, "sort_order": c.sort_order}
        for c in cats
    ])


@router.get("/products", summary="产品列表（§6.2.3）")
def list_products(
    category_id: int | None = None,       # 系列筛选（FR-17）
    keyword: str | None = None,           # 名称模糊搜索（FR-18）
    sort: str = Query("default", pattern="^(default|latest)$", description="default 综合 / latest 最新"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
    db: Session = Depends(get_db),
):
    """【接口】产品列表：仅上架（status=1，BR-16）；支持系列/关键词筛选与排序"""
    stmt = (
        select(Product, ProductCategory.name)
        .join(ProductCategory, ProductCategory.id == Product.category_id)
        .where(Product.is_activate == 1, Product.status == 1)
    )
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if keyword:
        stmt = stmt.where(Product.name.contains(keyword))
    # 排序：latest 按创建时间倒序；default 按 sort_order 倒序 + id 倒序（后台推荐权重优先）
    stmt = stmt.order_by(
        Product.created_date.desc() if sort == "latest" else Product.sort_order.desc(),
        Product.id.desc(),
    )
    # 总数：同条件子查询计数（与分页数据一致）
    count_stmt = select(func.count(Product.id)).where(
        Product.is_activate == 1, Product.status == 1
    )
    if category_id is not None:
        count_stmt = count_stmt.where(Product.category_id == category_id)
    if keyword:
        count_stmt = count_stmt.where(Product.name.contains(keyword))
    total = db.scalar(count_stmt) or 0
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    items = [
        {"id": p.id, "name": p.name, "category_name": cat_name,
         "cover_url": p.cover_url, "status": p.status}
        for p, cat_name in rows
    ]
    return ok({
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 1,
    })


@router.get("/products/{product_id}", summary="产品详情（§6.2.4）")
def get_product(product_id: int, db: Session = Depends(get_db)):
    """【接口】产品详情：图集/富文本描述/规格参数 + 同系列推荐（BR-26）"""
    row = db.execute(
        select(Product, ProductCategory.name)
        .join(ProductCategory, ProductCategory.id == Product.category_id)
        .where(Product.id == product_id, Product.is_activate == 1, Product.status == 1)
    ).first()
    if row is None:
        raise BizError(Code.NOT_FOUND, "产品不存在或已下架")
    p, cat_name = row
    # 同系列推荐：同 category 的其他上架产品（最多 4 个），排除自身
    same = db.scalars(
        select(Product).where(
            Product.category_id == p.category_id,
            Product.id != p.id,
            Product.is_activate == 1,
            Product.status == 1,
        ).order_by(Product.sort_order.desc(), Product.id.desc()).limit(4)
    ).all()
    return ok({
        "id": p.id,
        "name": p.name,
        "category_name": cat_name,
        "status": p.status,
        "cover_url": p.cover_url,
        "images": p.images or [],
        "description": p.description,
        "specs": p.specs or [],
        "same_series": [
            {"id": s.id, "name": s.name, "cover_url": s.cover_url} for s in same
        ],
    })
