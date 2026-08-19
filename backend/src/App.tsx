// 路由定义：登录页独立；后台业务页统一挂在 AdminLayout 下
// 路由守卫：未登录访问受保护路由 → 重定向登录页
import { Navigate, Route, Routes } from 'react-router-dom'
import { isLoggedIn } from '@/store/auth'
import AdminLayout from '@/layouts/AdminLayout'
import Login from '@/pages/Login'
import ChangePassword from '@/pages/ChangePassword'
import Dashboard from '@/pages/Dashboard'
import CategoryList from '@/pages/products/CategoryList'
import ProductList from '@/pages/products/ProductList'
import CaseList from '@/pages/cases/CaseList'
import JobList from '@/pages/recruit/JobList'
import NewsList from '@/pages/news/NewsList'
import PageList from '@/pages/content/PageList'
import MilestoneList from '@/pages/content/MilestoneList'
import FaqList from '@/pages/content/FaqList'
import StoreEdit from '@/pages/store/StoreEdit'
import LeadList from '@/pages/lead/LeadList'
import HomeConfig from '@/pages/home/HomeConfig'
import UserList from '@/pages/system/UserList'
import RoleList from '@/pages/system/RoleList'
import LogList from '@/pages/system/LogList'

/** 路由守卫：未登录跳转 /login */
function RequireAuth({ children }: { children: JSX.Element }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* 登录页（无布局） */}
      <Route path="/login" element={<Login />} />
      {/* 强制改密页：首次登录拦截（BR-06） */}
      <Route path="/password" element={<ChangePassword />} />

      {/* 后台布局（需登录） */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        {/* 产品管理 */}
        <Route path="products/categories" element={<CategoryList />} />
        <Route path="products" element={<ProductList />} />
        {/* 案例管理 */}
        <Route path="cases" element={<CaseList />} />
        {/* 新闻管理 */}
        <Route path="news" element={<NewsList />} />
        {/* 招聘管理 */}
        <Route path="recruit" element={<JobList />} />
        {/* 内容管理 */}
        <Route path="content/pages" element={<PageList />} />
        <Route path="content/milestones" element={<MilestoneList />} />
        <Route path="content/faqs" element={<FaqList />} />
        {/* 门店管理 */}
        <Route path="store" element={<StoreEdit />} />
        {/* 留资管理 */}
        <Route path="leads" element={<LeadList />} />
        {/* 首页配置 */}
        <Route path="home" element={<HomeConfig />} />
        {/* 系统管理（M6） */}
        <Route path="system/users" element={<UserList />} />
        <Route path="system/roles" element={<RoleList />} />
        <Route path="system/logs" element={<LogList />} />
      </Route>

      {/* 兜底：未知路径回首页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
