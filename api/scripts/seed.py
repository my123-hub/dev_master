# -*- coding: utf-8 -*-
"""
【模块功能】数据库种子脚本
——初始化系统运行所需的最小基础数据（数据库设计文档 §5.1）：
  角色 / 权限点 / 角色权限关联 / 部门树 / 初始超管 / 新闻栏目 / 上海旗舰店 / 系统配置 / 单页内容模板
运行方式（在 api/ 目录下）：
  .venv\\Scripts\\alembic.exe upgrade head   # 先建表
  .venv\\Scripts\\python.exe scripts\\seed.py # 再灌种子

⚠️ 占位说明：门店地址/联系信息/Slogan 等文案使用占位值，待 Q1/Q2 待确认事项答复后替换为真实值。
"""
import os
import secrets
import sys
from pathlib import Path

# 将项目根（api/）加入模块搜索路径，保证脚本可在任意目录被调用
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Department, NewsCategory, PageContent, Permission, Role, RolePermission,
    Store, SysConfig, SysUser,
)


# ============================================================
# 一、基础数据定义（常量区：便于集中审查与调整）
# ============================================================

# 角色定义：role_name 唯一（数据库设计文档 §5.1 最小角色集）
ROLES = [
    {"role_name": "super_admin", "remark": "超级管理员：拥有全部权限"},
    {"role_name": "content_editor", "remark": "内容编辑：仅内容类模块权限，无系统管理"},
]

# 部门树：parent 为空表示顶级部门
DEPARTMENTS = [
    {"dept_name": "总部", "parent": None},
    {"dept_name": "内容部", "parent": "总部"},
    {"dept_name": "运营部", "parent": "总部"},
]

# 权限点定义：按后台菜单/功能模块拆分（PRD §7.2 后台菜单结构 + NFR-07 服务端强制）
PERMISSIONS = [
    # 工作台
    ("dashboard:view", "工作台查看", "dashboard"),
    # 产品管理（含系列）
    ("product:view", "产品查看", "product"),
    ("product:create", "产品新增", "product"),
    ("product:edit", "产品编辑", "product"),
    ("product:delete", "产品删除", "product"),
    ("product:status", "产品上下架", "product"),
    # 案例管理
    ("case:view", "案例查看", "case"),
    ("case:create", "案例新增", "case"),
    ("case:edit", "案例编辑", "case"),
    ("case:delete", "案例删除", "case"),
    ("case:status", "案例发布/下线", "case"),
    # 新闻管理
    ("news:view", "新闻查看", "news"),
    ("news:create", "新闻新增", "news"),
    ("news:edit", "新闻编辑", "news"),
    ("news:delete", "新闻删除", "news"),
    ("news:status", "新闻发布", "news"),
    # 招聘管理
    ("recruit:view", "职位查看", "recruit"),
    ("recruit:create", "职位新增", "recruit"),
    ("recruit:edit", "职位编辑", "recruit"),
    ("recruit:delete", "职位删除", "recruit"),
    ("recruit:status", "职位启停", "recruit"),
    # 简历投递
    ("application:view", "投递查看", "application"),
    ("application:status", "投递状态流转", "application"),
    ("application:delete", "投递删除", "application"),
    ("application:export", "投递导出", "application"),
    # 内容管理（单页/历程/FAQ/联系信息）
    ("content:view", "内容查看", "content"),
    ("content:edit", "内容编辑", "content"),
    # 门店管理
    ("store:view", "门店查看", "store"),
    ("store:edit", "门店编辑", "store"),
    # 首页配置（轮播/推荐位/标语）
    ("home:view", "首页配置查看", "home"),
    ("home:edit", "首页配置编辑", "home"),
    # 留资管理（预约/留言）
    ("lead:view", "留资查看", "lead"),
    ("lead:status", "留资状态流转", "lead"),
    ("lead:delete", "留资删除", "lead"),
    ("lead:export", "留资导出", "lead"),
    # 系统管理（仅超级管理员）
    ("system:user", "用户管理", "system"),
    ("system:role", "角色权限", "system"),
    ("system:log", "操作日志", "system"),
]

# 内容编辑角色所拥有的权限码（内容类模块；不含 system:* 系统管理，PRD §5.2）
CONTENT_EDITOR_PERMS = [
    "dashboard:view",
    "product:view", "product:create", "product:edit", "product:delete", "product:status",
    "case:view", "case:create", "case:edit", "case:delete", "case:status",
    "news:view", "news:create", "news:edit", "news:delete", "news:status",
    "recruit:view", "recruit:create", "recruit:edit", "recruit:delete", "recruit:status",
    "application:view", "application:status", "application:delete", "application:export",
    "content:view", "content:edit",
    "store:view", "store:edit",
    "home:view", "home:edit",
    "lead:view", "lead:status", "lead:delete", "lead:export",
]

# 新闻栏目（PRD BR-26 内置两个栏目）
NEWS_CATEGORIES = [
    {"name": "企业新闻", "sort_order": 1},
    {"name": "行业资讯", "sort_order": 2},
]

# 门店：本期唯一上海旗舰店（PRD BR-43；地址为占位值，Q1 确认后替换）
STORE = {
    "name": "上海旗舰店",
    "city": "上海",
    "address": "上海市XX区XX路XX号（待确认）",
    "phone": "400-000-0000（待确认）",
    "business_hours": "10:00-22:00（待确认）",
}

# 系统配置初始键值（PRD BR-42 联系信息 / BR-51 品牌标语；占位值待 Q1/Q2 确认）
SYS_CONFIG = {
    "contact.address": "上海市XX区XX路XX号（待确认）",
    "contact.phone": "400-000-0000（待确认）",
    "contact.email": "service@stk.com（待确认）",
    "brand.slogan": "本然之美",
    "brand.sub_slogan": "回归生活本质",
    "highlight.title_1": "原创设计",
    "highlight.desc_1": "由内而外的空间美学表达",
    "highlight.title_2": "人体工程学",
    "highlight.desc_2": "每一处弧度都贴合身体",
    "highlight.title_3": "智能制造",
    "highlight.desc_3": "毫米级工艺精度保障",
    "highlight.title_4": "贴心服务",
    "highlight.desc_4": "全周期售前售后关怀",
}

# 单页内容空模板（PRD BR-39：关于STK/品牌介绍/售后政策）
PAGE_CONTENTS = [
    {"content_type": "about_stk", "title": "关于STK"},
    {"content_type": "brand_intro", "title": "品牌介绍"},
    {"content_type": "after_sales_policy", "title": "售后服务政策"},
]


# ============================================================
# 二、幂等种子函数（已存在则跳过，可重复执行）
# ============================================================

def _get_or_create_role(db: Session, name: str, remark: str) -> Role:
    """幂等创建角色：角色名已存在则直接返回，避免重复执行时冲突"""
    role = db.query(Role).filter(Role.role_name == name).first()
    if role is None:
        role = Role(role_name=name, remark=remark)
        db.add(role)
        db.flush()  # 立即生成主键 id，供后续角色-权限关联引用
    return role


def seed_roles(db: Session) -> None:
    """种子：两个内置角色（超级管理员/内容编辑）"""
    for r in ROLES:
        _get_or_create_role(db, r["role_name"], r["remark"])


def seed_departments(db: Session) -> None:
    """种子：部门树（总部 → 内容部/运营部），按 parent 名称建立父子关系"""
    existing = {d.dept_name: d for d in db.query(Department).all()}
    for item in DEPARTMENTS:
        if item["dept_name"] in existing:
            continue
        parent = existing.get(item["parent"]) if item["parent"] else None
        dept = Department(dept_name=item["dept_name"], parent_id=parent.id if parent else None)
        db.add(dept)
        existing[item["dept_name"]] = dept


def seed_permissions(db: Session) -> None:
    """种子：全部权限点（perm_code 唯一，已存在跳过）"""
    existing = {p.perm_code: p for p in db.query(Permission).all()}
    for code, name, menu_key in PERMISSIONS:
        if code not in existing:
            db.add(Permission(perm_code=code, perm_name=name, menu_key=menu_key))
    # 关键：立即 flush 使权限获得主键 id（Session 配置 autoflush=False，不 flush 后续查询拿不到）
    db.flush()


def seed_role_permissions(db: Session) -> None:
    """种子：角色-权限关联（RBAC 初始授权）
    - super_admin：关联全部权限点
    - content_editor：仅内容类权限（无 system:*）
    """
    perm_map = {p.perm_code: p for p in db.query(Permission).all()}
    super_admin = db.query(Role).filter(Role.role_name == "super_admin").first()
    content_editor = db.query(Role).filter(Role.role_name == "content_editor").first()

    def _grant(role: Role, codes: list[str]) -> None:
        """授权工具：为角色绑定权限点集合，已存在的关联不重复添加"""
        if role is None:
            return
        # 查询该角色已有关联的权限码，用于幂等判断
        granted = {
            rp.permission_id
            for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all()
        }
        for code in codes:
            perm = perm_map.get(code)
            if perm and perm.id not in granted:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    # 超管全量；内容编辑内容类权限
    _grant(super_admin, list(perm_map.keys()))
    _grant(content_editor, CONTENT_EDITOR_PERMS)


def seed_admin(db: Session) -> None:
    """种子：初始超级管理员账号（PRD BR-06）
    - 账号 admin；密码优先读环境变量 ADMIN_INITIAL_PASSWORD，否则随机生成并打印
    - must_change_pwd=TRUE：首次登录强制修改密码
    """
    if db.query(SysUser).filter(SysUser.username == "admin").first():
        print("[SKIP] admin 用户已存在")
        return

    # 密码来源：环境变量 > 自动生成随机强密码（不硬编码，安全要求）
    password = os.getenv("ADMIN_INITIAL_PASSWORD")
    if not password:
        password = secrets.token_urlsafe(12)  # 16 字节随机字符，足够强度
        print(f"[INFO] 已生成初始随机密码（请妥善保存，首次登录后将强制修改）: {password}")

    super_admin = db.query(Role).filter(Role.role_name == "super_admin").first()
    dept = db.query(Department).filter(Department.dept_name == "总部").first()
    user = SysUser(
        username="admin",
        password_hash=hash_password(password),
        name="超级管理员",
        role_id=super_admin.id if super_admin else None,
        dept_id=dept.id if dept else None,
        must_change_pwd=True,  # 首次登录强制改密（BR-06）
    )
    db.add(user)


def seed_news_categories(db: Session) -> None:
    """种子：内置两个新闻栏目（企业新闻/行业资讯，PRD BR-26）"""
    existing = {c.name for c in db.query(NewsCategory).all()}
    for cat in NEWS_CATEGORIES:
        if cat["name"] not in existing:
            db.add(NewsCategory(name=cat["name"], sort_order=cat["sort_order"]))


def seed_store(db: Session) -> None:
    """种子：唯一门店「上海旗舰店」（PRD BR-43；单店不开放新增/删除）"""
    if db.query(Store).first():
        print("[SKIP] store 已存在")
        return
    db.add(Store(**STORE))


def seed_sys_config(db: Session) -> None:
    """种子：系统配置键值（联系信息/品牌标语/首页亮点，PRD BR-42/BR-51）"""
    existing = {c.config_key for c in db.query(SysConfig).all()}
    for key, value in SYS_CONFIG.items():
        if key not in existing:
            db.add(SysConfig(config_key=key, config_value=value))


def seed_page_content(db: Session) -> None:
    """种子：单页内容空模板（关于STK/品牌介绍/售后政策，PRD BR-39）"""
    existing = {p.content_type for p in db.query(PageContent).all()}
    for item in PAGE_CONTENTS:
        if item["content_type"] not in existing:
            db.add(PageContent(**item))


# ============================================================
# 三、主流程
# ============================================================

def main() -> None:
    """种子入口：按依赖顺序执行全部种子函数并统一提交"""
    db = SessionLocal()
    try:
        # 注意顺序：角色 → 部门 → 权限 → 角色权限 → 超管（依赖角色/部门/权限）→ 内容数据
        seed_roles(db)
        seed_departments(db)
        seed_permissions(db)
        seed_role_permissions(db)
        seed_admin(db)
        seed_news_categories(db)
        seed_store(db)
        seed_sys_config(db)
        seed_page_content(db)
        db.commit()
        print("✅ 种子数据注入完成")
    except Exception as exc:  # 任一步失败整体回滚，保持数据一致性
        db.rollback()
        print(f"❌ 种子注入失败，已回滚: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
