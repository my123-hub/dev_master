# -*- coding: utf-8 -*-
"""
【模块功能】前台公开接口请求/响应模型（Pydantic v2）
——留资提交（预约/留言/简历投递）请求体 + 首页聚合输出结构。
依据：开发技术文档 §6.2（前台公开接口）；PRD FR-37/43~50/BR-69。
"""
from pydantic import BaseModel, Field, field_validator

# 中国大陆手机号正则：1 开头、第二位 3-9、共 11 位（开发技术文档 §6.2.17，FR-43）
PHONE_PATTERN = r"^1[3-9]\d{9}$"


class AppointmentCreate(BaseModel):
    """【模型】在线预约提交（§6.2.17，限流 5/min/IP）：
    - name/phone 必填（手机号正则校验）；appointment_date 预约到店时间（ISO 字符串）；
    - intention 意向产品/系列；remark 备注；
    - store_name 由服务端固定为「上海旗舰店」（FR-43，前台不提供门店选择）。
    """
    name: str = Field(min_length=1, max_length=50, description="姓名")
    phone: str = Field(pattern=PHONE_PATTERN, description="手机号（11 位大陆手机号）")
    appointment_date: str | None = Field(default=None, max_length=30, description="预约到店时间")
    intention: str | None = Field(default=None, max_length=200, description="意向产品/系列")
    remark: str | None = Field(default=None, max_length=500, description="备注")

    @field_validator("appointment_date")
    @classmethod
    def _check_date(cls, v: str | None) -> str | None:
        """【校验】预约时间格式宽松校验：需为 'YYYY-MM-DD HH:MM' 或空"""
        if v is None or v.strip() == "":
            return None
        if len(v.strip()) < 10:
            raise ValueError("预约时间格式应为 YYYY-MM-DD HH:MM")
        return v.strip()


class MessageCreate(BaseModel):
    """【模型】在线留言提交（§6.2.18，限流 5/min/IP）：
    - name/phone/content 必填；email 可选（格式校验）。
    """
    name: str = Field(min_length=1, max_length=50, description="姓名")
    phone: str = Field(pattern=PHONE_PATTERN, description="手机号（11 位大陆手机号）")
    email: str | None = Field(default=None, max_length=100, description="邮箱（选填）")
    content: str = Field(min_length=1, max_length=2000, description="留言内容")

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str | None) -> str | None:
        """【校验】邮箱格式校验（选填项，有值才校验）"""
        if v is None or v.strip() == "":
            return None
        if "@" not in v or v.strip().count("@") != 1:
            raise ValueError("邮箱格式不正确")
        return v.strip()


class HomeHighlights(BaseModel):
    """【模型】首页企业亮点项：标题 + 描述（来自 sys_config highlight.title_N / desc_N）"""
    title: str
    desc: str = ""


class HomeSlogan(BaseModel):
    """【模型】首页品牌标语：主标语 + 副标语（brand.slogan / brand.sub_slogan）"""
    title: str = ""
    subtitle: str = ""


class HomeData(BaseModel):
    """【模型】首页聚合响应 data（§6.2.1）：
    轮播 / 亮点 / 标语 / 精选产品（is_top 最多 8）/ 精选案例（发布）/ 最新新闻（已发布倒序）
    """
    banners: list[dict] = []
    highlights: list[HomeHighlights] = []
    slogan: HomeSlogan = HomeSlogan()
    products: list[dict] = []
    cases: list[dict] = []
    news: list[dict] = []


class PublicConfig(BaseModel):
    """【模型】公共配置响应 data（§6.2.16）：
    contact：联系信息（address/phone/email，页脚与联系页展示）；
    footer：页脚（copyright 动态版权，FR-03）。
    """
    contact: dict = {}
    footer: dict = {}
