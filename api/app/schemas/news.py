# -*- coding: utf-8 -*-
"""
【模块功能】新闻管理请求/响应模型
——新闻栏目（news_category）与新闻文章（news_article）的增删改查参数与输出结构。
依据：数据库设计文档 V1.3 §3.4；开发技术文档 §6.3.6；PRD BR-26~33。
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# 一、新闻栏目（news_category）
# ============================================================

class NewsCategoryBase(BaseModel):
    """【模型】栏目公共字段：名称必填、排序（PRD BR-26 内置企业新闻/行业资讯两个栏目）"""
    name: str = Field(min_length=1, max_length=50, description="栏目名称")
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序值（小在前）")


class NewsCategoryCreate(NewsCategoryBase):
    """【模型】新增栏目"""


class NewsCategoryUpdate(NewsCategoryBase):
    """【模型】编辑栏目"""


class NewsCategoryOut(NewsCategoryBase):
    """【模型】栏目输出：附加 id/启用状态/文章数（删除保护提示，BR-28 有文章禁删）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int
    created_date: datetime
    article_count: int = 0


# ============================================================
# 二、新闻文章（news_article）
# ============================================================

class NewsArticleBase(BaseModel):
    """【模型】文章公共字段：
    - category_id 必填；is_published 草稿/发布（BR-31）；is_top 置顶（BR-33）；
    - publish_time 发布时间（未填则发布时取当前时间）。
    """
    category_id: int = Field(description="所属栏目 ID → news_category.id")
    title: str = Field(min_length=1, max_length=200, description="文章标题")
    cover_url: str | None = Field(default=None, max_length=255, description="封面图 URL")
    summary: str | None = Field(default=None, max_length=300, description="摘要")
    # 富文本正文：wangEditor 产出 HTML，入库前清洗（PRD NFR-08）
    content: str | None = Field(default=None, description="正文（富文本 HTML）")
    source: str | None = Field(default=None, max_length=100, description="来源（转载标注）")
    is_published: int = Field(default=0, ge=0, le=1, description="是否发布：1 已发布 / 0 未发布（草稿）")
    is_top: int = Field(default=0, ge=0, le=1, description="是否置顶/推荐：1 是 / 0 否")
    publish_time: datetime | None = Field(default=None, description="发布时间（未填发布时取当前时间）")
    end_time: datetime | None = Field(default=None, description="置顶展示有效期截止（可空）")


class NewsArticleCreate(NewsArticleBase):
    """【模型】新增文章"""


class NewsArticleUpdate(NewsArticleBase):
    """【模型】编辑文章：字段与新增一致（整体替换）"""


class NewsArticleOut(NewsArticleBase):
    """【模型】文章输出：附加 id/启用状态/创建时间/栏目名称（列表展示）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int
    created_date: datetime
    category_name: str | None = Field(default=None, description="栏目名称（联表查询填充）")


class NewsArticleStatusRequest(BaseModel):
    """【模型】发布/撤回请求体：仅发布状态字段（BR-31）"""
    is_published: int = Field(ge=0, le=1, description="目标状态：1 已发布 / 0 未发布")
