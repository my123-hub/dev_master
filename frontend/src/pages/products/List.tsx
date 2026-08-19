// 产品中心列表页（FR-16~21）：系列筛选 / 关键词搜索 / 价格面议 / 分页 / 排序 / 空状态
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchCategories, fetchProducts, type CategoryItem, type ProductListItem } from '@/lib/api'
import LazyImage from '@/components/LazyImage'
import { PageHeader, GridSkeleton, EmptyState } from '@/components/Skeleton'

const PAGE_SIZE = 12

export default function ProductList() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // 从 URL 读取筛选状态（系列筛选可分享/刷新保持）
  const categoryId = params.get('category') ? Number(params.get('category')) : undefined
  const sort = (params.get('sort') as 'default' | 'latest') || 'default'
  const keyword = params.get('keyword') || ''

  // 加载系列（首屏一次）
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  // 加载产品列表（筛选条件变化时重置页码）
  useEffect(() => {
    setLoading(true)
    fetchProducts({ category_id: categoryId, keyword: keyword || undefined, sort, page, page_size: PAGE_SIZE })
      .then((res) => {
        setProducts(res.items)
        setTotal(res.total)
      })
      .catch(() => {
        setProducts([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, sort, keyword, page])

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page') // 筛选变化重置页码
    setParams(next, { replace: true })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        tag="PRODUCTS"
        title="产品中心"
        subtitle="原创设计 · 自然材质 · 价格面议，欢迎到店体验"
      />

      <div className="container-site py-12">
        {/* 筛选栏：系列标签 + 搜索 + 排序 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                !categoryId ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
              }`}
              onClick={() => updateParam('category', '')}
            >
              全部系列
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  categoryId === c.id ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
                }`}
                onClick={() => updateParam('category', String(c.id))}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            {/* 搜索 */}
            <form
              className="flex-1 md:flex-none"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                updateParam('keyword', String(fd.get('keyword') || ''))
              }}
            >
              <input name="keyword" defaultValue={keyword} placeholder="搜索产品名称" className="input !w-48 md:!w-56" />
            </form>
            {/* 排序 */}
            <select
              className="input !w-32"
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
            >
              <option value="default">综合排序</option>
              <option value="latest">最新上架</option>
            </select>
          </div>
        </div>

        {/* 结果列表 / 骨架 / 空状态 */}
        {loading ? (
          <GridSkeleton count={6} />
        ) : products.length === 0 ? (
          <EmptyState text={keyword ? `未找到「${keyword}」相关产品` : '该系列暂无产品，敬请期待'} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {products.map((p) => (
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

            {/* 分页 */}
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
                  {page} / {totalPages}（共 {total} 件）
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
