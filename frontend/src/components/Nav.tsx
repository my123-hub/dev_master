// Nav：前台浮动导航（FR-01~07，UI-UX §3.2）
// - 顶部透明 → 滚动后墨玉绿实底（浮动吸附）
// - 一级菜单下拉（产品/关于我们）+ 右侧预约 CTA
// - 移动端汉堡菜单
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/', label: '首页' },
  { to: '/products', label: '产品中心', dropdown: true },
  { to: '/cases', label: '新案例' },
  { to: '/news', label: '新闻资讯' },
  { to: '/jobs', label: '招聘' },
  { to: '/about', label: '关于我们', dropdown: true },
  { to: '/support', label: '服务支持', dropdown: true },
  { to: '/contact', label: '联系我们' },
]

// 子菜单项（产品中心/关于我们/服务支持 下拉）
const DROPDOWN_ITEMS: Record<string, { to: string; label: string }[]> = {
  '/products': [
    { to: '/products', label: '全部产品' },
    { to: '/products?category=1', label: '按系列浏览' },
  ],
  '/about': [
    { to: '/about', label: '关于 STK' },
    { to: '/about/brand', label: '品牌介绍' },
    { to: '/about/history', label: '发展历程' },
  ],
  '/support': [
    { to: '/support', label: '售后服务' },
    { to: '/support/faq', label: '常见问题' },
  ],
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const location = useLocation()

  // 滚动监听：> 40px 切换实底导航
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 路由变化时关闭移动端菜单与下拉
  useEffect(() => {
    setMobileOpen(false)
    setOpenDropdown(null)
  }, [location.pathname])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-jade-700/95 backdrop-blur shadow-nav' : 'bg-jade-700/40 backdrop-blur-sm'
      }`}
    >
      <div className="container-site flex items-center justify-between h-16">
        {/* Logo：STK 本然家居 */}
        <Link to="/" className="flex items-baseline gap-2 text-white">
          <span className="font-serif text-2xl font-bold tracking-wider">STK</span>
          <span className="text-gold-500 text-xs tracking-brand hidden sm:inline">本然家居</span>
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((item) => (
            <div key={item.to} className="relative group">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `text-sm tracking-widest transition-colors hover:text-gold-400 ${
                    isActive || (item.dropdown && location.pathname.startsWith(item.to.split('?')[0]))
                      ? 'text-gold-400'
                      : 'text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
              {/* 下拉菜单（hover 展开，墨玉翡翠风） */}
              {item.dropdown && (
                <div className="absolute left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="bg-white rounded-card shadow-card-hover py-2 min-w-[140px]">
                    {DROPDOWN_ITEMS[item.to]?.map((sub) => (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        className="block px-5 py-2.5 text-sm text-warmgray-700 hover:text-jade-700 hover:bg-jade-50 transition-colors"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* 右侧 CTA */}
        <div className="flex items-center gap-3">
          <Link
            to="/contact"
            className="hidden sm:inline-flex items-center border border-gold-500 text-gold-400 px-5 py-2 rounded-full text-xs tracking-widest hover:bg-gold-500 hover:text-white transition-colors"
          >
            预约到店
          </Link>
          {/* 汉堡按钮（移动端） */}
          <button
            className="lg:hidden text-white p-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="打开菜单"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* 移动端菜单 */}
      {mobileOpen && (
        <div className="lg:hidden bg-jade-800 border-t border-white/10">
          <div className="container-site py-4 flex flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-3 text-sm tracking-widest rounded-lg transition-colors ${
                    isActive ? 'text-gold-400 bg-white/10' : 'text-white hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
