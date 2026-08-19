// 产品详情页（FR-22~26）：图集切换 / 富文本描述 / 规格参数表 / 同系列推荐 / 预约 CTA
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProductDetail, type ProductDetail as ProductDetailType } from '@/lib/api'
import LazyImage from '@/components/LazyImage'
import RichText from '@/components/RichText'
import { DetailSkeleton, EmptyState } from '@/components/Skeleton'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ProductDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // 当前展示图（默认封面，可切换图集）
  const [activeImage, setActiveImage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    fetchProductDetail(Number(id))
      .then((res) => {
        setData(res)
        setActiveImage(res.images?.[0] ?? res.cover_url)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="pt-24">
        <div className="container-site py-12">
          <DetailSkeleton />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="pt-24">
        <EmptyState text="产品不存在或已下架" />
      </div>
    )
  }

  // 图集：封面 + images 去重
  const gallery = Array.from(new Set([data.cover_url, ...(data.images ?? [])].filter(Boolean) as string[]))

  return (
    <div className="pt-24">
      <div className="container-site py-12">
        {/* 面包屑 */}
        <div className="text-sm text-warmgray-500 mb-8">
          <Link to="/" className="hover:text-jade-700">首页</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:text-jade-700">产品中心</Link>
          <span className="mx-2">/</span>
          <span className="text-jade-700">{data.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* 左：图集 */}
          <div>
            <LazyImage src={activeImage} alt={data.name} className="aspect-[4/3] rounded-card shadow-card" />
            {gallery.length > 1 && (
              <div className="flex gap-3 mt-4">
                {gallery.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(img)}
                    className={`w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      activeImage === img ? 'border-gold-500' : 'border-transparent hover:border-jade-300'
                    }`}
                  >
                    <img src={img} alt={`${data.name} 图 ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 右：信息 */}
          <div>
            <span className="brand-tag">{data.category_name || 'STK'}</span>
            <h1 className="text-3xl font-semibold mt-3">{data.name}</h1>
            <div className="mt-4 text-gold-600 font-serif text-lg">价格面议</div>
            <p className="mt-2 text-sm text-warmgray-500">
              欢迎到店体验，或在线预约获取详细报价。
            </p>

            {/* 规格参数表（BR-15 动态规格） */}
            {data.specs && data.specs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-3">规格参数</h2>
                <table className="w-full text-sm border border-warmgray-100 rounded-lg overflow-hidden">
                  <tbody>
                    {data.specs.map((s, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-jade-50/50'}>
                        <td className="px-4 py-3 text-warmgray-500 w-32">{s.name}</td>
                        <td className="px-4 py-3 text-warmgray-900">{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 操作区 */}
            <div className="mt-8 flex gap-4">
              <Link to="/contact" className="btn-primary">预约到店体验</Link>
              <a href="tel:021-6000-8888" className="btn-outline">电话咨询</a>
            </div>
          </div>
        </div>

        {/* 富文本描述（BR-15 产品介绍） */}
        {data.description && (
          <div className="mt-16">
            <div className="section-title">
              <span className="brand-tag">DETAIL</span>
              <h2>产品介绍</h2>
              <div className="divider" />
            </div>
            <div className="max-w-3xl mx-auto">
              <RichText html={data.description} />
            </div>
          </div>
        )}

        {/* 同系列推荐（BR-26） */}
        {data.same_series && data.same_series.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold mb-6 text-center">同系列推荐</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {data.same_series.map((s) => (
                <Link key={s.id} to={`/products/${s.id}`} className="card group">
                  <LazyImage src={s.cover_url} alt={s.name} className="aspect-[4/3] group-hover:scale-105 transition-transform duration-500" />
                  <div className="p-4">
                    <div className="font-serif text-jade-700 font-medium truncate">{s.name}</div>
                    <div className="mt-1 text-gold-600 text-sm">价格面议</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
