# -*- coding: utf-8 -*-
"""
【模块功能】操作日志写入工具
——关键操作（登录/增删改/状态流转/导出）统一记录到 sys_operation_log（PRD BR-63），日志只读。
"""
from app.models import OperationLog


def add_operation_log(
    db,
    *,
    user_id: int | None,
    module: str,
    action: str,
    detail: str,
    ip: str | None = None,
) -> None:
    """【函数说明】写入一条操作日志：
    - module：模块名（product/case/news/recruit/content/store/home/lead/system）
    - action：动作（create/update/delete/status/export/login）
    - detail：操作详情，示例「下架产品：胡桃木餐桌」（BR-63）
    """
    db.add(
        OperationLog(
            user_id=user_id,
            module=module,
            action=action,
            detail=detail,
            ip=ip,
        )
    )
