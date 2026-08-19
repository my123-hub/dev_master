# -*- coding: utf-8 -*-
"""
【模块功能】案例/新闻/招聘域模型（5 张表）：case_info / news_category / news_article / job / job_application
依据：数据库设计文档 V1.3 §3.3~§3.5。
"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, JSON, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CommonMixin


class CaseInfo(CommonMixin, Base):
    """【表】case_info 实景案例：封面/空间标签 JSON/项目信息/富文本介绍/图集/发布状态（PRD §8.4）"""

    __tablename__ = "case_info"

    title: Mapped[str] = mapped_column(String(150), nullable=False, comment="标题")
    cover_url: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="封面图")
    # 空间类型标签：JSON 数组，如 ["客厅","卧室"]（前台案例筛选维度，FR-29）
    space_tags: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="空间标签数组")
    city: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="城市")
    area: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="面积")
    finished_at: Mapped[str | None] = mapped_column(String(30), nullable=True, comment="完工时间")
    # 项目介绍富文本（已清洗）
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="项目介绍(富文本)")
    # 实景图集：JSON 数组
    images: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="实景图集")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="排序")
    # 发布状态：1 发布 / 0 下线（仅发布状态前台展示，PRD BR-23）
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1, server_default="1", comment="1发布/0下线")


class NewsCategory(CommonMixin, Base):
    """【表】news_category 新闻栏目：内置企业新闻/行业资讯，可扩展（分类表统一 is_activate，PRD BR-26/27）"""

    __tablename__ = "news_category"

    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="栏目名称")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="排序")

    # 关系：该栏目下的文章
    articles: Mapped[list["NewsArticle"]] = relationship(back_populates="category")


class NewsArticle(CommonMixin, Base):
    """【表】news_article 新闻文章：标题/封面/摘要/富文本正文/来源/发布标记/置顶/发布时间/截止时间"""

    __tablename__ = "news_article"

    category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("news_category.id"), nullable=False, index=True, comment="所属栏目 → news_category.id"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="标题")
    cover_url: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="封面图 URL")
    summary: Mapped[str | None] = mapped_column(String(300), nullable=True, comment="摘要")
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="正文(富文本已清洗)")
    source: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="来源(转载标注)")
    # 发布标记：1 已发布 / 0 未发布（仅已发布前台展示，PRD BR-31）
    is_published: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0", index=True, comment="1已发布/0未发布")
    # 置顶/推荐：1 是 / 0 否
    is_top: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0", index=True, comment="1置顶/0否")
    publish_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True, comment="发布时间")
    # 展示有效期截止（可空，置顶/展示限时场景）
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="截止时间")

    # 关系：所属栏目
    category: Mapped["NewsCategory"] = relationship(back_populates="articles")


class Job(CommonMixin, Base):
    """【表】job 招聘职位：分类(社会/校园)/地点默认上海/类型/薪资/富文本职责与要求/投递联系方式/急招/招聘状态"""

    __tablename__ = "job"

    title: Mapped[str] = mapped_column(String(100), nullable=False, comment="职位名称")
    # 分类：1 社会招聘 / 2 校园招聘（前台 Tab 切换维度，FR-35）
    category: Mapped[int] = mapped_column(SmallInteger, nullable=False, index=True, comment="1社会招聘/2校园招聘")
    # 工作地点：本期门店唯一位于上海，默认"上海"（PRD BR-35）
    location: Mapped[str] = mapped_column(String(100), nullable=False, default="上海", server_default="上海", comment="工作地点")
    # 职位类型：全职/实习/校招
    job_type: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="全职/实习/校招")
    salary_range: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="薪资范围")
    responsibility: Mapped[str | None] = mapped_column(Text, nullable=True, comment="岗位职责(富文本)")
    requirement: Mapped[str | None] = mapped_column(Text, nullable=True, comment="任职要求(富文本)")
    # 简历投递邮箱/联系方式：前台表单兜底联系信息（PRD BR-35 必填）
    contact: Mapped[str] = mapped_column(String(200), nullable=False, comment="简历投递邮箱/联系方式")
    # 急招标记：1 急招 / 0 普通（前台职位卡片角标，FR-36）
    is_urgent: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0", comment="1急招/0普通")
    # 招聘状态：1 招聘中 / 0 已关闭（仅招聘中前台展示，FR-38）
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1, server_default="1", index=True, comment="1招聘中/0已关闭")

    # 关系：收到的简历投递
    applications: Mapped[list["JobApplication"]] = relationship(back_populates="job")


class JobApplication(CommonMixin, Base):
    """【表】job_application 简历投递：应聘职位/姓名/电话/邮箱/简历附件路径/自我推荐/处理状态（PRD §9.6.1 BR-69~72）"""

    __tablename__ = "job_application"

    job_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job.id"), nullable=False, index=True, comment="应聘职位 → job.id"
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True, comment="手机号")
    email: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="邮箱")
    # 简历附件路径：PDF/Word ≤10MB（PRD FR-37），存储于 uploads 目录
    resume_url: Mapped[str] = mapped_column(String(255), nullable=False, comment="简历附件路径")
    note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="自我推荐/备注")
    # 处理状态：0 待处理 / 1 已联系 / 2 已淘汰 / 3 已录用（BR-71 可回退）
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0", comment="0待处理/1已联系/2已淘汰/3已录用")

    # 关系：应聘的职位
    job: Mapped["Job"] = relationship(back_populates="applications")
