// 服务支持页（FR-51~52）：售后政策（富文本 after_sales_policy）+ FAQ 手风琴（faqs）
import { useEffect, useState } from 'react'
import { fetchFaqs, fetchPage, type FaqItem, type PageContent } from '@/lib/api'
import RichText from '@/components/RichText'
import { PageHeader, SkeletonBar, EmptyState } from '@/components/Skeleton'

const TABS = [
  { key: 'policy', label: '售后服务' },
  { key: 'faq', label: '常见问题' },
] as const
type TabKey = (typeof TABS)[number]['key']

/** FAQ 手风琴（FR-52）：点击展开/收起 */
function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  if (items.length === 0) return <EmptyState text="暂无常见问题" />
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <div key={f.id} className="card !shadow-none border border-warmgray-100">
          <button
            className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span className="font-medium text-warmgray-900">{f.question}</span>
            <span className={`text-jade-700 transition-transform duration-300 ${openIndex === i ? 'rotate-45' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </button>
          {/* 展开答案（富文本） */}
          {openIndex === i && (
            <div className="px-6 pb-5">
              <div className="border-t border-warmgray-100 pt-4">
                <RichText html={f.answer} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Support() {
  const [tab, setTab] = useState<TabKey>('policy')
  const [page, setPage] = useState<PageContent | null>(null)
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    if (tab === 'faq') {
      fetchFaqs()
        .then(setFaqs)
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    } else {
      fetchPage('after_sales_policy')
        .then(setPage)
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }
  }, [tab])

  return (
    <div>
      <PageHeader tag="SUPPORT" title="服务支持" subtitle="完善的售后服务与常见问题解答，让您安心无忧" />

      <div className="container-site py-12 max-w-4xl">
        {/* Tab 切换 */}
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
          </div>
        ) : error ? (
          <EmptyState text="内容加载失败" />
        ) : tab === 'faq' ? (
          <FaqAccordion items={faqs} />
        ) : (
          <div>
            {page?.title && <h1 className="text-2xl font-semibold text-center mb-8">{page.title}</h1>}
            <RichText html={page?.content} />
          </div>
        )}
      </div>
    </div>
  )
}
