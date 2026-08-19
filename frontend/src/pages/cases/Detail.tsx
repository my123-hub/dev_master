// 案例详情页（FR-27~29）：项目信息（城市/面积/完工时间）+ 富文本介绍 + 实景图集
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCaseDetail, type CaseDetail as CaseDetailType } from '@/lib/api'
import LazyImage from '@/components/LazyImage'
import RichText from '@/components/RichText'
import { DetailSkeleton, EmptyState } from '@/components/Skeleton'

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<CaseDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    fetchCaseDetail(Number(id))
      .then(setData)
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
        <EmptyState text="案例不存在" />
      </div>
    )
  }

  // 项目信息条目（FR-28 项目信息）
  const meta = [
    { label: '城市', value: data.city },
    { label: '面积', value: data.area },
    { label: '完工时间', value: data.finished_at },
  ].filter((m) => m.value)

  return (
    <div className="pt-24">
      <div className="container-site py-12 max-w-5xl">
        {/* 面包屑 */}
        <div className="text-sm text-warmgray-500 mb-8">
          <Link to="/" className="hover:text-jade-700">首页</Link>
          <span className="mx-2">/</span>
          <Link to="/cases" className="hover:text-jade-700">新案例</Link>
          <span className="mx-2">/</span>
          <span className="text-jade-700">{data.title}</span>
        </div>

        {/* 标题 + 标签 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold">{data.title}</h1>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {data.space_tags.map((t) => (
              <span key={t} className="text-xs text-jade-700 border border-jade-100 rounded-full px-3 py-1 bg-jade-50">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* 项目信息条 */}
        {meta.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-12 bg-white rounded-card shadow-card py-6">
            {meta.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-xs text-warmgray-500 tracking-widest">{m.label}</div>
                <div className="mt-1 font-serif text-jade-700 font-medium">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* 封面图 */}
        {data.cover_url && <LazyImage src={data.cover_url} alt={data.title} className="aspect-[16/9] rounded-card shadow-card mb-10" />}

        {/* 富文本项目介绍 */}
        {data.content && (
          <div className="max-w-3xl mx-auto mb-12">
            <RichText html={data.content} />
          </div>
        )}

        {/* 实景图集（FR-28 图集瀑布） */}
        {data.images && data.images.length > 0 && (
          <div>
            <div className="section-title">
              <span className="brand-tag">GALLERY</span>
              <h2>实景图集</h2>
              <div className="divider" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {data.images.map((img, i) => (
                <LazyImage key={i} src={img} alt={`${data.title} 实景 ${i + 1}`} className="aspect-[4/3] rounded-card" />
              ))}
            </div>
          </div>
        )}

        {/* 预约 CTA */}
        <div className="mt-16 text-center">
          <Link to="/contact" className="btn-primary">预约参观同款设计</Link>
        </div>
      </div>
    </div>
  )
}
