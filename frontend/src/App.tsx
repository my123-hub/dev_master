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
import Jobs from '@/pages/jobs/Jobs'
import About from '@/pages/about/About'
import Contact from '@/pages/contact/Contact'
import Support from '@/pages/support/Support'

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
          {/* 招聘（M5） */}
          <Route path="/jobs" element={<Jobs />} />
          {/* 关于我们（M5：关于 STK / 品牌介绍 / 发展历程） */}
          <Route path="/about" element={<About />} />
          <Route path="/about/brand" element={<About />} />
          <Route path="/about/history" element={<About />} />
          {/* 联系我们（M5：预约 + 留言 + 地图） */}
          <Route path="/contact" element={<Contact />} />
          {/* 服务支持（M5：售后政策 + FAQ） */}
          <Route path="/support" element={<Support />} />
          <Route path="/support/faq" element={<Support />} />
          {/* 404 兜底 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
