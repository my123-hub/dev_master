# -*- coding: utf-8 -*-
"""
【模块功能】后台-导出接口：预约/留言/简历投递 三类数据导出（CSV 默认 / Excel 可选）
依据：开发技术文档 §6.3.7/§6.3.10 + §7.6（BR-56/60/72）。
实现要点：
- CSV：utf-8-sig BOM 头（Excel 直接打开中文不乱码），text/csv 流式返回；
- Excel：openpyxl 生成 .xlsx（application/vnd.openxmlformats...）；
- 导出动作写操作日志（BR-63）；按当前筛选条件导出（服务端重新查询，不经分页）。
"""
import csv
import io
from datetime import date, datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code
from app.db.session import get_db
from app.models import Appointment, Job, JobApplication, Message
from app.utils.log_util import add_operation_log

router = APIRouter()

# 预约状态中文标签（导出列值）
_APPT_LABELS = {0: "待处理", 1: "已联系", 2: "已到店", 3: "已关闭"}
_MSG_LABELS = {0: "待处理", 1: "已处理"}
_JOBAPP_LABELS = {0: "待处理", 1: "已联系", 2: "已淘汰", 3: "已录用"}


def _datetime_str(dt: datetime | None) -> str:
    """【函数】时间格式化：None → 空串；datetime → YYYY-MM-DD HH:MM:SS（Excel 友好）"""
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else ""


def _export_response(rows: list[list[str]], headers: list[str],
                     filename: str, fmt: str, writer) -> StreamingResponse:
    """【函数】按格式构造流式导出响应：
    - csv：utf-8-sig 编码（BOM 兼容 Excel）；
    - excel：openpyxl 写内存 xlsx。
    """
    if fmt == "excel":
        # 延迟导入：仅 Excel 导出时加载 openpyxl（避免启动开销）
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "导出数据"
        ws.append(headers)
        for row in rows:
            ws.append(row)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext = "xlsx"
    else:
        buf = io.StringIO()
        csv_writer = writer(buf)
        csv_writer.writerow(headers)
        csv_writer.writerows(rows)
        data = "\ufeff" + buf.getvalue()  # BOM 头：Excel 打开 UTF-8 中文不乱码
        buf = io.BytesIO(data.encode("utf-8"))
        media_type = "text/csv; charset=utf-8"
        ext = "csv"
    # Content-Disposition 文件名：RFC 5987 filename*（URL 编码 UTF-8），
    # 兼容中文文件名 —— HTTP 头仅允许 latin-1，直接写中文会 UnicodeEncodeError
    encoded_name = quote(f"{filename}.{ext}")
    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}"},
    )


# ============================================================
# 一、预约导出（BR-56）
# ============================================================

@router.get("/exports/appointments", summary="导出预约（BR-56）")
def export_appointments(
    fmt: str = Query("csv", pattern="^(csv|excel)$", description="导出格式：csv / excel"),
    status: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:export")),
):
    """【接口】按当前筛选条件导出预约列表（服务端重新查询全量，不经分页）"""
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
    stmt = stmt.order_by(Appointment.id.desc())
    apps = db.scalars(stmt).all()
    headers = ["ID", "姓名", "手机号", "门店", "预约到店时间", "意向产品/系列", "备注", "状态", "提交时间"]
    rows = [
        [str(a.id), a.name, a.phone, a.store_name, _datetime_str(a.appointment_date),
         a.intention or "", a.remark or "", _APPT_LABELS.get(a.status, str(a.status)),
         _datetime_str(a.created_date)]
        for a in apps
    ]
    add_operation_log(db, user_id=user.id, module="lead", action="export",
                      detail=f"导出预约数据 {len(apps)} 条（{fmt}）")
    db.commit()
    return _export_response(rows, headers, f"预约导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                            fmt, csv.writer)


# ============================================================
# 二、留言导出（BR-60）
# ============================================================

@router.get("/exports/messages", summary="导出留言（BR-60）")
def export_messages(
    fmt: str = Query("csv", pattern="^(csv|excel)$", description="导出格式：csv / excel"),
    status: int | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_perm("lead:export")),
):
    """【接口】按当前筛选条件导出留言列表"""
    stmt = select(Message).where(Message.is_activate == 1)
    if status is not None:
        stmt = stmt.where(Message.status == status)
    if keyword:
        stmt = stmt.where(
            (Message.name.contains(keyword)) | (Message.phone.contains(keyword))
        )
    stmt = stmt.order_by(Message.id.desc())
    msgs = db.scalars(stmt).all()
    headers = ["ID", "姓名", "手机号", "邮箱", "留言内容", "状态", "提交时间"]
    rows = [
        [str(m.id), m.name, m.phone, m.email or "", m.content,
         _MSG_LABELS.get(m.status, str(m.status)), _datetime_str(m.created_date)]
        for m in msgs
    ]
    add_operation_log(db, user_id=user.id, module="lead", action="export",
                      detail=f"导出留言数据 {len(msgs)} 条（{fmt}）")
    db.commit()
    return _export_response(rows, headers, f"留言导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                            fmt, csv.writer)


# ============================================================
# 三、简历投递导出（BR-72）
# ============================================================

@router.get("/exports/job-applications", summary="导出简历投递（BR-72）")
def export_job_applications(
    fmt: str = Query("csv", pattern="^(csv|excel)$", description="导出格式：csv / excel"),
    status: int | None = None,
    job_id: int | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_perm("application:export")),
):
    """【接口】按当前筛选条件导出简历投递列表（联表职位标题）"""
    stmt = select(JobApplication, Job.title).join(Job, Job.id == JobApplication.job_id)
    stmt = stmt.where(JobApplication.is_activate == 1)
    if status is not None:
        stmt = stmt.where(JobApplication.status == status)
    if job_id is not None:
        stmt = stmt.where(JobApplication.job_id == job_id)
    if keyword:
        stmt = stmt.where(
            (JobApplication.name.contains(keyword)) | (JobApplication.phone.contains(keyword))
        )
    stmt = stmt.order_by(JobApplication.id.desc())
    rows_src = db.execute(stmt).all()
    headers = ["ID", "应聘职位", "姓名", "手机号", "邮箱", "简历附件", "自我推荐", "状态", "投递时间"]
    rows = [
        [str(app.id), job_title, app.name, app.phone, app.email or "", app.resume_url,
         app.note or "", _JOBAPP_LABELS.get(app.status, str(app.status)),
         _datetime_str(app.created_date)]
        for app, job_title in rows_src
    ]
    add_operation_log(db, user_id=user.id, module="application", action="export",
                      detail=f"导出简历投递 {len(rows)} 条（{fmt}）")
    db.commit()
    return _export_response(rows, headers, f"简历投递导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                            fmt, csv.writer)
