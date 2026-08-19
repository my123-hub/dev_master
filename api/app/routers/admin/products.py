# -*- coding: utf-8 -*-
"""
【模块功能】后台-产品管理接口：列表/新增/编辑/软删除/上下架切换
依据：开发技术文档 §6.3.4；PRD BR-13~20；数据库设计文档 §3.2.2。
要点：
- 删除 = 软删除（is_activate=0），历史数据可追溯（BR-17）；
- 上下架切换独立接口（BR-16）；
- 产品编号 product_no 全局唯一（冲突返回 409）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Product, ProductCategory
from app.schemas.product import ProductCreate, ProductOut, ProductStatusRequest, ProductUpdate
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()


def _to_out(p: Product) -> dict:
    """【工具函数】Product → ProductOut dict：附加系列名称（列表/详情通用）"""
    return ProductOut.model_validate(p).model_copy(
        update={"category_name": p.category.name if p.category else None}
    ).model_dump()


@router.get("/products", summary="产品列表（BR-14）")
def list_products(
    page: int,
    page_size: int,
    category_id: int | None = None,    # 按系列筛选
    status: int | None = None,         # 按发布状态筛选：0 草稿/1 上架/2 下架
    keyword: str | None = None,        # 按名称/编号模糊搜索
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:view")),
):
    """【接口】产品列表：支持系列/状态筛选 + 名称/编号搜索，默认仅显示未禁用（is_activate=1）"""
    stmt = select(Product).where(Product.is_activate == 1)
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if status is not None:
        stmt = stmt.where(Product.status == status)
    if keyword:
        # 名称或编号模糊匹配（LIKE 由 ORM 生成，跨库兼容）
        stmt = stmt.where(
            (Product.name.contains(keyword)) | (Product.product_no.contains(keyword))
        )
    # 排序：is_top 优先，再按 sort_order 大在前（PRD FR-20 前台默认口径）
    stmt = stmt.order_by(Product.is_top.desc(), Product.sort_order.desc(), Product.id.desc())

    data = paginate(stmt, page, page_size, db)
    return ok({"items": [_to_out(p) for p in data.items], "total": data.total,
               "page": data.page, "page_size": data.page_size, "pages": data.pages})


@router.post("/products", summary="新增产品（BR-15）")
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:create")),
):
    """【接口】新增产品：校验系列存在 + 编号唯一；图片 URL 由上传接口先行返回"""
    if db.get(ProductCategory, body.category_id) is None:
        raise BizError(Code.NOT_FOUND, "所属系列不存在")
    if db.scalar(select(Product).where(Product.product_no == body.product_no)):
        raise BizError(Code.CONFLICT, f"产品编号「{body.product_no}」已存在")
    product = Product(**body.model_dump())
    db.add(product)
    db.flush()
    add_operation_log(db, user_id=user.id, module="product", action="create",
                      detail=f"新增产品「{product.name}」({product.product_no})")
    db.commit()
    return ok(_to_out(product), message="产品创建成功")


@router.put("/products/{product_id}", summary="编辑产品")
def update_product(
    product_id: int,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:edit")),
):
    """【接口】编辑产品：整体替换字段；系列存在性 + 编号唯一（排除自身）校验"""
    product = db.get(Product, product_id)
    if product is None or product.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "产品不存在")
    if db.get(ProductCategory, body.category_id) is None:
        raise BizError(Code.NOT_FOUND, "所属系列不存在")
    dup = db.scalar(select(Product).where(
        Product.product_no == body.product_no, Product.id != product_id
    ))
    if dup:
        raise BizError(Code.CONFLICT, f"产品编号「{body.product_no}」已存在")
    for k, v in body.model_dump().items():
        setattr(product, k, v)
    add_operation_log(db, user_id=user.id, module="product", action="update",
                      detail=f"编辑产品「{product.name}」(id={product.id})")
    db.commit()
    return ok(_to_out(product), message="产品更新成功")


@router.delete("/products/{product_id}", summary="删除产品（软删除，BR-17）")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:delete")),
):
    """【接口】软删除：is_activate=0（禁用即等效删除，关键业务数据可追溯，ADR-004）"""
    product = db.get(Product, product_id)
    if product is None or product.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "产品不存在")
    product.is_activate = 0
    add_operation_log(db, user_id=user.id, module="product", action="delete",
                      detail=f"删除产品「{product.name}」(id={product.id})")
    db.commit()
    return ok(message="产品删除成功")


@router.put("/products/{product_id}/status", summary="上下架切换（BR-16）")
def change_product_status(
    product_id: int,
    body: ProductStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("product:status")),
):
    """【接口】上下架切换：仅更新 status（0 草稿/1 上架/2 下架）"""
    product = db.get(Product, product_id)
    if product is None or product.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "产品不存在")
    product.status = body.status
    add_operation_log(db, user_id=user.id, module="product", action="update",
                      detail=f"产品「{product.name}」上下架切换为 status={body.status}")
    db.commit()
    return ok(message="状态已更新")
