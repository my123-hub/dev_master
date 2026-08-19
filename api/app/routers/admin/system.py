# -*- coding: utf-8 -*-
"""
【模块功能】后台-系统管理接口：用户管理 / 角色权限 / 操作日志 / 部门列表（仅超级管理员 system:*）
依据：开发技术文档 §6.3.12；PRD BR-61/62/63；数据库设计文档 §3.1。
要点：
- 用户：列表/新增/编辑/停用启用(is_activate)/重置密码；禁止停用或降权自身账号；
- 角色：列表(含权限点) / 更新权限点(服务端强制，NFR-07)；内置 super_admin 不可改权限；
- 日志：只读分页查询（BR-63），可按模块/动作/关键字/时间筛选；
- 部门：用户归属部门下拉数据源。
"""
import secrets

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_perm
from app.core.exceptions import BizError
from app.core.response import Code, ok
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Department, OperationLog, Permission, Role, RolePermission, SysUser
from app.schemas.system import (
    LogItem, RoleOut, RolePermissionUpdate, UserCreate, UserOut, UserPasswordReset, UserUpdate,
)
from app.utils.log_util import add_operation_log
from app.utils.pagination import paginate, pagination_params

router = APIRouter()

# 内置超级管理员角色名（不可改权限，避免锁死系统，BR-62 保护）
_BUILTIN_SUPER_ROLE = "super_admin"
# 菜单 key → 中文分组名（权限点全量清单按菜单分组展示，M6-4）
_MENU_LABELS = {
    "dashboard": "工作台",
    "product": "产品管理",
    "case": "案例管理",
    "news": "新闻管理",
    "recruit": "招聘管理",
    "application": "简历投递",
    "content": "内容管理",
    "store": "门店管理",
    "home": "首页配置",
    "lead": "留资管理",
    "system": "系统管理",
}


def _user_out(u: SysUser) -> dict:
    """【工具函数】SysUser → UserOut dict：附加角色名/部门名"""
    return UserOut.model_validate(u).model_copy(
        update={
            "role_name": u.role.role_name if u.role else None,
            "dept_name": u.dept.dept_name if u.dept else None,
        }
    ).model_dump()


# ==================== 用户管理 ====================
@router.get("/users", summary="用户列表（BR-61）")
def list_users(
    page: int,
    page_size: int,
    keyword: str | None = None,          # 按登录名/姓名模糊搜索
    role_id: int | None = None,          # 按角色筛选
    is_activate: int | None = None,      # 按启用状态筛选：1 启用 / 0 停用
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:user")),
):
    """【接口】用户列表：默认仅返回未禁用（is_activate=1），支持关键字/角色/状态筛选"""
    stmt = select(SysUser).where(SysUser.is_activate == 1).options(
        selectinload(SysUser.role), selectinload(SysUser.dept)
    )
    if keyword:
        stmt = stmt.where(or_(SysUser.username.contains(keyword), SysUser.name.contains(keyword)))
    if role_id is not None:
        stmt = stmt.where(SysUser.role_id == role_id)
    if is_activate is not None:
        stmt = stmt.where(SysUser.is_activate == is_activate)
    stmt = stmt.order_by(SysUser.id.desc())
    data = paginate(stmt, page, page_size, db)
    return ok({
        "items": [_user_out(u) for u in data.items],
        "total": data.total, "page": data.page,
        "page_size": data.page_size, "pages": data.pages,
    })


@router.post("/users", summary="新增用户（BR-61）")
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:user")),
):
    """【接口】新增用户：校验登录名唯一 + 角色存在 + 部门存在；首次登录强制改密（BR-06）"""
    if db.scalar(select(SysUser).where(SysUser.username == body.username)):
        raise BizError(Code.CONFLICT, f"登录名「{body.username}」已存在")
    if db.get(Role, body.role_id) is None:
        raise BizError(Code.NOT_FOUND, "角色不存在")
    if body.dept_id is not None and db.get(Department, body.dept_id) is None:
        raise BizError(Code.NOT_FOUND, "部门不存在")
    new_user = SysUser(
        username=body.username,
        password_hash=hash_password(body.password),
        name=body.name, nickname=body.nickname, mobile=body.mobile, email=body.email,
        gender=body.gender, position=body.position,
        dept_id=body.dept_id, role_id=body.role_id,
        must_change_pwd=True,  # 新用户首次登录强制改密（BR-06）
    )
    db.add(new_user)
    db.flush()
    add_operation_log(db, user_id=user.id, module="system", action="create",
                      detail=f"新增用户「{new_user.username}」(id={new_user.id})")
    db.commit()
    return ok(_user_out(new_user), message="用户创建成功")


@router.put("/users/{user_id}", summary="编辑用户（BR-61）")
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:user")),
):
    """【接口】编辑用户：可选字段整体更新；is_activate 用于停用/启用；禁止降权或停用自身"""
    target = db.get(SysUser, user_id)
    if target is None or target.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "用户不存在")
    if body.role_id is not None and db.get(Role, body.role_id) is None:
        raise BizError(Code.NOT_FOUND, "角色不存在")
    if body.dept_id is not None and db.get(Department, body.dept_id) is None:
        raise BizError(Code.NOT_FOUND, "部门不存在")

    # 自我保护：禁止停用自身或改动自身角色（避免超管锁死，BR-61）
    if target.id == user.id and (
        (body.is_activate is not None and body.is_activate != 1)
        or (body.role_id is not None and body.role_id != target.role_id)
    ):
        raise BizError(Code.FORBIDDEN, "不能修改自身账号的启用状态或角色")

    if body.role_id is not None:
        target.role_id = body.role_id
    if body.dept_id is not None:
        target.dept_id = body.dept_id
    if body.name is not None:
        target.name = body.name
    if body.nickname is not None:
        target.nickname = body.nickname
    if body.mobile is not None:
        target.mobile = body.mobile
    if body.email is not None:
        target.email = body.email
    if body.gender is not None:
        target.gender = body.gender
    if body.position is not None:
        target.position = body.position
    if body.is_activate is not None:
        target.is_activate = body.is_activate

    add_operation_log(db, user_id=user.id, module="system", action="update",
                      detail=f"编辑用户「{target.username}」(id={target.id})")
    db.commit()
    return ok(_user_out(target), message="用户更新成功")


@router.delete("/users/{user_id}", summary="停用/删除用户（软删除，BR-61）")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:user")),
):
    """【接口】软删除：is_activate=0（停用即等效删除，可追溯）；禁止停用当前登录账号"""
    target = db.get(SysUser, user_id)
    if target is None or target.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "用户不存在")
    if target.id == user.id:
        raise BizError(Code.FORBIDDEN, "不能停用当前登录账号")
    target.is_activate = 0
    add_operation_log(db, user_id=user.id, module="system", action="delete",
                      detail=f"停用用户「{target.username}」(id={target.id})")
    db.commit()
    return ok(message="用户已停用")


@router.put("/users/{user_id}/reset-password", summary="重置密码（BR-61）")
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:user")),
):
    """【接口】重置密码：生成随机强密码、置 must_change_pwd=True；返回新密码供管理员转交用户"""
    target = db.get(SysUser, user_id)
    if target is None or target.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "用户不存在")
    # 随机强密码（16 字节），用户首次登录仍需再次修改（BR-06）
    new_pwd = secrets.token_urlsafe(12)
    target.password_hash = hash_password(new_pwd)
    target.must_change_pwd = True
    add_operation_log(db, user_id=user.id, module="system", action="update",
                      detail=f"重置用户「{target.username}」密码(id={target.id})")
    db.commit()
    return ok(UserPasswordReset(new_password=new_pwd).model_dump(), message="密码已重置，请通知用户尽快登录修改")


# ==================== 部门列表（用户归属下拉） ====================
@router.get("/departments", summary="部门列表（用户归属）")
def list_departments(
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:user")),
):
    """【接口】部门列表：返回 id/名称/上级，供用户新增编辑表单的部门下拉"""
    depts = db.scalars(
        select(Department).where(Department.is_activate == 1).order_by(Department.id.asc())
    ).all()
    return ok([{"id": d.id, "dept_name": d.dept_name, "parent_id": d.parent_id} for d in depts])


# ==================== 角色权限 ====================
@router.get("/roles", summary="角色与权限点清单（BR-62）")
def list_roles(
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:role")),
):
    """【接口】角色列表 + 权限点全量清单：
    - items：每个角色的权限码集合（用于回显勾选）；
    - permissions：全部权限点（按菜单分组展示，M6-4 固化清单）。
    """
    roles = db.scalars(select(Role).order_by(Role.id.asc())).all()
    # 角色→权限码映射
    rp_rows = db.scalars(select(RolePermission).where(RolePermission.is_activate == 1)).all()
    rp_map: dict[int, list[int]] = {}
    for rp in rp_rows:
        rp_map.setdefault(rp.role_id, []).append(rp.permission_id)
    perms = db.scalars(select(Permission).where(Permission.is_activate == 1)).all()
    perm_code_map = {p.id: p.perm_code for p in perms}

    items = []
    for r in roles:
        codes = [perm_code_map[pid] for pid in rp_map.get(r.id, []) if pid in perm_code_map]
        items.append(RoleOut(
            id=r.id, role_name=r.role_name, remark=r.remark,
            permissions=codes, is_builtin=(r.role_name == _BUILTIN_SUPER_ROLE),
        ).model_dump())

    # 权限点全量清单（M6-4）
    catalog = [
        {"perm_code": p.perm_code, "perm_name": p.perm_name, "menu_key": p.menu_key}
        for p in perms
    ]
    return ok({"items": items, "permissions": catalog})


@router.put("/roles/{role_id}", summary="配置角色权限点（BR-62）")
def update_role_perm(
    role_id: int,
    body: RolePermissionUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:role")),
):
    """【接口】更新角色权限点：服务端校验权限码合法性；内置 super_admin 不可改（BR-62 保护）"""
    role = db.get(Role, role_id)
    if role is None or role.is_activate != 1:
        raise BizError(Code.NOT_FOUND, "角色不存在")
    if role.role_name == _BUILTIN_SUPER_ROLE:
        raise BizError(Code.FORBIDDEN, "内置超级管理员角色权限不可修改")

    # 校验提交的权限码全部合法
    valid_codes = {p.perm_code for p in db.scalars(select(Permission).where(Permission.is_activate == 1)).all()}
    invalid = set(body.permission_codes) - valid_codes
    if invalid:
        raise BizError(Code.VALIDATE_ERROR, f"未知权限码: {','.join(sorted(invalid))}")

    # 重建关联：删除旧关联后插入新关联（清晰且幂等）
    for rp in db.scalars(select(RolePermission).where(RolePermission.role_id == role_id)).all():
        db.delete(rp)
    perm_id_map = {p.perm_code: p.id for p in db.scalars(select(Permission)).all()}
    for code in body.permission_codes:
        db.add(RolePermission(role_id=role_id, permission_id=perm_id_map[code]))

    if body.remark is not None:
        role.remark = body.remark

    add_operation_log(db, user_id=user.id, module="system", action="update",
                      detail=f"更新角色「{role.role_name}」权限点(共 {len(body.permission_codes)} 项)")
    db.commit()
    return ok(message="角色权限已更新")


# ==================== 操作日志 ====================
@router.get("/logs", summary="操作日志查询（只读，BR-63）")
def list_logs(
    page: int,
    page_size: int,
    module: str | None = None,          # 按模块筛选：product/case/news/.../system
    action: str | None = None,          # 按动作筛选：create/update/delete/status/export/login
    keyword: str | None = None,         # 按操作详情模糊搜索
    date_from: str | None = None,       # 起始日期 YYYY-MM-DD（created_date >=）
    date_to: str | None = None,         # 结束日期 YYYY-MM-DD（created_date <=）
    db: Session = Depends(get_db),
    user=Depends(require_perm("system:log")),
):
    """【接口】操作日志分页查询：可按模块/动作/关键字/时间筛选，只读（BR-63）"""
    stmt = select(OperationLog)
    if module:
        stmt = stmt.where(OperationLog.module == module)
    if action:
        stmt = stmt.where(OperationLog.action == action)
    if keyword:
        stmt = stmt.where(OperationLog.detail.contains(keyword))
    if date_from:
        stmt = stmt.where(OperationLog.created_date >= date_from)
    if date_to:
        stmt = stmt.where(OperationLog.created_date <= date_to + " 23:59:59")
    stmt = stmt.order_by(OperationLog.id.desc())

    data = paginate(stmt, page, page_size, db)
    # 操作人登录名映射（user_id 为逻辑外键，无物理约束）
    user_ids = {l.user_id for l in data.items if l.user_id}
    user_map = (
        {u.id: u.username for u in db.scalars(select(SysUser).where(SysUser.id.in_(user_ids))).all()}
        if user_ids else {}
    )
    items = [
        LogItem.model_validate(l).model_copy(update={"username": user_map.get(l.user_id)}).model_dump()
        for l in data.items
    ]
    return ok({
        "items": items, "total": data.total, "page": data.page,
        "page_size": data.page_size, "pages": data.pages,
    })
