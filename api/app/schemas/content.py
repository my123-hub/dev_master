# -*- coding: utf-8 -*-
"""
【模块功能】内容管理/首页配置请求响应模型
——单页内容（page_content）、发展历程（milestone_item）、FAQ（faq）、
  首页轮播（banner）、系统配置（sys_config）的增删改查参数与输出结构。
依据：数据库设计文档 V1.3 §3.6/§3.8/§3.9；开发技术文档 §6.3.8/§6.3.9；PRD BR-39~51。
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.security import clean_html


# ============================================================
# 一、单页内容（page_content）
# ============================================================

class PageContentUpdate(BaseModel):
    """【模型】单页内容更新：标题/富文本正文/封面图（按 content_type 唯一定位，BR-39）"""
    title: str | None = Field(default=None, max_length=150, description="页面标题")
    content: str | None = Field(default=None, description="富文本正文（HTML，入库前清洗）")
    cover_url: str | None = Field(default=None, max_length=255, description="封面图 URL")

    @field_validator("content", mode="after")
    @classmethod
    def _sanitize_content(cls, v: str | None) -> str | None:
        """【校验】单页正文入库前 XSS 清洗（bleach 白名单）"""
        return clean_html(v)


class PageContentOut(PageContentUpdate):
    """【模型】单页内容输出：附加 content_type/启用状态/更新时间"""
    model_config = ConfigDict(from_attributes=True)

    content_type: str = Field(description="类型标识：about_stk/brand_intro/after_sales_policy 等")
    is_activate: int
    updated_date: datetime | None = None


# ============================================================
# 二、发展历程（milestone_item）
# ============================================================

class MilestoneBase(BaseModel):
    """【模型】历程条目公共字段：年份必填（如 2020）、事件标题/说明可选（PRD FR-40 时间轴）"""
    year: str = Field(min_length=1, max_length=10, description="年份，如 2020")
    title: str | None = Field(default=None, max_length=150, description="事件标题")
    description: str | None = Field(default=None, description="事件说明")
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序（时间倒序展示）")


class MilestoneCreate(MilestoneBase):
    """【模型】新增历程条目"""


class MilestoneUpdate(MilestoneBase):
    """【模型】编辑历程条目"""


class MilestoneOut(MilestoneBase):
    """【模型】历程条目输出"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int
    created_date: datetime


# ============================================================
# 三、FAQ（faq）
# ============================================================

class FaqBase(BaseModel):
    """【模型】FAQ 公共字段：问题必填、答案富文本可选、可选分类（PRD FR-52 手风琴）"""
    category: str | None = Field(default=None, max_length=50, description="可选分类")
    question: str = Field(min_length=1, max_length=300, description="问题")
    answer: str | None = Field(default=None, description="答案（富文本）")
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序")

    @field_validator("answer", mode="after")
    @classmethod
    def _sanitize_answer(cls, v: str | None) -> str | None:
        """【校验】FAQ 答案入库前 XSS 清洗（bleach 白名单）"""
        return clean_html(v)


class FaqCreate(FaqBase):
    """【模型】新增 FAQ"""


class FaqUpdate(FaqBase):
    """【模型】编辑 FAQ"""


class FaqOut(FaqBase):
    """【模型】FAQ 输出"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int
    created_date: datetime


# ============================================================
# 四、首页轮播（banner）
# ============================================================

class BannerBase(BaseModel):
    """【模型】轮播公共字段：图片必填、标题/副标题/跳转链接可选（BR-47~50，建议尺寸 1920×800+）"""
    image_url: str = Field(min_length=1, max_length=255, description="图片地址")
    title: str | None = Field(default=None, max_length=100, description="标题")
    subtitle: str | None = Field(default=None, max_length=200, description="副标题")
    link_url: str | None = Field(default=None, max_length=255, description="跳转链接（产品/新闻/外部）")
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序（小在前）")


class BannerCreate(BannerBase):
    """【模型】新增轮播"""


class BannerUpdate(BannerBase):
    """【模型】编辑轮播"""


class BannerOut(BannerBase):
    """【模型】轮播输出"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int
    created_date: datetime


class BannerStatusRequest(BaseModel):
    """【模型】轮播启用/停用请求体"""
    is_activate: int = Field(ge=0, le=1, description="目标状态：1 启用 / 0 停用")


# ============================================================
# 五、系统配置（sys_config）
# ============================================================

class ConfigItem(BaseModel):
    """【模型】配置键值项：config_key + config_value（BR-42 联系信息 / BR-51 品牌标语与亮点）"""
    config_key: str = Field(min_length=1, max_length=100, description="配置键，如 brand.slogan")
    config_value: str | None = Field(default=None, description="配置值")


class ConfigUpdateRequest(BaseModel):
    """【模型】批量保存配置：一次提交多个键值对（整体覆盖传入的键，未传入键保持原值）"""
    items: list[ConfigItem] = Field(min_length=1, max_length=50, description="待保存的配置键值列表")
