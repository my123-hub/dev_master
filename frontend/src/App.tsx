// 前台路由：全局布局（Nav + 内容 + Footer）+ 页面路由分包
// 页面：首页 / 产品中心（列表+详情）/ 新案例（列表+详情）/ 新闻（列表+详情）
import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { NotFoundPage } from '@/components/Skeleton'
import Home from '@/pages/Home'
import ProductList from '@/pages/products/List'
import ProductDetail from '@/pages/products/Detail'
import CaseList from '@/pages/cases/List'
import CaseDetail from '@/pages/cases/Detail'
import NewsList from '@/pages/news/List'
import NewsDetail from '@/pages/news/Detail'

/** 页面切换时回到顶部（SPA 路由体验） */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Nav />
      {/* 主内容区：flex-1 撑开，页脚贴底 */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* 产品中心 */}
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          {/* 新案例 */}
          <Route path="/cases" element={<CaseList />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          {/* 新闻 */}
          <Route path="/news" element={<NewsList />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          {/* 404 兜底 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
