# -*- coding: utf-8 -*-
"""
【模块功能】后台-案例管理接口：列表（关键词/状态筛选）/新增/编辑/删除/发布切换
依据：开发技术文档 §6.3.5（perm 矩阵）；PRD BR-21~25；数据库设计文档 §3.3。
删除为软删除（is_activate=0），保留历史数据可追溯（ADR-004）。
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.db.session import get_db
from app.models import CaseInfo
from app.schemas.case import CaseCreate, CaseOut, CaseStatusRequest, CaseUpdate
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()


@router.get("/cases", summary="案例列表（BR-21）")
def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    keyword: str | None = None,       # 标题模糊搜索
    status: int | None = None,        # 1 发布 / 0 下线
    db: Session = Depends(get_db),
    user=Depends(require_perm("case:view")),
):
    """【接口】案例列表：可选 keyword 搜索标题、status 筛选发布状态；默认激活记录"""
    stmt = select(CaseInfo).where(CaseInfo.is_activate == 1)
    if keyword:
        stmt = stmt.where(CaseInfo.title.contains(keyword))
    if status is not None:
        stmt = stmt.where(CaseInfo.status == status)
    # 排序：sort_order 小在前，同序按创建时间倒序（新案例靠前）
    stmt = stmt.order_by(CaseInfo.sort_order.asc(), CaseInfo.id.desc())
    data = paginate(stmt, page, page_size, db)
    items = [CaseOut.model_validate(c).model_dump() for c in data.items]
    return ok({"items": items, "total": data.total, "page": data.page,
               "page_size": data.page_size, "pages": data.pages})


@router.post("/cases", summary="新增案例（BR-22）")
def create_case(
    body: CaseCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("case:create")),
):
    """【接口】新增案例：标题查重（避免前台列表出现重复项目）"""
    exists = db.scalar(select(CaseInfo).where(
        CaseInfo.title == body.title, CaseInfo.is_activate == 1
    ))
    if exists:
        raise BizError(Code.CONFLICT, f"案例「{body.title}」已存在")
    case = CaseInfo(**body.model_dump())
    db.add(case)
    db.flush()  # 先取得 id 用于操作日志
    add_operation_log(db, user_id=user.id, module="case", action="create",
                      detail=f"新增案例「{case.title}」(id={case.id})")
    db.commit()
    return ok(CaseOut.model_validate(case).model_dump(), message="案例创建成功")


@router.put("/cases/{case_id}", summary="编辑案例")
def update_case(
    case_id: int,
    body: CaseUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("case:edit")),
):
    """【接口】编辑案例：整体替换字段；标题查重（排除自身）"""
    case = db.get(CaseInfo, case_id)
    if case is None or case.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "案例不存在")
    dup = db.scalar(select(CaseInfo).where(
        CaseInfo.title == body.title, CaseInfo.id != case_id, CaseInfo.is_activate == 1
    ))
    if dup:
        raise BizError(Code.CONFLICT, f"案例「{body.title}」已存在")
    for k, v in body.model_dump().items():
        setattr(case, k, v)
    add_operation_log(db, user_id=user.id, module="case", action="update",
                      detail=f"编辑案例「{case.title}」(id={case.id})")
    db.commit()
    return ok(CaseOut.model_validate(case).model_dump(), message="案例更新成功")


@router.put("/cases/{case_id}/status", summary="案例发布/下线（BR-23）")
def update_case_status(
    case_id: int,
    body: CaseStatusRequest,
    db: Session = Depends(get_db),
    user=Depends(require_perm("case:status")),
):
    """【接口】发布状态切换：1 发布 / 0 下线（仅发布状态前台展示）"""
    case = db.get(CaseInfo, case_id)
    if case is None or case.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "案例不存在")
    case.status = body.status
    state = "发布" if body.status == 1 else "下线"
    add_operation_log(db, user_id=user.id, module="case", action="status",
                      detail=f"案例「{case.title}」{state}(id={case.id})")
    db.commit()
    return ok(CaseOut.model_validate(case).model_dump(), message=f"案例已{state}")


@router.delete("/cases/{case_id}", summary="删除案例（软删除）")
def delete_case(
    case_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("case:delete")),
):
    """【接口】删除案例：软删除（is_activate=0），保留数据可追溯"""
    case = db.get(CaseInfo, case_id)
    if case is None or case.is_activate == 0:
        raise BizError(Code.NOT_FOUND, "案例不存在")
    title = case.title
    case.is_activate = 0  # 软删除：禁用标记而非物理删除（ADR-004）
    add_operation_log(db, user_id=user.id, module="case", action="delete",
                      detail=f"删除案例「{title}」(id={case_id})")
    db.commit()
    return ok(message="案例删除成功")
