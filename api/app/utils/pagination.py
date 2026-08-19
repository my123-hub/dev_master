# -*- coding: utf-8 -*-
"""
【模块功能】通用分页工具
——统一分页参数解析与 PageData 构造，避免各接口重复实现（开发技术文档 §1.3.1）。
设计要点：
- page/page_size 默认 1/10，page_size 上限 100（防止恶意超大分页拖垮数据库）；
- pages 总页数向上取整（整除时恰为整数页，其余 +1）。
"""
from fastapi import Query
from sqlalchemy import Select, func, select

from app.core.response import PageData


def pagination_params(
    page: int = Query(1, ge=1, description="页码（从 1 开始）"),
    page_size: int = Query(10, ge=1, le=100, description="每页条数（1~100）"),
) -> tuple[int, int]:
    """【依赖】分页参数解析：返回 (page, page_size) 供查询函数使用"""
    return page, page_size


def paginate(stmt: Select, page: int, page_size: int, db) -> PageData:
    """【函数】执行分页查询：
    - 先 count 总数（total 供前端渲染分页器），再取当前页数据；
    - 返回 PageData 统一结构。
    """
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    # 总页数：向上取整，无数据时至少 1 页
    pages = (total + page_size - 1) // page_size if total else 1
    return PageData(items=list(rows), total=total, page=page, page_size=page_size, pages=pages)
