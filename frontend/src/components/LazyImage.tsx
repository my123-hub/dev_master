// LazyImage：图片懒加载组件（IntersectionObserver，NFR-01/FR-05）
// - 进入视口前渲染占位背景（品牌浅绿），进入后加载真实图片
// - 支持 src 为空时的占位块
import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string | null | undefined
  alt?: string
  className?: string
  /** 占位背景色（默认墨玉浅绿） */
  placeholder?: string
}

export default function LazyImage({ src, alt = '', className = '', placeholder = '#E8EFEA' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // IntersectionObserver：进入视口 10% 即触发加载（FR-05 图片懒加载）
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '80px' }, // 提前 80px 预加载，滚动无白屏
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`relative overflow-hidden bg-[${placeholder}] ${className}`}>
      {/* 占位背景（加载前/加载中） */}
      {(!visible || !loaded) && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: 'linear-gradient(100deg, #EDF2EE 40%, #F7FAF8 50%, #EDF2EE 60%)' }}
        />
      )}
      {visible && src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}
      {/* 无图占位 */}
      {visible && !src && (
        <div className="absolute inset-0 flex items-center justify-center text-warmgray-300 text-xs tracking-widest">
          暂无图片
        </div>
      )}
    </div>
  )
}
