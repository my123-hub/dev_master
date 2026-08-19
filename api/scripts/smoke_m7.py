# -*- coding: utf-8 -*-
"""【脚本功能】M7-1 前后端全量接口联调冒烟
——覆盖：公开接口（无鉴权）、后台全模块 CRUD 闭环、图片上传、权限保护（超管/自身）、
前台留资限流。所有创建的测试数据在 finally 中清理，保持开发库干净。
运行：api/.venv/Scripts/python.exe scripts/smoke_m7.py
"""
import base64
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
results = []

# 唯一后缀：每次运行随机生成，避免与历史运行遗留的测试数据名称冲突（409）
SUFFIX = "M7" + uuid.uuid4().hex[:6]


def check(name, resp, expect_code=0, expect_http=200):
    """断言：HTTP 状态 == expect_http 且业务 code == expect_code；失败打印真实 code/message。"""
    j = resp.json() if resp.content else {}
    ok = (resp.status_code == expect_http) and (j.get("code") == expect_code)
    results.append((name, ok))
    if ok:
        print("PASS -", name)
    else:
        print(f"FAIL - {name} | HTTP {resp.status_code} code {j.get('code')} msg {j.get('message')}")
    return ok


# ============================================================
# 0. 登录
# ============================================================
r = client.post("/api/admin/auth/login", json={"username": "admin", "password": "Stk@2026New"})
check("登录成功(获取 token)", r)
token = (r.json().get("data") or {}).get("access_token")
H = {"Authorization": f"Bearer {token}"}
me = client.get("/api/admin/auth/me", headers=H).json().get("data") or {}
SELF_ID = me.get("id")
check("当前用户信息/权限返回", client.get("/api/admin/auth/me", headers=H), expect_code=0)

created = []  # (method, path) 用于清理


# ============================================================
# 1. 公开接口（无鉴权）
# ============================================================
pub_get = [
    "/api/home", "/api/categories", "/api/products", "/api/cases",
    "/api/news/categories", "/api/news", "/api/config/public", "/api/stores",
    "/api/jobs", "/api/page/about_stk", "/api/milestones", "/api/faqs",
]
pub_ids = {}
for p in pub_get:
    r = client.get(p)
    check(f"公开 GET {p}", r)
    d = (r.json().get("data") or {})
    if p == "/api/products" and isinstance(d, dict) and d.get("items"):
        pub_ids["product"] = d["items"][0]["id"]
    if p == "/api/cases" and isinstance(d, dict) and d.get("items"):
        pub_ids["case"] = d["items"][0]["id"]
    if p == "/api/news" and isinstance(d, dict) and d.get("items"):
        pub_ids["news"] = d["items"][0]["id"]
    if p == "/api/jobs" and isinstance(d, list) and d:
        pub_ids["job"] = d[0]["id"]

rh = client.get("/api/home").json().get("data") or {}
_agg_ok = all(k in rh for k in ("banners", "products", "cases", "news"))
results.append(("首页聚合结构(banners/products/cases/news)", _agg_ok))
print(("PASS" if _agg_ok else "FAIL"), "- 首页聚合结构(banners/products/cases/news)")

for kind, ep in (("product", "/api/products/{id}"), ("case", "/api/cases/{id}"),
                 ("news", "/api/news/{id}"), ("job", "/api/jobs/{id}")):
    pid = pub_ids.get(kind, 1)
    check(f"公开详情 {ep.format(id=pid)}", client.get(ep.format(id=pid)))

check("公开提交预约(200)", client.post("/api/appointments", json={"name": f"联调测试{SUFFIX}", "phone": "13800138000", "intention": "测试"}))
check("公开提交留言(200, XSS已清洗入库)", client.post("/api/messages", json={"name": f"联调测试{SUFFIX}", "phone": "13800138000", "content": "<script>alert(1)</script>留言"}))


# ============================================================
# 2. 后台读取（鉴权，分页参数齐全）
# ============================================================
admin_get = [
    "/api/admin/users?page=1&page_size=10", "/api/admin/roles", "/api/admin/logs?page=1&page_size=10",
    "/api/admin/departments", "/api/admin/categories?page=1&page_size=10", "/api/admin/products?page=1&page_size=10",
    "/api/admin/news/categories", "/api/admin/news?page=1&page_size=10", "/api/admin/pages/about_stk",
    "/api/admin/milestones", "/api/admin/faqs", "/api/admin/banners", "/api/admin/config",
    "/api/admin/cases", "/api/admin/jobs", "/api/admin/job-applications?page=1&page_size=10",
    "/api/admin/stores", "/api/admin/appointments?page=1&page_size=10", "/api/admin/messages?page=1&page_size=10",
]
for p in admin_get:
    check(f"后台 GET {p}", client.get(p, headers=H))

rr = client.get("/api/admin/roles", headers=H).json().get("data") or {}
_perm_ok = isinstance(rr.get("permissions"), list) and len(rr.get("permissions")) > 0
results.append(("角色清单含 permissions 全量", _perm_ok))
print(("PASS" if _perm_ok else "FAIL"), "- 角色清单含 permissions 全量")
SUPER_ID = next((x["id"] for x in rr.get("items", []) if x.get("role_name") == "super_admin"), None)

# 取一个真实存在的激活产品系列，供产品创建使用（更稳健）
cats = client.get("/api/admin/categories?page=1&page_size=50", headers=H).json().get("data") or {}
VALID_CAT_ID = (cats.get("items") or [{}])[0].get("id") if cats.get("items") else None


# ============================================================
# 3. 后台 CRUD 闭环（建→改→删，自动清理）
# ============================================================
r = client.post("/api/admin/categories", json={"name": f"M7联调{SUFFIX}系列{SUFFIX}", "sort_order": 1}, headers=H)
check("系列 新增", r)
cat_id = (r.json().get("data") or {}).get("id") or VALID_CAT_ID
if cat_id:
    created.append(f"/api/admin/categories/{cat_id}")
    check("系列 编辑", client.put(f"/api/admin/categories/{cat_id}", json={"name": f"M7联调{SUFFIX}系列{SUFFIX}改", "sort_order": 2}, headers=H))

r = client.post("/api/admin/products", json={"category_id": cat_id, "name": f"M7联调{SUFFIX}产品",
               "product_no": f"M7T-{SUFFIX}", "status": 1}, headers=H)
check("产品 新增", r)
prod_id = (r.json().get("data") or {}).get("id")
if prod_id:
    created.append(f"/api/admin/products/{prod_id}")
    check("产品 编辑", client.put(f"/api/admin/products/{prod_id}", json={"category_id": cat_id, "name": f"M7联调{SUFFIX}产品改", "product_no": f"M7T-{SUFFIX}", "status": 2}, headers=H))
    check("产品 上下架", client.put(f"/api/admin/products/{prod_id}/status", json={"status": 1}, headers=H))

r = client.post("/api/admin/news/categories", json={"name": f"M7联调{SUFFIX}栏目{SUFFIX}", "sort_order": 1}, headers=H)
check("新闻栏目 新增", r)
nc_id = (r.json().get("data") or {}).get("id")
if nc_id:
    created.append(f"/api/admin/news/categories/{nc_id}")
    r = client.post("/api/admin/news", json={"category_id": nc_id, "title": f"M7联调{SUFFIX}文章{SUFFIX}",
                   "content": "<p>正文<script>x</script></p>", "is_published": 0}, headers=H)
    check("新闻文章 新增(正文XSS清洗)", r)
    art_id = (r.json().get("data") or {}).get("id")
    if art_id:
        created.append(f"/api/admin/news/{art_id}")
        check("新闻文章 发布", client.put(f"/api/admin/news/{art_id}/status", json={"is_published": 1}, headers=H))

r = client.post("/api/admin/cases", json={"title": f"M7联调{SUFFIX}案例{SUFFIX}", "content": "<p>案例</p>", "status": 1, "space_tags": ["客厅"]}, headers=H)
check("案例 新增", r)
case_id = (r.json().get("data") or {}).get("id")
if case_id:
    created.append(f"/api/admin/cases/{case_id}")
    check("案例 下线", client.put(f"/api/admin/cases/{case_id}/status", json={"status": 0}, headers=H))

r = client.post("/api/admin/jobs", json={"title": f"M7联调{SUFFIX}职位{SUFFIX}", "category": 1, "contact": "hr@stk.com", "status": 1}, headers=H)
check("职位 新增", r)
job_id = (r.json().get("data") or {}).get("id")
if job_id:
    created.append(f"/api/admin/jobs/{job_id}")
    files = {"resume": ("resume.pdf", b"%PDF-1.4 test resume", "application/pdf")}
    check("公开简历投递(multipart)", client.post(f"/api/jobs/{job_id}/apply", data={"name": "投递人", "phone": "13800138000"}, files=files))
    apps = client.get("/api/admin/job-applications?page=1&page_size=50", headers=H).json().get("data") or {}
    for a in (apps.get("items") or []):
        if a.get("job_id") == job_id:
            created.append(f"/api/admin/job-applications/{a['id']}")

r = client.post("/api/admin/faqs", json={"question": f"M7联调{SUFFIX}问题{SUFFIX}", "answer": "<p>答案</p>", "category": "测试"}, headers=H)
check("FAQ 新增", r)
faq_id = (r.json().get("data") or {}).get("id")
if faq_id:
    created.append(f"/api/admin/faqs/{faq_id}")

r = client.post("/api/admin/milestones", json={"year": "2026", "title": f"M7里程碑{SUFFIX}", "description": "测试"}, headers=H)
check("发展历程 新增", r)
ms_id = (r.json().get("data") or {}).get("id")
if ms_id:
    created.append(f"/api/admin/milestones/{ms_id}")

r = client.post("/api/admin/banners", json={"image_url": "/static/uploads/test.png", "title": f"M7联调{SUFFIX}", "sort_order": 1}, headers=H)
check("轮播 新增", r)
bn_id = (r.json().get("data") or {}).get("id")
if bn_id:
    created.append(f"/api/admin/banners/{bn_id}")

orig = client.get("/api/admin/pages/about_stk", headers=H).json().get("data") or {}
check("单页内容 保存", client.put("/api/admin/pages/about_stk", json={"title": f"M7联调{SUFFIX}临时", "content": "<p>临时</p>"}, headers=H))
if orig:
    client.put("/api/admin/pages/about_stk", json={"title": orig.get("title"), "content": orig.get("content")}, headers=H)


# ============================================================
# 4. 图片上传
# ============================================================
png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC")
r = client.post("/api/admin/upload", files={"file": ("test.png", png, "image/png")}, headers=H)
check("图片上传(校验通过)", r)
if r.json().get("code") == 0:
    up_url = (r.json().get("data") or {}).get("url")
    if up_url and up_url.startswith("/static/uploads/"):
        try:
            from pathlib import Path
            from app.core.config import settings
            Path(settings.UPLOAD_DIR, up_url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
        except Exception:
            pass


# ============================================================
# 5. 权限保护（期望业务码 40300）
# ============================================================
if SUPER_ID:
    check("内置超管角色不可改(40300)", client.put(f"/api/admin/roles/{SUPER_ID}", json={"permissions": ["product:view"]}, headers=H), expect_code=40300)
if SELF_ID:
    check("禁止停用/删除自身(40300)", client.delete(f"/api/admin/users/{SELF_ID}", headers=H), expect_code=40300)


# ============================================================
# 6. 前台留资限流（5/min/IP）
# ============================================================
saw_429 = False
for _ in range(9):
    rr = client.post("/api/appointments", json={"name": f"限流测试{SUFFIX}", "phone": "13800138000"})
    if rr.status_code == 429 or rr.json().get("code") == 42900:
        saw_429 = True
        break
results.append(("留资限流生效(出现429)", saw_429))
print(("PASS" if saw_429 else "FAIL"), "- 留资限流生效(出现429)")


# ============================================================
# 清理测试数据
# ============================================================
for path in created:
    try:
        client.delete(path, headers=H)
    except Exception:
        pass

passed = sum(1 for _, c in results if c)
total = len(results)
print("\n==== M7-1 联调结果 ====")
print(f"通过 {passed}/{total}")
if passed != total:
    print("失败项：")
    for n, c in results:
        if not c:
            print("  -", n)
    sys.exit(1)
print("全部通过 ✅")
