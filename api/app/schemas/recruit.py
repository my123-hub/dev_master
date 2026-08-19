# -*- coding: utf-8 -*-
"""
【模块功能】招聘管理请求/响应模型（Pydantic v2）
——招聘职位（job）与简历投递（job_application）的增删改查参数与输出结构。
依据：数据库设计文档 V1.3 §3.5；开发技术文档 §6.3.7；PRD BR-34~38 / BR-69~72。
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# 一、招聘职位（job）
# ============================================================

class JobBase(BaseModel):
    """【模型】职位公共字段：
    - category：1 社会招聘 / 2 校园招聘（前台 Tab 切换维度，FR-35）；
    - location 默认「上海」（本期门店唯一位于上海，BR-35）；
    - responsibility/requirement 富文本；contact 简历投递邮箱必填（BR-35）；
    - is_urgent：1 急招 / 0 普通（职位卡片角标，FR-36）；
    - status：1 招聘中 / 0 已关闭（仅招聘中前台展示，FR-38）。
    """
    title: str = Field(min_length=1, max_length=100, description="职位名称")
    category: int = Field(ge=1, le=2, description="分类：1 社会招聘 / 2 校园招聘")
    location: str = Field(default="上海", max_length=100, description="工作地点（默认上海）")
    job_type: str | None = Field(default=None, max_length=20, description="职位类型：全职/实习/校招")
    salary_range: str | None = Field(default=None, max_length=50, description="薪资范围")
    # 岗位职责/任职要求：富文本（wangEditor 产出 HTML，入库前清洗）
    responsibility: str | None = Field(default=None, description="岗位职责（富文本）")
    requirement: str | None = Field(default=None, description="任职要求（富文本）")
    contact: str = Field(min_length=1, max_length=200, description="简历投递邮箱/联系方式")
    is_urgent: int = Field(default=0, ge=0, le=1, description="1 急招 / 0 普通")
    status: int = Field(default=1, ge=0, le=1, description="1 招聘中 / 0 已关闭")


class JobCreate(JobBase):
    """【模型】新增职位：继承公共字段"""


class JobUpdate(JobBase):
    """【模型】编辑职位：字段与新增一致（整体替换）"""


class JobOut(JobBase):
    """【模型】职位输出：附加 id/启用状态/创建时间/投递数量（列表页展示）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int = Field(description="1 激活 / 0 禁用")
    created_date: datetime
    # 收到的简历投递数：列表页展示（投递闭环统计）
    application_count: int = 0


class JobStatusRequest(BaseModel):
    """【模型】招聘状态切换请求体：仅状态字段（BR-36）"""
    status: int = Field(ge=0, le=1, description="目标状态：1 招聘中 / 0 已关闭")


# ============================================================
# 二、简历投递（job_application）
# ============================================================

class JobApplicationOut(BaseModel):
    """【模型】投递输出（只读管理场景）：
    - resume_url 简历附件路径（附件下载/预览用）；
    - status 状态机：0 待处理 / 1 已联系 / 2 已淘汰 / 3 已录用（BR-71 可回退）。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int = Field(description="应聘职位 → job.id")
    job_title: str | None = Field(default=None, description="职位名称（联表查询填充）")
    name: str = Field(description="姓名")
    phone: str = Field(description="手机号")
    email: str | None = Field(default=None, description="邮箱")
    resume_url: str = Field(description="简历附件路径")
    note: str | None = Field(default=None, description="自我推荐/备注")
    status: int = Field(description="0 待处理 / 1 已联系 / 2 已淘汰 / 3 已录用")
    is_activate: int = Field(description="1 激活 / 0 禁用")
    created_date: datetime = Field(description="投递时间")


class JobApplicationStatusRequest(BaseModel):
    """【模型】投递状态流转请求体（BR-71 支持回退）"""
    status: int = Field(ge=0, le=3, description="目标状态：0 待处理 / 1 已联系 / 2 已淘汰 / 3 已录用")
