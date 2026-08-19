# -*- coding: utf-8 -*-
"""
【模块功能】产品管理请求/响应模型（Pydantic v2）
——产品系列（product_category）与产品（product）的增删改查参数与输出结构。
依据：数据库设计文档 V1.3 §3.2；开发技术文档 §6.3.3/§6.3.4；PRD BR-09~20（产品不公开标价，无 price 字段）。
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.security import clean_html


# ============================================================
# 一、产品系列（product_category）
# ============================================================

class CategoryBase(BaseModel):
    """【模型】产品系列公共字段：名称必填、封面图可选、排序小在前（数据库设计文档 §3.2.1）"""
    name: str = Field(min_length=1, max_length=100, description="系列名称")
    cover_url: str | None = Field(default=None, max_length=255, description="封面图 URL")
    # 排序：小在前（前台系列筛选按此排序展示，PRD FR-16）
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序值（小在前）")


class CategoryCreate(CategoryBase):
    """【模型】新增系列：继承公共字段即可"""


class CategoryUpdate(CategoryBase):
    """【模型】编辑系列：字段与新增一致（整体替换）"""


class CategoryOut(CategoryBase):
    """【模型】系列输出：附加 id/启用状态/创建时间/关联产品数（列表页展示删除保护状态）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int = Field(description="1 激活 / 0 禁用")
    created_date: datetime
    # 关联产品数：删除时若有产品则 409 禁止（BR-11），列表页提示
    product_count: int = 0


# ============================================================
# 二、产品（product）
# ============================================================

class SpecItem(BaseModel):
    """【模型】规格参数单项：{"name":"材质","value":"胡桃木"}（数据库设计文档 §3.2.2 specs JSON）"""
    name: str = Field(min_length=1, max_length=50, description="参数名")
    value: str = Field(min_length=1, max_length=200, description="参数值")


class ProductBase(BaseModel):
    """【模型】产品公共字段：
    - category_id 必填（所属系列）；product_no 唯一（SKU 业务标识，PRD BR-15）；
    - specs/images 为 JSON 数组；status 三态：0 草稿 / 1 上架 / 2 下架。
    """
    category_id: int = Field(description="所属系列 ID → product_category.id")
    name: str = Field(min_length=1, max_length=100, description="产品名称")
    series: str | None = Field(default=None, max_length=50, description="所属系列，如「胡桃禮」")
    product_no: str = Field(min_length=1, max_length=50, description="产品编号（唯一）")
    # 富文本描述：前端 wangEditor 产出 HTML，入库前清洗（PRD NFR-08 XSS 白名单）
    description: str | None = Field(default=None, description="产品描述（富文本 HTML）")

    @field_validator("description", mode="after")
    @classmethod
    def _sanitize_description(cls, v: str | None) -> str | None:
        """【校验】产品描述入库前 XSS 清洗（bleach 白名单）"""
        return clean_html(v)

    # 动态规格参数：JSON 数组，规格可随产品变化（BR-15）
    specs: list[SpecItem] | None = Field(default=None, description="规格参数数组")
    cover_url: str | None = Field(default=None, max_length=255, description="封面图 URL")
    images: list[str] | None = Field(default=None, description="图集 URL 数组")
    status: int = Field(default=1, ge=0, le=2, description="发布状态：0 草稿 / 1 上架 / 2 下架")
    is_top: int = Field(default=0, ge=0, le=1, description="首页推荐：1 是 / 0 否（首页精选最多 8 个，BR-20）")
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序（越大越靠前）")


class ProductCreate(ProductBase):
    """【模型】新增产品：继承公共字段"""


class ProductUpdate(ProductBase):
    """【模型】编辑产品：字段与新增一致（整体替换）"""


class ProductOut(ProductBase):
    """【模型】产品输出：附加 id/启用状态/创建时间/所属系列名称（列表页展示）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int = Field(description="1 激活 / 0 禁用")
    created_date: datetime
    category_name: str | None = Field(default=None, description="所属系列名称（联表查询填充）")


class ProductStatusRequest(BaseModel):
    """【模型】上下架切换请求体：仅状态字段（BR-16）"""
    status: int = Field(ge=0, le=2, description="目标状态：0 草稿 / 1 上架 / 2 下架")
