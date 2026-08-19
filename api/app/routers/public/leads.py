# -*- coding: utf-8 -*-
"""
【模块功能】前台-留资提交接口：在线预约 / 在线留言（§6.2.17~6.2.18，限流 5/min/IP）
依据：开发技术文档 §6.2 + §7.3（留资限流）；PRD FR-43~50/BR-52~60。
- 限流：自研 MemoryRateLimiter（键 = lead:ip，窗口 60s 阈值 5，超限返回 42900）；
- store_name 固定「上海旗舰店」（FR-43，前台不提供门店选择）；
- 手机号正则 ^1[3-9]\\d{9}$（Pydantic pattern）；隐私提示由前端勾选（FR-44）；
- 落库 status=0 待处理（FR-46），后台跟进管理。
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Appointment, Message
from app.schemas.public import AppointmentCreate, MessageCreate
from app.utils.rate_limit import rate_limiter

router = APIRouter()

# 留资限流：5 次 / 分钟 / IP（开发技术文档 §7.3，PRD NFR-11）
LEAD_LIMIT = 5
LEAD_WINDOW = 60


def _check_lead_rate_limit(request: Request) -> None:
    """【函数】留资提交限流：键 = lead:<client_ip>，窗口 60s 阈值 5，超限 42900"""
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.check(f"lead:{client_ip}", LEAD_LIMIT, LEAD_WINDOW):
        raise BizError(Code.RATE_LIMITED, "操作过于频繁，请稍后再试")


@router.post("/appointments", summary="提交在线预约（§6.2.17，限流 5/min/IP）")
def create_appointment(
    body: AppointmentCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """【接口】在线预约：姓名/手机号必填（正则校验）；store_name 服务端固定上海旗舰店（FR-43）"""
    _check_lead_rate_limit(request)
    # 预约到店时间：字符串 → datetime（YYYY-MM-DD HH:MM），格式非法返回 40000
    appt_date: datetime | None = None
    if body.appointment_date:
        try:
            appt_date = datetime.strptime(body.appointment_date.strip(), "%Y-%m-%d %H:%M")
        except ValueError:
            raise BizError(Code.VALIDATE_ERROR, "预约时间格式应为 YYYY-MM-DD HH:MM")
    # 落库：门店固定上海旗舰店、status=0 待处理（FR-46）
    appt = Appointment(
        name=body.name,
        phone=body.phone,
        store_name="上海旗舰店",
        appointment_date=appt_date,
        intention=body.intention,
        remark=body.remark,
        status=0,
    )
    db.add(appt)
    db.commit()
    return ok(message="预约成功，我们将在 1-2 个工作日内与您联系")


@router.post("/messages", summary="提交在线留言（§6.2.18，限流 5/min/IP）")
def create_message(
    body: MessageCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """【接口】在线留言：姓名/手机号/内容必填；email 选填（格式校验）"""
    _check_lead_rate_limit(request)
    msg = Message(
        name=body.name,
        phone=body.phone,
        email=body.email,
        content=body.content,
        status=0,  # 待处理（BR-59）
    )
    db.add(msg)
    db.commit()
    return ok(message="留言成功，我们将尽快与您联系")
