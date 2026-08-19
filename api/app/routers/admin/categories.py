# -*- coding: utf-8 -*-
"""
【模块功能】后台-产品系列管理接口：列表/新增/编辑/删除（有产品禁删）
依据：开发技术文档 §6.3.3（perm 矩阵）；PRD BR-09~12；数据库设计文档 §3.2.1。
删除保护：系列下存在产品（含已禁用）时返回 409 禁止删除（BR-11）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Product, ProductCategory
from app.schemas.product import CategoryCreate, CategoryOut, CategoryUpdate
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()


@router.get("/categories", summary="产品系列列表（BR-09）")
def list_categories(
    page: int,
    page_size: int,
    keyword: str | None = None,          # 名称模糊搜索
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:view")),
):
    """【接口】系列列表：可选 keyword 搜索名称；附带每个系列的关联产品数（删除保护提示）"""
    stmt = select(ProductCategory)
    if keyword:
        stmt = stmt.where(ProductCategory.name.contains(keyword))
    # 排序：sort_order 小在前（数据库设计文档 §3.2.1）
    stmt = stmt.order_by(ProductCategory.sort_order.asc(), ProductCategory.id.asc())

    data = paginate(stmt, page, page_size, db)
    # 联表统计每个系列的产品数：按 category_id 分组计数（删除保护依据，BR-11）
    count_map = dict(
        db.execute(
            select(Product.category_id, func.count(Product.id)).group_by(Product.category_id)
        ).all()
    )
    items = [
        CategoryOut.model_validate(c).model_copy(
            update={"product_count": count_map.get(c.id, 0)}
        ).model_dump()
        for c in data.items
    ]
    return ok({"items": items, "total": data.total, "page": data.page,
               "page_size": data.page_size, "pages": data.pages})


@router.post("/categories", summary="新增产品系列（BR-10）")
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:create")),
):
    """【接口】新增系列：名称查重（同名下仅允许一条，避免前台筛选歧义）"""
    exists = db.scalar(select(ProductCategory).where(ProductCategory.name == body.name))
    if exists:
        raise BizError(Code.CONFLICT, f"系列「{body.name}」已存在")
    cat = ProductCategory(**body.model_dump())
    db.add(cat)
    db.flush()  # 先取得 id 用于操作日志
    add_operation_log(db, user_id=user.id, module="product", action="create",
                      detail=f"新增产品系列「{cat.name}」(id={cat.id})")
    db.commit()
    return ok(CategoryOut.model_validate(cat).model_dump(), message="系列创建成功")


@router.put("/categories/{cat_id}", summary="编辑产品系列")
def update_category(
    cat_id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:edit")),
):
    """【接口】编辑系列：更新名称/封面/排序；名称查重（排除自身）"""
    cat = db.get(ProductCategory, cat_id)
    if cat is None:
        raise BizError(Code.NOT_FOUND, "系列不存在")
    dup = db.scalar(select(ProductCategory).where(
        ProductCategory.name == body.name, ProductCategory.id != cat_id
    ))
    if dup:
        raise BizError(Code.CONFLICT, f"系列「{body.name}」已存在")
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    add_operation_log(db, user_id=user.id, module="product", action="update",
                      detail=f"编辑产品系列「{cat.name}」(id={cat.id})")
    db.commit()
    return ok(CategoryOut.model_validate(cat).model_dump(), message="系列更新成功")


@router.delete("/categories/{cat_id}", summary="删除产品系列（有产品禁删，BR-11）")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:delete")),
):
    """【接口】删除系列：存在关联产品（含已禁用）→ 409 禁止；否则物理删除"""
    cat = db.get(ProductCategory, cat_id)
    if cat is None:
        raise BizError(Code.NOT_FOUND, "系列不存在")
    # 删除保护：系列下存在任何产品记录即禁止删除（BR-11）
    product_count = db.scalar(
        select(func.count(Product.id)).where(Product.category_id == cat_id)
    ) or 0
    if product_count > 0:
        raise BizError(Code.CONFLICT, f"该系列下还有 {product_count} 个产品，请先移除后再删除")
    name = cat.name
    db.delete(cat)
    add_operation_log(db, user_id=user.id, module="product", action="delete",
                      detail=f"删除产品系列「{name}」(id={cat_id})")
    db.commit()
    return ok(message="系列删除成功")
