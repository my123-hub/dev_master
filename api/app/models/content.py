# -*- coding: utf-8 -*-
"""
【模块功能】内容/门店/首页配置域模型（6 张表）：page_content / milestone_item / faq / store / banner / sys_config
依据：数据库设计文档 V1.3 §3.6~§3.9。
"""
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CommonMixin


class PageContent(CommonMixin, Base):
    """【表】page_content 单页富文本内容：关于STK/品牌介绍/售后政策等统一存储，按 content_type 区分（数据库设计文档 §1.2 原则 4）"""

    __tablename__ = "page_content"

    # 类型标识：about_stk / brand_intro / after_sales_policy 等（唯一，可扩展新类型）
    content_type: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="类型标识(唯一)")
    title: Mapped[str | None] = mapped_column(String(150), nullable=True, comment="标题")
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="富文本正文")
    cover_url: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="封面图")


class MilestoneItem(CommonMixin, Base):
    """【表】milestone_item 发展历程条目：年份/事件标题/描述/排序，前台时间轴展示（PRD FR-40）"""

    __tablename__ = "milestone_item"

    year: Mapped[str] = mapped_column(String(10), nullable=False, comment="年份")
    title: Mapped[str | None] = mapped_column(String(150), nullable=True, comment="事件标题")
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="事件说明")
    # 排序：时间倒序展示（近期条目在前）
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="排序(时间倒序)")


class Faq(CommonMixin, Base):
    """【表】faq 常见问题：问题/富文本答案/可选分类/排序/启用状态（手风琴展示，PRD FR-52）"""

    __tablename__ = "faq"

    category: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="可选分类")
    question: Mapped[str] = mapped_column(String(300), nullable=False, comment="问题")
    answer: Mapped[str | None] = mapped_column(Text, nullable=True, comment="答案(富文本)")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="排序")


class Store(CommonMixin, Base):
    """【表】store 门店信息：本期仅一家「上海旗舰店」，不开放新增/删除（PRD BR-43~46）"""

    __tablename__ = "store"

    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="门店名称")
    # 城市：本期固定上海（PRD BR-44 城市固定）
    city: Mapped[str] = mapped_column(String(50), nullable=False, default="上海", server_default="上海", comment="城市(本期固定上海)")
    address: Mapped[str] = mapped_column(String(255), nullable=False, comment="地址")
    phone: Mapped[str] = mapped_column(String(50), nullable=False, comment="联系电话")
    business_hours: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="营业时间")
    # 经纬度：单店本期不填（PRD FR-54 P2 预留，多门店/精准引流时启用）
    longitude: Mapped[str | None] = mapped_column(String(30), nullable=True, comment="经度(单店本期不填)")
    latitude: Mapped[str | None] = mapped_column(String(30), nullable=True, comment="纬度(单店本期不填)")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="排序")


class Banner(CommonMixin, Base):
    """【表】banner 首页轮播图：图片/标题/副标题/跳转链接/排序（建议尺寸 1920×800+，PRD BR-48）"""

    __tablename__ = "banner"

    image_url: Mapped[str] = mapped_column(String(255), nullable=False, comment="图片地址")
    title: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="标题")
    subtitle: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="副标题")
    # 跳转链接：可选，跳转产品/新闻/外部链接（PRD BR-47）
    link_url: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="跳转链接")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="排序")


class SysConfig(CommonMixin, Base):
    """【表】sys_config 系统配置键值：联系信息/品牌标语/首页亮点文案等（PRD BR-42/BR-51）"""

    __tablename__ = "sys_config"

    # 键：contact.address / contact.phone / brand.slogan / highlight.title_1 等（唯一）
    config_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, comment="配置键(唯一)")
    config_value: Mapped[str | None] = mapped_column(Text, nullable=True, comment="配置值")
