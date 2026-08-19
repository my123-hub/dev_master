# -*- coding: utf-8 -*-
"""
【模块功能】ORM 模型统一出口
——导入全部 21 张表模型，确保 Alembic autogenerate 能扫描完整 metadata。
业务代码统一 `from app.models import Product, ...` 导入，无需关心物理文件位置。
"""

# 系统管理域（6 张）：sys_user / department / sys_role / sys_permission / sys_role_permission / sys_operation_log
from app.models.system import Department, OperationLog, Permission, Role, RolePermission, SysUser

# 产品管理域（2 张）：product_category / product
from app.models.product import Product, ProductCategory

# 案例/新闻/招聘域（5 张）：case_info / news_category / news_article / job / job_application
from app.models.business import CaseInfo, Job, JobApplication, NewsArticle, NewsCategory

# 内容/门店/配置域（6 张）：page_content / milestone_item / faq / store / banner / sys_config
from app.models.content import Banner, Faq, MilestoneItem, PageContent, Store, SysConfig

# 留资域（2 张）：appointment / message
from app.models.lead import Appointment, Message

# 汇总列表：便于种子脚本/测试脚本批量遍历
__all__ = [
    "SysUser", "Department", "Role", "Permission", "RolePermission", "OperationLog",
    "ProductCategory", "Product",
    "CaseInfo", "NewsCategory", "NewsArticle", "Job", "JobApplication",
    "PageContent", "MilestoneItem", "Faq", "Store", "Banner", "SysConfig",
    "Appointment", "Message",
]

# 全部模型类元组（21 张）：供 create_all / 测试统计使用
ALL_MODELS = (
    SysUser, Department, Role, Permission, RolePermission, OperationLog,
    ProductCategory, Product,
    CaseInfo, NewsCategory, NewsArticle, Job, JobApplication,
    PageContent, MilestoneItem, Faq, Store, Banner, SysConfig,
    Appointment, Message,
)
