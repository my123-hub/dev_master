# -*- coding: utf-8 -*-
"""
【模块功能】前台-招聘公开接口：职位列表 / 职位详情 / 简历投递（§6.2.10~6.2.11 + 6.2.19）
依据：开发技术文档 §6.2 + §7.3（留资限流）；PRD FR-35~38 / FR-37 / BR-69。
- 职位：仅招聘中（status=1）；支持 category（1 社会/2 校园）Tab 切换。
- 投递：multipart/form-data（name*/phone*/email/resume*/note）；简历 PDF/Word ≤10MB；
  限流 5/min/IP；落库 status=0 待处理（BR-71）。
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import Job, JobApplication
from app.schemas.public import PHONE_PATTERN
from app.utils.rate_limit import rate_limiter

router = APIRouter()

# 简历附件扩展名白名单：PDF / Word（FR-37，前端与后端双重校验）
ALLOWED_RESUME_EXT = {".pdf", ".doc", ".docx"}
# 简历附件大小上限 10MB（FR-37）
MAX_RESUME_SIZE = 10 * 1024 * 1024

# 留资限流：5 次 / 分钟 / IP（开发技术文档 §7.3）
LEAD_LIMIT = 5
LEAD_WINDOW = 60


@router.get("/jobs", summary="职位列表（§6.2.10）")
def list_jobs(
    category: int | None = None,          # 1 社会招聘 / 2 校园招聘（FR-35 Tab 切换）
    db: Session = Depends(get_db),
):
    """【接口】职位列表：仅招聘中（status=1，FR-38）；支持分类 Tab 筛选"""
    stmt = select(Job).where(Job.is_activate == 1, Job.status == 1)
    if category is not None:
        stmt = stmt.where(Job.category == category)
    # 排序：急招优先、创建时间倒序（新职位靠前，FR-36 急招角标）
    stmt = stmt.order_by(Job.is_urgent.desc(), Job.id.desc())
    rows = db.scalars(stmt).all()
    return ok([
        {
            "id": j.id,
            "title": j.title,
            "location": j.location,
            "category": j.category,
            "job_type": j.job_type,
            "salary_range": j.salary_range,
            "is_urgent": j.is_urgent,
            "created_date": j.created_date.strftime("%Y.%m.%d") if j.created_date else "",
        }
        for j in rows
    ])


@router.get("/jobs/{job_id}", summary="职位详情（§6.2.11）")
def get_job(job_id: int, db: Session = Depends(get_db)):
    """【接口】职位详情：职责/要求富文本 + 投递联系方式"""
    job = db.scalar(select(Job).where(Job.id == job_id, Job.is_activate == 1, Job.status == 1))
    if job is None:
        raise BizError(Code.NOT_FOUND, "职位不存在或已关闭")
    return ok({
        "id": job.id,
        "title": job.title,
        "location": job.location,
        "job_type": job.job_type,
        "salary_range": job.salary_range,
        "is_urgent": job.is_urgent,
        "responsibility": job.responsibility,
        "requirement": job.requirement,
        "contact": job.contact,
    })


@router.post("/jobs/{job_id}/apply", summary="简历投递（§6.2.19，限流 5/min/IP）")
async def apply_job(
    job_id: int,
    request: Request,
    name: str = Form(min_length=1, max_length=50),
    phone: str = Form(pattern=PHONE_PATTERN),
    email: str | None = Form(default=None, max_length=100),
    resume: UploadFile = File(...),
    note: str | None = Form(default=None, max_length=1000),
    db: Session = Depends(get_db),
):
    """【接口】简历投递（multipart/form-data）：
    1. 职位必须存在且招聘中；
    2. 限流 5/min/IP；
    3. 简历附件校验（PDF/Word、≤10MB、随机文件名落盘）；
    4. 落库 job_application（job_id 关联，status=0 待处理，BR-71）。
    """
    # 1) 职位有效性校验（FR-38：仅招聘中可投递）
    job = db.scalar(select(Job).where(Job.id == job_id, Job.is_activate == 1, Job.status == 1))
    if job is None:
        raise BizError(Code.NOT_FOUND, "职位不存在或已关闭")

    # 2) 留资限流（§7.3）
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.check(f"lead:{client_ip}", LEAD_LIMIT, LEAD_WINDOW):
        raise BizError(Code.RATE_LIMITED, "操作过于频繁，请稍后再试")

    # 3) 简历附件：扩展名白名单 + 大小校验（FR-37/NFR-09）
    ext = Path(resume.filename or "").suffix.lower()
    if ext not in ALLOWED_RESUME_EXT:
        raise BizError(Code.VALIDATE_ERROR, "简历仅支持 PDF / Word 格式（.pdf/.doc/.docx）")
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"resume_{uuid.uuid4().hex}{ext}"
    target = upload_dir / filename
    size = 0
    try:
        with target.open("wb") as f:
            while chunk := await resume.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_RESUME_SIZE:
                    raise BizError(Code.TOO_LARGE, "简历附件大小不能超过 10MB")
                f.write(chunk)
    except BizError:
        target.unlink(missing_ok=True)  # 超限清理半写文件
        raise

    # 4) 落库（status=0 待处理，后台跟进，BR-71）
    app = JobApplication(
        job_id=job.id,
        name=name.strip(),
        phone=phone.strip(),
        email=email.strip() if email else None,
        resume_url=f"/static/uploads/{filename}",
        note=note.strip() if note else None,
        status=0,
    )
    db.add(app)
    db.commit()
    return ok(message="投递成功，我们将在 1-3 个工作日内与您联系")
