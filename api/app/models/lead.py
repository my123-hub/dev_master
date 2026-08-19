# -*- coding: utf-8 -*-
"""
【模块功能】留资管理域模型（2 张表）：appointment（在线预约）/ message（在线留言）
依据：数据库设计文档 V1.3 §3.10；前台表单提交数据落库，后台跟进管理（PRD §9.10）。
"""
from datetime import datetime

from sqlalchemy import DateTime, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CommonMixin


class Appointment(CommonMixin, Base):
    """【表】appointment 在线预约：姓名/电话/固定门店/预约时间/意向/备注/状态流转（0待处理→1已联系→2已到店→3已关闭）"""

    __tablename__ = "appointment"

    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True, comment="手机号")
    # 门店：本期表单不提供门店选择，固定归属上海旗舰店（PRD FR-43/BR-52）
    store_name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="上海旗舰店", server_default="上海旗舰店", comment="门店(本期固定上海旗舰店)"
    )
    appointment_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="预约到店时间")
    # 意向产品/系列：文本输入（选填）
    intention: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="意向产品/系列")
    remark: Mapped[str | None] = mapped_column(Text, nullable=True, comment="备注")
    # 处理状态：0 待处理 / 1 已联系 / 2 已到店 / 3 已关闭（BR-54 可回退）
    status: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0", index=True, comment="0待处理/1已联系/2已到店/3已关闭"
    )


class Message(CommonMixin, Base):
    """【表】message 在线留言：姓名/电话/邮箱(选填)/留言内容/状态（0待处理/1已处理）"""

    __tablename__ = "message"

    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True, comment="手机号")
    email: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="邮箱")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="留言内容")
    # 处理状态：0 待处理 / 1 已处理（BR-59）
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0", comment="0待处理/1已处理")
