# -*- coding: utf-8 -*-
"""
【模块功能】留资管理请求/响应模型（Pydantic v2）
——在线预约（appointment）与在线留言（message）的查询/状态流转参数与输出结构。
依据：数据库设计文档 V1.3 §3.10；开发技术文档 §6.3.10 + §7.4 状态机；PRD BR-52~60。
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# 一、在线预约（appointment）
# ============================================================

class AppointmentOut(BaseModel):
    """【模型】预约输出（只读管理场景）：
    - store_name 门店：本期表单不提供选择，固定上海旗舰店（FR-43/BR-52）；
    - status 状态机：0 待处理 / 1 已联系 / 2 已到店 / 3 已关闭（BR-54 可回退）。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(description="姓名")
    phone: str = Field(description="手机号")
    store_name: str = Field(description="门店")
    appointment_date: datetime | None = Field(default=None, description="预约到店时间")
    intention: str | None = Field(default=None, description="意向产品/系列")
    remark: str | None = Field(default=None, description="备注")
    status: int = Field(description="0 待处理 / 1 已联系 / 2 已到店 / 3 已关闭")
    is_activate: int = Field(description="1 激活 / 0 禁用")
    created_date: datetime = Field(description="提交时间")


class AppointmentStatusRequest(BaseModel):
    """【模型】预约状态流转请求体（BR-54：0→1→2→3，支持 1→0 回退）"""
    status: int = Field(ge=0, le=3, description="目标状态：0 待处理 / 1 已联系 / 2 已到店 / 3 已关闭")


# ============================================================
# 二、在线留言（message）
# ============================================================

class MessageOut(BaseModel):
    """【模型】留言输出（只读管理场景）：
    - status：0 待处理 / 1 已处理（BR-59 单向流转）。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(description="姓名")
    phone: str = Field(description="手机号")
    email: str | None = Field(default=None, description="邮箱")
    content: str = Field(description="留言内容")
    status: int = Field(description="0 待处理 / 1 已处理")
    is_activate: int = Field(description="1 激活 / 0 禁用")
    created_date: datetime = Field(description="提交时间")


class MessageStatusRequest(BaseModel):
    """【模型】留言状态流转请求体（BR-59：0 待处理 → 1 已处理）"""
    status: int = Field(ge=0, le=1, description="目标状态：0 待处理 / 1 已处理")
