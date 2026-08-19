# -*- coding: utf-8 -*-
"""
【模块功能】后台-留资管理接口：在线预约（列表/详情/状态流转/删除）+ 在线留言（列表/状态流转/删除）
依据：开发技术文档 §6.3.10 + §7.4 状态机；PRD BR-52~60；数据库设计文档 §3.10。
预约状态机（BR-54 支持回退）：0 待处理 → 1 已联系 → 2 已到店 → 3 已关闭；已联系可回退到待处理。
留言状态机（BR-59）：0 待处理 → 1 已处理（单向）。
"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Appointment, Message
from app.schemas.lead import AppointmentOut, AppointmentStatusRequest, MessageOut, MessageStatusRequest
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()

# 预约状态机：目标状态 -> 允许的当前状态集合（BR-54 可回退）
_APPOINTMENT_TRANSITIONS = {
    0: {1},     # 待处理：仅已联系可回退
    1: {0},     # 已联系：仅待处理可跟进
    2: {1},     # 已到店：仅已联系可标记到店
    3: {1, 2},  # 已关闭：已联系（放弃）或已到店（结束）
}

# 留言状态机：0 待处理 → 1 已处理（BR-59 单向，不可回退）
_MESSAGE_TRANSITIONS = {
    1: {0},
}

# 状态中文标签（列表筛选与操作日志使用）
_STATUS_LABELS = {0: "待处理", 1: "已联系", 2: "已到店", 3: "已关闭"}


def _check_transition(transitions: dict[int, set[int]], current: int, target: int) -> None:
    """【函数】状态流转合法性校验（禁止跨越非法跃迁，§7.4）"""
    allowed = transitions.get(target)
    if allowed is None or current not in allowed:
        raise BizError(Code.VALIDATE_ERROR,
                       f"非法状态流转：当前 {current} → 目标 {target}")


# ============================================================
# 一、在线预约（appointment）
# ============================================================

@router.get("/appointments", summary="预约列表（BR-52）")
def list_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: int | None = None,        # 0 待处理 / 1 已联系 / 2 已到店 / 3 已关闭
    date_from: date | None = None,    # 提交时间起（筛选）
    date_to: date | None = None,      # 提交时间止（筛选）
    keyword: str | None = None,       # 姓名/手机号模糊搜索
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:view")),
):
    """【接口】预约列表：status/时间筛选 + name/phone 搜索（BR-53）"""
    stmt = select(Appointment).where(Appointment.is_activate == 1)
    if status is not None:
        stmt = stmt.where(Appointment.status == status)
    if date_from:
        stmt = stmt.where(Appointment.created_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        stmt = stmt.where(Appointment.created_date <= datetime.combine(date_to, datetime.max.time()))
    if keyword:
        stmt = stmt.where(
            (Appointment.name.contains(keyword)) | (Appointment.phone.contains(keyword))
        )
    # 排序：待处理优先、提交时间倒序（新预约靠前）
    stmt = stmt.order_by(Appointment.status.asc(), Appointment.id.desc())
    data = paginate(stmt, page, page_size, db)
    items = [AppointmentOut.model_validate(a).model_dump() for a in data.items]
    return ok({"items": items, "total": data.total, "page": data.page,
               "page_size": data.page_size, "pages": data.pages})


@router.get("/appointments/{app_id}", summary="预约详情（BR-53）")
def get_appointment(
    app_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:view")),
):
    """【接口】预约详情：返回完整预约信息（含意向/备注）"""
    app = db.get(Appointment, app_id)
    if app is None or app.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "预约记录不存在")
    return ok(AppointmentOut.model_validate(app).model_dump())


@router.put("/appointments/{app_id}/status", summary="预约状态流转（BR-54）")
def update_appointment_status(
    app_id: int,
    body: AppointmentStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:status")),
):
    """【接口】状态流转：0→1→2→3 或 1→0 回退（Service 层合法性校验，写操作日志 BR-63）"""
    app = db.get(Appointment, app_id)
    if app is None or app.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "预约记录不存在")
    _check_transition(_APPOINTMENT_TRANSITIONS, app.status, body.status)
    old_label = _STATUS_LABELS[app.status]
    app.status = body.status
    new_label = _STATUS_LABELS[body.status]
    add_operation_log(db, user_id=user.id, module="lead", action="status",
                      detail=f"预约「{app.name}」状态 {old_label} → {new_label}(id={app.id})")
    db.commit()
    return ok(AppointmentOut.model_validate(app).model_dump(),
              message=f"状态已更新为「{new_label}」")


@router.delete("/appointments/{app_id}", summary="删除预约记录")
def delete_appointment(
    app_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:delete")),
):
    """【接口】删除预约：软删除（is_activate=0），保留数据可追溯"""
    app = db.get(Appointment, app_id)
    if app is None or app.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "预约记录不存在")
    name = app.name
    app.is_activate = 0
    add_operation_log(db, user_id=user.id, module="lead", action="delete",
                      detail=f"删除预约「{name}」(id={app_id})")
    db.commit()
    return ok(message="预约记录已删除")


# ============================================================
# 二、在线留言（message）
# ============================================================

@router.get("/messages", summary="留言列表（BR-57）")
def list_messages(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: int | None = None,        # 0 待处理 / 1 已处理
    keyword: str | None = None,       # 姓名/手机号模糊搜索
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:view")),
):
    """【接口】留言列表：status 筛选 + name/phone 搜索（BR-58）"""
    stmt = select(Message).where(Message.is_activate == 1)
    if status is not None:
        stmt = stmt.where(Message.status == status)
    if keyword:
        stmt = stmt.where(
            (Message.name.contains(keyword)) | (Message.phone.contains(keyword))
        )
    # 排序：待处理优先、提交时间倒序（新留言靠前）
    stmt = stmt.order_by(Message.status.asc(), Message.id.desc())
    data = paginate(stmt, page, page_size, db)
    items = [MessageOut.model_validate(m).model_dump() for m in data.items]
    return ok({"items": items, "total": data.total, "page": data.page,
               "page_size": data.page_size, "pages": data.pages})


@router.put("/messages/{msg_id}/status", summary="留言状态流转（BR-59）")
def update_message_status(
    msg_id: int,
    body: MessageStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:status")),
):
    """【接口】留言状态流转：0 待处理 → 1 已处理（单向，不可回退）"""
    msg = db.get(Message, msg_id)
    if msg is None or msg.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "留言不存在")
    _check_transition(_MESSAGE_TRANSITIONS, msg.status, body.status)
    old_label = "待处理" if msg.status == 0 else "已处理"
    msg.status = body.status
    new_label = "已处理" if body.status == 1 else "待处理"
    add_operation_log(db, user_id=user.id, module="lead", action="status",
                      detail=f"留言「{msg.name}」状态 {old_label} → {new_label}(id={msg.id})")
    db.commit()
    return ok(MessageOut.model_validate(msg).model_dump(),
              message=f"状态已更新为「{new_label}」")


@router.delete("/messages/{msg_id}", summary="删除留言")
def delete_message(
    msg_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:delete")),
):
    """【接口】删除留言：软删除（is_activate=0），保留数据可追溯"""
    msg = db.get(Message, msg_id)
    if msg is None or msg.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "留言不存在")
    name = msg.name
    msg.is_activate = 0
    add_operation_log(db, user_id=user.id, module="lead", action="delete",
                      detail=f"删除留言「{name}」(id={msg_id})")
    db.commit()
    return ok(message="留言已删除")
