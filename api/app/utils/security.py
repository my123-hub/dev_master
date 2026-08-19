# -*- coding: utf-8 -*-
"""【模块功能】安全工具：富文本 XSS 清洗（bleach 白名单）。
依据开发技术文档 §4.5 / PRD NFR-08：富文本（新闻正文、案例介绍、单页、FAQ、职位职责、
前台留言等）入库前必须清洗，剔除 <script>、on* 事件、javascript: 等 XSS 向量。
前端通过 dangerouslySetInnerHTML 直接渲染这些字段，服务端清洗是不可绕过的防线。
"""
import bleach

# 允许的标签白名单（与 UI-UX / 技术文档富文本规范一致）
_ALLOWED_TAGS = [
    "p", "br", "b", "i", "em", "strong",
    "ul", "ol", "li", "a", "img", "blockquote", "h2", "h3", "span",
]
# 允许的属性：a 仅 href；img 仅 src/alt；其余标签不带属性（避免 style/on* 注入）
_ALLOWED_ATTRS = {
    "a": ["href"],
    "img": ["src", "alt"],
}
# 允许的链接协议：含 relative 以保留 /uploads/... 相对路径图片；显式排除 javascript:
_ALLOWED_PROTOCOLS = ["http", "https", "mailto", "relative"]


def clean_html(value: str | None) -> str | None:
    """【函数说明】清洗富文本 HTML：
    - value 为 None 直接返回 None（与可选字段语义一致）；
    - 仅保留白名单标签与属性，剔除 <script> / on* 事件 / javascript: 等 XSS 向量；
    - strip=True：非白名单标签被移除但保留其文本（避免内容丢失）；
    - bleach 自动剥离 javascript: 等危险协议；relative 协议保留站内图片路径。
    对已是安全内容的输入幂等（再次清洗结果不变）。
    """
    if value is None:
        return None
    return bleach.clean(
        value,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRS,
        protocols=_ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
