// RichText：富文本内容渲染（后端 wangEditor HTML）
// - 后端已做 XSS 清洗（NFR-08）；容器类 .rich-text 提供排版样式
import { useEffect, useRef } from 'react'

interface Props {
  html?: string | null
  className?: string
}

export default function RichText({ html, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // 挂载后清洗内部链接 target（新窗口打开外部链接，安全惯例）
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll('a').forEach((a) => {
      if (a.href.startsWith('http')) a.target = '_blank'
      a.rel = 'noreferrer'
    })
  }, [html])

  return (
    <div
      ref={ref}
      className={`rich-text ${className}`}
      // 富文本 HTML 由后台 CMS 维护（已清洗），业务场景必需渲染
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  )
}
