// Footer：前台页脚（FR-03 动态版权 + 门店信息 + 品牌导航）
// - 数据来自 GET /api/config/public（动态版权）与 /api/stores（门店信息）
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPublicConfig, fetchStore, type PublicConfig, type StoreInfo } from '@/lib/api'

export default function Footer() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)

  useEffect(() => {
    // 页脚数据：公共配置 + 门店信息（并行加载，失败静默降级不阻塞页面）
    fetchPublicConfig().then(setConfig).catch(() => {})
    fetchStore().then(setStore).catch(() => {})
  }, [])

  return (
    <footer className="bg-jade-900 text-warmgray-100">
      <div className="container-site py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* 品牌区 */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-bold text-white">STK</span>
            <span className="text-gold-500 text-xs tracking-brand">本然家居</span>
          </div>
          <p className="mt-4 text-sm text-warmgray-300 leading-6 max-w-xs">
            原创设计 · 自然材质 · 匠心工艺
            <br />
            让家回归本然之美。
          </p>
        </div>

        {/* 门店信息（FR-53 单店展示） */}
        <div>
          <h3 className="text-gold-500 text-sm tracking-widest mb-4">门店信息</h3>
          {store ? (
            <ul className="space-y-2 text-sm text-warmgray-300">
              <li className="font-medium text-white">{store.name}</li>
              <li>{store.city} · {store.address}</li>
              <li>
                电话：
                <a href={`tel:${store.phone}`} className="hover:text-gold-400 transition-colors">
                  {store.phone}
                </a>
              </li>
              {store.business_hours && <li>营业时间：{store.business_hours}</li>}
            </ul>
          ) : (
            <p className="text-sm text-warmgray-500">门店信息加载中…</p>
          )}
        </div>

        {/* 快捷导航 */}
        <div>
          <h3 className="text-gold-500 text-sm tracking-widest mb-4">快捷导航</h3>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {[
              { to: '/products', label: '产品中心' },
              { to: '/cases', label: '新案例' },
              { to: '/news', label: '新闻资讯' },
              { to: '/jobs', label: '加入我们' },
              { to: '/about', label: '关于 STK' },
              { to: '/contact', label: '联系我们' },
            ].map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-warmgray-300 hover:text-gold-400 transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 版权栏：动态版权（FR-03） */}
      <div className="border-t border-white/10">
        <div className="container-site py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-warmgray-500">
          <span>{config?.footer?.copyright || '© STK 本然家居'}</span>
          <span>沪ICP备 00000000 号（示例）</span>
        </div>
      </div>
    </footer>
  )
}
