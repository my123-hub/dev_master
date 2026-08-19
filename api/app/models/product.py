# -*- coding: utf-8 -*-
"""
【模块功能】产品管理域模型（2 张表）：product_category（产品系列）/ product（产品）
依据：数据库设计文档 V1.3 §3.2；PRD V1.9 产品不公开标价（无 price 字段，前台统一"价格面议"）。
"""
from sqlalchemy import BigInteger, ForeignKey, Integer, JSON, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CommonMixin


class ProductCategory(CommonMixin, Base):
    """【表】product_category 产品系列：名称/封面/排序/启用状态（分类表无独立 status，统一 is_activate，数据库设计文档 V1.3）"""

    __tablename__ = "product_category"

    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="系列名称")
    cover_url: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="封面图")
    # 排序：小在前（前台系列筛选按此排序展示）
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", index=True, comment="排序(小在前)")

    # 关系：该系列下的产品列表
    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(CommonMixin, Base):
    """【表】product 产品：所属系列/名称/编号唯一/富文本描述/规格参数 JSON/多图 JSON/三态上下架/首页推荐"""

    __tablename__ = "product"

    category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("product_category.id"), nullable=False, index=True, comment="所属系列 → product_category.id"
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="产品名称")
    series: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="所属系列，如「胡桃禮」")
    # 产品编号唯一：SKU 级别的业务标识（PRD BR-15 录入）
    product_no: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True, comment="产品编号(唯一)"
    )
    # 富文本描述：入库前已清洗（XSS 白名单，PRD NFR-08）
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="产品描述(富文本已清洗)")
    # 规格参数：JSON 数组，如 [{"name":"材质","value":"胡桃木"}]（数据库设计文档 §1.2 多值 JSON 字段）
    specs: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="规格参数 JSON")
    cover_url: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="封面图 URL")
    # 图集：JSON 数组（其余图片 URL 列表）
    images: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="其它图片 URL JSON 数组")
    # 发布状态三态：0 草稿 / 1 上架 / 2 下架（数据库设计文档附录 A）
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1, server_default="1", index=True, comment="0草稿/1上架/2下架")
    # 首页推荐标记：1 置顶/推荐，用于首页精选产品模块（PRD BR-20 最多 8 个）
    is_top: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0", index=True, comment="1首页推荐/0否")
    # 排序：越大越靠前（前台默认排序口径，PRD FR-20）
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="排序(越大越靠前)")

    # 关系：所属系列
    category: Mapped["ProductCategory"] = relationship(back_populates="products")
