// 首页聚合（FR-08~15）：轮播 / 品牌标语 / 企业亮点 / 精选产品 / 精选案例 / 最新新闻 / 预约 CTA
// 数据源：GET /api/home（单次聚合，§6.2.1）
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchHome, type HomeData } from '@/lib/api'
import LazyImage from '@/components/LazyImage'
import { GridSkeleton, EmptyState } from '@/components/Skeleton'

/** 轮播：自动播放 + 指示点 + 左右切换（墨玉翡翠风） */
function HeroCarousel({ banners, slogan }: { banners: HomeData['banners']; slogan: HomeData['slogan'] }) {
  const [index, setIndex] = useState(0)
  const count = banners.length

  // 自动轮播（无轮播图时不启动）
  useEffect(() => {
    if (count <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 5000)
    return () => clearInterval(timer)
  }, [count])

  // 无轮播图：品牌标语全屏占位（深绿渐变 + 香槟金标语）
  if (count === 0) {
    return (
      <section className="relative h-[78vh] min-h-[520px] flex items-center justify-center bg-jade-700 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #0F3D2E 30%, #1F5A42 100%)' }} />
        <div className="relative text-center text-white px-6">
          <span className="text-gold-500 text-xs tracking-brand uppercase">STK 本然家居</span>
          <h1 className="mt-6 font-serif text-4xl md:text-6xl font-semibold tracking-widest">{slogan.title || '本然之美'}</h1>
          <p className="mt-4 text-gold-300 tracking-[0.3em]">{slogan.subtitle || '回归生活本质'}</p>
          <div className="mt-10 flex justify-center gap-4">
            <Link to="/products" className="btn-primary">探索产品</Link>
            <Link to="/contact" className="btn-outline !border-gold-500 !text-gold-400 hover:!bg-gold-500 hover:!text-white">
              预约到店
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative h-[78vh] min-h-[520px] overflow-hidden bg-jade-800">
      {/* 轮播图（绝对定位堆叠 + 透明度切换） */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        >
          <img src={b.image_url} alt={b.title || ''} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(15,61,46,0.25) 0%, rgba(8,36,27,0.55) 100%)' }} />
          {/* 轮播文案 */}
          <div className="absolute inset-x-0 bottom-16 text-center text-white px-6">
            {b.title && <h1 className="font-serif text-3xl md:text-5xl font-semibold tracking-widest">{b.title}</h1>}
            {b.subtitle && <p className="mt-3 text-gold-300 tracking-[0.25em]">{b.subtitle}</p>}
          </div>
        </div>
      ))}

      {/* 指示点 */}
      {count > 1 && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              aria-label={`切换到第 ${i + 1} 张`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-8 bg-gold-500' : 'w-3 bg-white/50 hover:bg-white'}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchHome().then(setData).catch(() => setError(true))
  }, [])

  // 加载骨架
  if (!data && !error) {
    return (
      <div>
        <div className="h-[78vh] bg-jade-700 animate-pulse" />
        <div className="container-site py-16 space-y-16">
          <GridSkeleton count={3} />
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 1) 轮播 + 标语 */}
      <HeroCarousel banners={data?.banners ?? []} slogan={data?.slogan ?? { title: '', subtitle: '' }} />

      {/* 2) 企业亮点（FR-10，最多 4 组） */}
      {data && data.highlights.length > 0 && (
        <section className="container-site py-16 md:py-20">
          <div className="section-title">
            <span className="brand-tag">WHY STK</span>
            <h2>为生活而设计</h2>
            <div className="divider" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.highlights.map((h, i) => (
              <div key={i} className="text-center px-4 py-8 bg-white rounded-card shadow-card">
                <div className="mx-auto w-12 h-12 rounded-full bg-jade-50 border border-jade-100 flex items-center justify-center mb-4">
                  <span className="font-serif text-jade-700 font-semibold">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="font-serif text-jade-700 text-lg font-semibold">{h.title}</h3>
                <p className="mt-2 text-sm text-warmgray-500 leading-6">{h.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3) 精选产品（FR-12，is_top 最多 8） */}
      {data && data.products.length > 0 && (
        <section className="bg-white py-16 md:py-20">
          <div className="container-site">
            <div className="section-title">
              <span className="brand-tag">CURATED</span>
              <h2>精选产品</h2>
              <div className="divider" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {data.products.map((p) => (
                <Link key={p.id} to={`/products/${p.id}`} className="card group">
                  <LazyImage src={p.cover_url} alt={p.name} className="aspect-[4/3] group-hover:scale-105 transition-transform duration-500" />
                  <div className="p-4">
                    <div className="text-xs text-warmgray-500 mb-1">{p.category_name}</div>
                    <div className="font-serif text-jade-700 font-medium truncate">{p.name}</div>
                    <div className="mt-1 text-gold-600 text-sm">价格面议</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link to="/products" className="btn-outline">查看全部产品</Link>
            </div>
          </div>
        </section>
      )}

      {/* 4) 精选案例（FR-13） */}
      {data && data.cases.length > 0 && (
        <section className="container-site py-16 md:py-20">
          <div className="section-title">
            <span className="brand-tag">PORTFOLIO</span>
            <h2>实景案例</h2>
            <div className="divider" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.cases.map((c) => (
              <Link key={c.id} to={`/cases/${c.id}`} className="card group">
                <LazyImage src={c.cover_url} alt={c.title} className="aspect-[4/3] group-hover:scale-105 transition-transform duration-500" />
                <div className="p-4">
                  <div className="font-serif text-jade-700 font-medium truncate">{c.title}</div>
                  <div className="mt-1.5 flex gap-1.5">
                    {c.space_tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[11px] text-warmgray-500 border border-warmgray-100 rounded-full px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 5) 最新新闻（FR-14） */}
      {data && data.news.length > 0 && (
        <section className="bg-white py-16 md:py-20">
          <div className="container-site">
            <div className="section-title">
              <span className="brand-tag">NEWS</span>
              <h2>最新资讯</h2>
              <div className="divider" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {data.news.map((n) => (
                <Link key={n.id} to={`/news/${n.id}`} className="card p-5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <div className="text-xs text-warmgray-500 mb-2">{n.category_name} · {n.publish_time}</div>
                    <div className="font-serif text-jade-700 font-medium leading-6 line-clamp-2">{n.title}</div>
                  </div>
                  <div className="mt-4 text-gold-600 text-xs tracking-widest">阅读全文 →</div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link to="/news" className="btn-outline">更多资讯</Link>
            </div>
          </div>
        </section>
      )}

      {/* 6) 预约 CTA（FR-15） */}
      <section className="bg-jade-700 py-16 md:py-20">
        <div className="container-site text-center text-white">
          <h2 className="text-3xl md:text-4xl font-semibold">欢迎到店体验</h2>
          <p className="mt-4 text-jade-200 tracking-widest text-sm">预约参观，感受本然之家的温度</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/contact" className="btn-primary !bg-gold-500 !text-jade-900 hover:!bg-gold-400">
              在线预约
            </Link>
            <a href="tel:021-6000-8888" className="btn-outline !border-white !text-white hover:!bg-white hover:!text-jade-700">
              电话咨询
            </a>
          </div>
        </div>
      </section>

      {/* 数据加载失败提示（NFR-16 容错） */}
      {error && <EmptyState text="首页数据加载失败，请刷新重试" />}
    </div>
  )
}
