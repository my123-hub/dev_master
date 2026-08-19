# -*- coding: utf-8 -*-
"""
【模块功能】门店管理请求/响应模型（Pydantic v2）
——门店信息（store）编辑与输出结构。本期仅一家门店（上海旗舰店），不开放新增/删除（BR-43~46）。
依据：数据库设计文档 V1.3 §3.7；开发技术文档 §6.3.9；PRD BR-43~46。
"""
from pydantic import BaseModel, ConfigDict, Field


class StoreUpdate(BaseModel):
    """【模型】门店编辑字段：
    - name/address/phone 必填（前台门店页与联系信息展示，FR-44~46）；
    - business_hours 营业时间可选；longitude/latitude 经纬度本期不填（P2 预留）；
    - sort_order 排序（单店场景恒为 1）。
    """
    name: str = Field(min_length=1, max_length=100, description="门店名称")
    city: str = Field(default="上海", max_length=50, description="城市（本期固定上海）")
    address: str = Field(min_length=1, max_length=255, description="地址")
    phone: str = Field(min_length=1, max_length=50, description="联系电话")
    business_hours: str | None = Field(default=None, max_length=100, description="营业时间")
    longitude: str | None = Field(default=None, max_length=30, description="经度（本期不填）")
    latitude: str | None = Field(default=None, max_length=30, description="纬度（本期不填）")
    sort_order: int = Field(default=0, ge=0, le=9999, description="排序")


class StoreOut(StoreUpdate):
    """【模型】门店输出：附加 id/启用状态"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_activate: int = Field(description="1 启用 / 0 停用")
