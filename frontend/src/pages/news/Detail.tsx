// 新闻详情页（FR-33~34）：标题 / 栏目 / 来源 / 日期（YYYY.MM.DD）/ 富文本正文
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchNewsDetail, type NewsDetail as NewsDetailType } from '@/lib/api'
import RichText from '@/components/RichText'
import { DetailSkeleton, EmptyState } from '@/components/Skeleton'

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<NewsDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    fetchNewsDetail(Number(id))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="pt-24">
        <div className="container-site py-12 max-w-3xl">
          <DetailSkeleton />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="pt-24">
        <EmptyState text="新闻不存在或已下线" />
      </div>
    )
  }

  return (
    <div className="pt-24">
      <div className="container-site py-12 max-w-3xl">
        {/* 面包屑 */}
        <div className="text-sm text-warmgray-500 mb-8">
          <Link to="/" className="hover:text-jade-700">首页</Link>
          <span className="mx-2">/</span>
          <Link to="/news" className="hover:text-jade-700">新闻资讯</Link>
          <span className="mx-2">/</span>
          <span className="text-jade-700">{data.title}</span>
        </div>

        {/* 标题区 */}
        <div className="text-center border-b border-warmgray-100 pb-8 mb-10">
          <div className="text-xs text-gold-600 tracking-widest mb-3">
            {data.category_name} · {data.publish_time}
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold leading-relaxed">{data.title}</h1>
          {data.source && <div className="mt-3 text-xs text-warmgray-500">来源：{data.source}</div>}
        </div>

        {/* 富文本正文 */}
        <RichText html={data.content} />

        {/* 返回列表 */}
        <div className="mt-14 pt-8 border-t border-warmgray-100 flex justify-between">
          <Link to="/news" className="text-jade-600 text-sm hover:text-gold-600 transition-colors">← 返回新闻列表</Link>
          <Link to="/products" className="text-jade-600 text-sm hover:text-gold-600 transition-colors">浏览产品 →</Link>
        </div>
      </div>
    </div>
  )
}
