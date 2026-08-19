// 新闻列表页（FR-30~34）：栏目 Tab + 列表（日期 YYYY.MM.DD）+ 分页
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchNewsCategories, fetchNewsList, type NewsCategoryItem, type NewsListItem } from '@/lib/api'
import LazyImage from '@/components/LazyImage'
import { PageHeader, SkeletonBar, EmptyState } from '@/components/Skeleton'

const PAGE_SIZE = 8

export default function NewsList() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState<NewsCategoryItem[]>([])
  const [news, setNews] = useState<NewsListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const categoryId = params.get('category') ? Number(params.get('category')) : undefined

  // 栏目列表
  useEffect(() => {
    fetchNewsCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  // 新闻列表
  useEffect(() => {
    setLoading(true)
    fetchNewsList({ category_id: categoryId, page, page_size: PAGE_SIZE })
      .then((res) => {
        setNews(res.items)
        setTotal(res.total)
      })
      .catch(() => {
        setNews([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, page])

  const updateCategory = (cid?: number) => {
    const next = new URLSearchParams(params)
    if (cid) next.set('category', String(cid))
    else next.delete('category')
    setParams(next, { replace: true })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader tag="NEWS" title="新闻资讯" subtitle="企业动态 · 行业观察，见证 STK 的每一步" />

      <div className="container-site py-12 max-w-5xl">
        {/* 栏目 Tab（FR-30） */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            className={`px-5 py-2 rounded-full text-sm transition-colors ${
              !categoryId ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
            }`}
            onClick={() => updateCategory()}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`px-5 py-2 rounded-full text-sm transition-colors ${
                categoryId === c.id ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
              }`}
              onClick={() => updateCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-card shadow-card p-5 flex gap-5">
                <SkeletonBar className="w-32 h-24 rounded-lg flex-none" />
                <div className="flex-1 space-y-3 py-1">
                  <SkeletonBar className="h-5 w-3/4" />
                  <SkeletonBar className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <EmptyState text="该栏目暂无新闻" />
        ) : (
          <>
            {/* 新闻列表（左图右文） */}
            <div className="space-y-5">
              {news.map((n) => (
                <Link key={n.id} to={`/news/${n.id}`} className="card p-5 flex gap-5 group hover:!bg-jade-50/40">
                  <div className="w-28 md:w-36 flex-none overflow-hidden rounded-lg">
                    {n.cover_url ? (
                      <LazyImage src={n.cover_url} alt={n.title} className="aspect-[4/3] group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="aspect-[4/3] bg-jade-50 flex items-center justify-center text-warmgray-300 text-xs">STK</div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <div className="text-xs text-gold-600 mb-1.5">{n.publish_time}</div>
                      <div className="font-serif text-jade-700 font-medium text-lg leading-7 group-hover:text-jade-600 line-clamp-2">
                        {n.title}
                      </div>
                      {n.summary && <p className="mt-2 text-sm text-warmgray-500 leading-6 line-clamp-2">{n.summary}</p>}
                    </div>
                    <div className="mt-3 text-jade-600 text-xs tracking-widest">阅读全文 →</div>
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
                  {page} / {totalPages}（共 {total} 篇）
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
