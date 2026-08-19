# -*- coding: utf-8 -*-
"""
【模块功能】案例管理请求/响应模型（Pydantic v2）
——实景案例（case_info）的增删改查参数与输出结构。
依据：数据库设计文档 V1.3 §3.3；开发技术文档 §6.3.5；PRD BR-21~25。
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CaseBase(BaseModel):
    """【模型】案例公共字段：
    - title 必填；space_tags 空间标签数组（前台案例筛选维度，FR-29）；
    - city/area/finished_at 项目信息（BR-22）；
    - content 富文本项目介绍；images 实景图集（BR-24）；
    - status：1 发布 / 0 下线（仅发布状态前台展示，BR-23）。
    """
    title: str = Field(min_length=1, max_length=150, description="案例标题")
    cover_url: str | None = Field(default=None, max_length=255, description="封面图 URL")
    # 空间标签：JSON 数组，如 ["客厅","卧室"]（前台案例 Tab 筛选，FR-29）
    space_tags: list[str] | None = Field(default=None, description="空间标签数组")
    city: str | None = Field(default=None, max_length=50, description="城市")
    area: str | None = Field(default=None, max_length=50, description="面积")
    finished_at: str | None = Field(default=None, max_length=30, description="完工时间")
    # 富文本项目介绍（wangEditor 产出 HTML，入库前清洗）
    content: str | None = Field(default=None, description="项目介绍（富文本 HTML）")
    images: list[str] | None = Field(default=None, description="实景图集 URL 数组")
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序（小在前）")
    status: int = Field(default=1, ge=0, le=1, description="发布状态：1 发布 / 0 下线")


class CaseCreate(CaseBase):
    """【模型】新增案例：继承公共字段"""


class CaseUpdate(CaseBase):
    """【模型】编辑案例：字段与新增一致（整体替换）"""


class CaseOut(CaseBase):
    """【模型】案例输出：附加 id/启用状态/创建时间（列表页展示）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int = Field(description="1 激活 / 0 禁用")
    created_date: datetime


class CaseStatusRequest(BaseModel):
    """【模型】发布/下线切换请求体：仅状态字段（BR-23）"""
    status: int = Field(ge=0, le=1, description="目标状态：1 发布 / 0 下线")
