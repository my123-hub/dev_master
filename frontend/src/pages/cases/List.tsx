// 新案例列表页（FR-27~29）：空间标签筛选 / 分页 / 案例卡片
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchCases, type CaseListItem } from '@/lib/api'
import LazyImage from '@/components/LazyImage'
import { PageHeader, GridSkeleton, EmptyState } from '@/components/Skeleton'

// 空间标签候选（与后台 SPACE_TAGS 一致）
const SPACE_TAGS = ['客厅', '卧室', '餐厅', '书房', '厨房', '卫浴', '全屋']
const PAGE_SIZE = 9

export default function CaseList() {
  const [params, setParams] = useSearchParams()
  const [cases, setCases] = useState<CaseListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const spaceTag = params.get('tag') || ''

  useEffect(() => {
    setLoading(true)
    fetchCases({ space_tag: spaceTag || undefined, page, page_size: PAGE_SIZE })
      .then((res) => {
        setCases(res.items)
        setTotal(res.total)
      })
      .catch(() => {
        setCases([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceTag, page])

  const updateTag = (tag: string) => {
    const next = new URLSearchParams(params)
    if (tag) next.set('tag', tag)
    else next.delete('tag')
    setParams(next, { replace: true })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader tag="PORTFOLIO" title="新案例" subtitle="真实项目 · 空间灵感，探索家的多种可能" />

      <div className="container-site py-12">
        {/* 空间标签筛选（FR-29） */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            className={`px-5 py-2 rounded-full text-sm transition-colors ${
              !spaceTag ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
            }`}
            onClick={() => updateTag('')}
          >
            全部
          </button>
          {SPACE_TAGS.map((tag) => (
            <button
              key={tag}
              className={`px-5 py-2 rounded-full text-sm transition-colors ${
                spaceTag === tag ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
              }`}
              onClick={() => updateTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {loading ? (
          <GridSkeleton count={6} />
        ) : cases.length === 0 ? (
          <EmptyState text={spaceTag ? `暂无「${spaceTag}」空间案例` : '案例整理中，敬请期待'} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cases.map((c) => (
                <Link key={c.id} to={`/cases/${c.id}`} className="card group">
                  <LazyImage src={c.cover_url} alt={c.title} className="aspect-[4/3] group-hover:scale-105 transition-transform duration-500" />
                  <div className="p-5">
                    <div className="font-serif text-jade-700 font-medium text-lg">{c.title}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-warmgray-500">
                      {c.city && <span>{c.city}</span>}
                      {c.area && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-warmgray-300" />
                          <span>{c.area}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.space_tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[11px] text-jade-700 border border-jade-100 rounded-full px-2 py-0.5 bg-jade-50">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-12">
                <button
                  className="px-4 py-2 rounded-full text-sm border border-warmgray-100 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </button>
                <span className="px-4 py-2 text-sm text-warmgray-500">
                  {page} / {totalPages}（共 {total} 个案例）
                </span>
                <button
                  className="px-4 py-2 rounded-full text-sm border border-warmgray-100 disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
