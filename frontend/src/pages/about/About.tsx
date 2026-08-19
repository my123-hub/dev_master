// 关于我们页（FR-39~41）：关于 STK（富文本 about_stk）/ 品牌介绍（富文本 brand_intro）/ 发展历程（时间轴 milestones）
import { useEffect, useState } from 'react'
import { fetchMilestones, fetchPage, type MilestoneItem, type PageContent } from '@/lib/api'
import RichText from '@/components/RichText'
import { PageHeader, SkeletonBar, EmptyState } from '@/components/Skeleton'

// 三个内容 Tab（FR-39 关于STK / FR-41 品牌介绍 / FR-40 发展历程）
const TABS = [
  { key: 'about', label: '关于 STK' },
  { key: 'brand', label: '品牌介绍' },
  { key: 'history', label: '发展历程' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function About() {
  const [tab, setTab] = useState<TabKey>('about')
  const [page, setPage] = useState<PageContent | null>(null)
  const [milestones, setMilestones] = useState<MilestoneItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 按 Tab 加载内容（about/brand 拉富文本；history 拉时间轴）
  useEffect(() => {
    setLoading(true)
    setError(false)
    if (tab === 'history') {
      fetchMilestones()
        .then(setMilestones)
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    } else {
      fetchPage(tab === 'about' ? 'about_stk' : 'brand_intro')
        .then(setPage)
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }
  }, [tab])

  return (
    <div>
      <PageHeader tag="ABOUT" title="关于我们" subtitle="以自然材质与匠心工艺，创造贴合生活本质的空间" />

      <div className="container-site py-12 max-w-4xl">
        {/* Tab 切换（FR-39~41） */}
        <div className="flex justify-center gap-2 mb-12">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`px-6 py-2 rounded-full text-sm transition-colors ${
                tab === t.key ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            <SkeletonBar className="h-6 w-1/3 mx-auto" />
            <SkeletonBar className="h-4 w-full" />
            <SkeletonBar className="h-4 w-5/6" />
            <SkeletonBar className="h-4 w-4/5" />
          </div>
        ) : error ? (
          <EmptyState text="内容加载失败" />
        ) : tab === 'history' ? (
          /* 发展历程时间轴（FR-40，时间倒序） */
          milestones.length === 0 ? (
            <EmptyState text="发展历程整理中" />
          ) : (
            <div className="relative pl-10">
              {/* 时间轴线（墨玉绿） */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-jade-200" />
              <div className="space-y-8">
                {milestones.map((m, i) => (
                  <div key={i} className="relative">
                    {/* 时间轴节点（香槟金圆点） */}
                    <div className="absolute -left-10 top-1.5 w-4 h-4 rounded-full bg-gold-500 border-2 border-white shadow" />
                    <div className="font-serif text-jade-700 font-semibold text-lg">{m.year}</div>
                    {m.title && <div className="mt-1 text-warmgray-900 font-medium">{m.title}</div>}
                    {m.description && <p className="mt-1 text-sm text-warmgray-500 leading-6">{m.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* 富文本正文（about_stk / brand_intro） */
          <div>
            {page?.cover_url && (
              <img src={page.cover_url} alt={page.title || ''} className="w-full aspect-[21/9] object-cover rounded-card shadow-card mb-8" />
            )}
            {page?.title && <h1 className="text-2xl font-semibold text-center mb-8">{page.title}</h1>}
            <RichText html={page?.content} />
          </div>
        )}
      </div>
    </div>
  )
}
