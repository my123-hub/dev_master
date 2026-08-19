// Skeleton：骨架屏组件（NFR-16 容错，加载态不白屏）
// - 卡片骨架：图片块 + 两行文字条（脉冲动画）
import { ReactNode } from 'react'

/** 单条脉冲条 */
export function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-warmgray-100 ${className}`}
      style={{ background: 'linear-gradient(100deg, #EDF2EE 40%, #F7FAF8 50%, #EDF2EE 60%)' }}
    />
  )
}

/** 产品/案例卡片骨架 */
export function CardSkeleton() {
  return (
    <div className="card p-0">
      <SkeletonBar className="w-full aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-2">
        <SkeletonBar className="h-4 w-3/4" />
        <SkeletonBar className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/** 网格骨架（n 个卡片，默认 6） */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/** 详情页骨架 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBar className="h-10 w-1/3 mx-auto" />
      <div className="grid md:grid-cols-2 gap-8">
        <SkeletonBar className="aspect-[4/3] rounded-card" />
        <div className="space-y-3">
          <SkeletonBar className="h-5 w-2/3" />
          <SkeletonBar className="h-4 w-full" />
          <SkeletonBar className="h-4 w-full" />
          <SkeletonBar className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  )
}

/** 空状态（无数据提示，NFR-16） */
export function EmptyState({ text = '暂无内容' }: { text?: string }) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto w-16 h-16 rounded-full border-2 border-jade-200 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8FB5A2" strokeWidth="1.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <p className="text-warmgray-500 text-sm tracking-widest">{text}</p>
    </div>
  )
}

/** 404 页面（UI-UX §3.3） */
export function NotFoundPage({ title = '页面不存在' }: { title?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center py-20">
        <div className="font-serif text-7xl font-bold text-jade-200">404</div>
        <p className="mt-4 text-warmgray-700 tracking-widest">{title}</p>
        <a href="/" className="btn-primary mt-8">
          返回首页
        </a>
      </div>
    </div>
  )
}

/** 页面标题带子标题（通用页头） */
export function PageHeader({ tag, title, subtitle }: { tag?: string; title: string; subtitle?: ReactNode }) {
  return (
    <div className="pt-28 pb-12 text-center bg-jade-50/60 border-b border-jade-100">
      {tag && <span className="brand-tag">{tag}</span>}
      <h1 className="text-3xl md:text-4xl font-semibold mt-3">{title}</h1>
      {subtitle && <p className="mt-3 text-warmgray-500 text-sm max-w-xl mx-auto">{subtitle}</p>}
    </div>
  )
}
