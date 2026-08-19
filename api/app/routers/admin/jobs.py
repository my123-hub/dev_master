# -*- coding: utf-8 -*-
"""
【模块功能】后台-招聘管理接口：职位 CRUD + 简历投递管理（列表/详情/状态流转/删除）
依据：开发技术文档 §6.3.7（perm 矩阵）+ §7.4 状态机；PRD BR-34~38 / BR-69~72。
状态机（BR-71 支持回退）：0 待处理 → 1 已联系 → 2 已淘汰 / 3 已录用；已联系可回退到待处理。
职位删除：存在投递记录时禁止删除（保留数据可追溯，与产品系列删除保护一致）。
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Job, JobApplication
from app.schemas.recruit import (
    JobApplicationOut,
    JobApplicationStatusRequest,
    JobCreate,
    JobOut,
    JobStatusRequest,
    JobUpdate,
)
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()

# 简历投递状态机：目标状态 -> 允许的当前状态集合（BR-71）
_JOB_APP_TRANSITIONS = {
    0: {1},     # 待处理：仅已联系可回退
    1: {0},     # 已联系：仅待处理可跟进
    2: {1},     # 已淘汰：仅已联系可标记
    3: {1},     # 已录用：仅已联系可录用
}


def _check_job_app_transition(current: int, target: int) -> None:
    """【函数】简历投递状态流转合法性校验（禁止跨越非法跃迁，§7.4）"""
    allowed = _JOB_APP_TRANSITIONS.get(target)
    if allowed is None or current not in allowed:
        raise BizError(Code.VALIDATE_ERROR,
                       f"非法状态流转：当前 {current} → 目标 {target}（仅允许 0→1→2/3 或 1→0）")


# ============================================================
# 一、招聘职位
# ============================================================

@router.get("/jobs", summary="职位列表（BR-34）")
def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    keyword: str | None = None,       # 职位名称模糊搜索
    category: int | None = None,      # 1 社会招聘 / 2 校园招聘
    status: int | None = None,        # 1 招聘中 / 0 已关闭
    db: Session = Depends(get_db),
    user=Depends(require_perm("recruit:view")),
):
    """【接口】职位列表：可选 keyword/category/status 筛选；附带每个职位的投递数量"""
    stmt = select(Job).where(Job.is_activate == 1)
    if keyword:
        stmt = stmt.where(Job.title.contains(keyword))
    if category is not None:
        stmt = stmt.where(Job.category == category)
    if status is not None:
        stmt = stmt.where(Job.status == status)
    # 排序：急招在前、创建时间倒序（新职位靠前）
    stmt = stmt.order_by(Job.is_urgent.desc(), Job.id.desc())
    data = paginate(stmt, page, page_size, db)
    # 联表统计每个职位的投递数量：按 job_id 分组计数
    count_map = dict(
        db.execute(
            select(JobApplication.job_id, func.count(JobApplication.id))
            .where(JobApplication.is_activate == 1)
            .group_by(JobApplication.job_id)
        ).all()
    )
    items = [
        JobOut.model_validate(j).model_copy(
            update={"application_count": count_map.get(j.id, 0)}
        ).model_dump()
        for j in data.items
    ]
    return ok({"items": items, "total": data.total, "page": data.page,
               "page_size": data.page_size, "pages": data.pages})


@router.post("/jobs", summary="新增职位（BR-35）")
def create_job(
    body: JobCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("recruit:create")),
):
    """【接口】新增职位：标题查重（同职位名不重复发布）"""
    exists = db.scalar(select(Job).where(Job.title == body.title, Job.is_activate == 1))
    if exists:
        raise BizError(Code.CONFLICT, f"职位「{body.title}」已存在")
    job = Job(**body.model_dump())
    db.add(job)
    db.flush()
    add_operation_log(db, user_id=user.id, module="recruit", action="create",
                      detail=f"新增职位「{job.title}」(id={job.id})")
    db.commit()
    return ok(JobOut.model_validate(job).model_dump(), message="职位创建成功")


@router.put("/jobs/{job_id}", summary="编辑职位")
def update_job(
    job_id: int,
    body: JobUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("recruit:edit")),
):
    """【接口】编辑职位：整体替换字段；标题查重（排除自身）"""
    job = db.get(Job, job_id)
    if job is None or job.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "职位不存在")
    dup = db.scalar(select(Job).where(
        Job.title == body.title, Job.id != job_id, Job.is_activate == 1
    ))
    if dup:
        raise BizError(Code.CONFLICT, f"职位「{body.title}」已存在")
    for k, v in body.model_dump().items():
        setattr(job, k, v)
    add_operation_log(db, user_id=user.id, module="recruit", action="update",
                      detail=f"编辑职位「{job.title}」(id={job.id})")
    db.commit()
    return ok(JobOut.model_validate(job).model_dump(), message="职位更新成功")


@router.put("/jobs/{job_id}/status", summary="职位招聘状态切换（BR-36）")
def update_job_status(
    job_id: int,
    body: JobStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("recruit:status")),
):
    """【接口】招聘状态切换：1 招聘中 / 0 已关闭（仅招聘中前台展示，FR-38）"""
    job = db.get(Job, job_id)
    if job is None or job.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "职位不存在")
    job.status = body.status
    state = "招聘中" if body.status == 1 else "已关闭"
    add_operation_log(db, user_id=user.id, module="recruit", action="status",
                      detail=f"职位「{job.title}」{state}(id={job.id})")
    db.commit()
    return ok(JobOut.model_validate(job).model_dump(), message=f"职位已{state}")


@router.delete("/jobs/{job_id}", summary="删除职位（有投递禁删）")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("recruit:delete")),
):
    """【接口】删除职位：存在投递记录（含已禁用）→ 409 禁止删除（保留投递数据可追溯）"""
    job = db.get(Job, job_id)
    if job is None or job.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "职位不存在")
    app_count = db.scalar(
        select(func.count(JobApplication.id)).where(JobApplication.job_id == job_id)
    ) or 0
    if app_count > 0:
        raise BizError(Code.CONFLICT, f"该职位已有 {app_count} 份简历投递，请勿删除（可改为已关闭）")
    title = job.title
    job.is_activate = 0  # 软删除（ADR-004）
    add_operation_log(db, user_id=user.id, module="recruit", action="delete",
                      detail=f"删除职位「{title}」(id={job_id})")
    db.commit()
    return ok(message="职位删除成功")


# ============================================================
# 二、简历投递
# ============================================================

@router.get("/job-applications", summary="简历投递列表（BR-69）")
def list_job_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: int | None = None,        # 0 待处理 / 1 已联系 / 2 已淘汰 / 3 已录用
    job_id: int | None = None,        # 按职位筛选
    keyword: str | None = None,       # 姓名/手机号模糊搜索
    db: Session = Depends(get_db),
    user=Depends(require_perm("application:view")),
):
    """【接口】投递列表：筛选 status/job、搜索 name/phone；联表职位标题（joinedload 避免 N+1）"""
    # joinedload 关联加载职位：查询投递时一次性带出 job 对象，取 title 展示（NFR-02 防 N+1）
    stmt = select(JobApplication).options(joinedload(JobApplication.job))
    stmt = stmt.where(JobApplication.is_activate == 1)
    if status is not None:
        stmt = stmt.where(JobApplication.status == status)
    if job_id is not None:
        stmt = stmt.where(JobApplication.job_id == job_id)
    if keyword:
        stmt = stmt.where(
            (JobApplication.name.contains(keyword)) | (JobApplication.phone.contains(keyword))
        )
    # 排序：待处理优先、投递时间倒序（新投递靠前）
    stmt = stmt.order_by(JobApplication.status.asc(), JobApplication.id.desc())
    data = paginate(stmt, page, page_size, db)
    items = [
        JobApplicationOut.model_validate(app).model_copy(
            update={"job_title": app.job.title if app.job else None}
        ).model_dump()
        for app in data.items
    ]
    return ok({"items": items, "total": data.total, "page": data.page,
               "page_size": data.page_size, "pages": data.pages})


@router.get("/job-applications/{app_id}", summary="简历投递详情（BR-70）")
def get_job_application(
    app_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("application:view")),
):
    """【接口】投递详情：返回完整投递信息（含自我推荐/简历附件路径/职位标题）"""
    app = db.scalar(
        select(JobApplication).options(joinedload(JobApplication.job))
        .where(JobApplication.id == app_id, JobApplication.is_activate == 1)
    )
    if app is None:
        raise BizError(Code.NOT_FOUND, "投递记录不存在")
    return ok(JobApplicationOut.model_validate(app).model_copy(
        update={"job_title": app.job.title if app.job else None}).model_dump())


@router.put("/job-applications/{app_id}/status", summary="投递状态流转（BR-71）")
def update_job_application_status(
    app_id: int,
    body: JobApplicationStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("application:status")),
):
    """【接口】状态流转：0→1→2/3 或 1→0 回退（Service 层合法性校验，写操作日志 BR-63）"""
    app = db.get(JobApplication, app_id)
    if app is None or app.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "投递记录不存在")
    # 状态机合法性校验：禁止跨越非法跃迁（§7.4）
    _check_job_app_transition(app.status, body.status)
    old_status, app.status = app.status, body.status
    labels = {0: "待处理", 1: "已联系", 2: "已淘汰", 3: "已录用"}
    add_operation_log(db, user_id=user.id, module="application", action="status",
                      detail=f"投递「{app.name}」状态 {labels[old_status]} → {labels[body.status]}(id={app.id})")
    db.commit()
    return ok(JobApplicationOut.model_validate(app).model_dump(),
              message=f"状态已更新为「{labels[body.status]}」")


@router.delete("/job-applications/{app_id}", summary="删除投递记录")
def delete_job_application(
    app_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("application:delete")),
):
    """【接口】删除投递：软删除（is_activate=0），简历附件文件保留"""
    app = db.get(JobApplication, app_id)
    if app is None or app.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "投递记录不存在")
    name = app.name
    app.is_activate = 0
    add_operation_log(db, user_id=user.id, module="application", action="delete",
                      detail=f"删除投递「{name}」(id={app_id})")
    db.commit()
    return ok(message="投递记录已删除")
