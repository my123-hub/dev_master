// 图片上传组件：AntD Upload 封装
// - 自定义请求：调后端统一上传接口（类型 jpg/png/webp、≤5MB 由后端校验）
// - 受控：value=图片 URL（字符串或数组），onChange 回传
import { useEffect, useState } from 'react'
import { Upload, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { uploadImage } from '@/api'

interface Props {
  value?: string | string[]
  onChange?: (urls: string | string[]) => void
  max?: number            // 最多张数（默认 1）
  aspect?: 'cover' | 'free'
}

/** 判断是否图片文件（前端预校验，后端仍会二次校验） */
function isImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
}

export default function ImageUpload({ value, onChange, max = 1 }: Props) {
  // 内部维护 URL 列表（字符串兼容单图）
  const [fileList, setFileList] = useState<{ url: string }[]>([])

  useEffect(() => {
    if (!value) {
      setFileList([])
      return
    }
    const urls = Array.isArray(value) ? value : value ? [value] : []
    setFileList(urls.map((url) => ({ url })))
  }, [value])

  const update = (urls: string[]) => {
    onChange?.(max === 1 ? urls[0] || '' : urls)
  }

  // 自定义上传：成功后把 URL 加入列表
  const customRequest = async ({ file, onSuccess, onError }: any) => {
    const f = file as File
    if (!isImage(f)) {
      message.error('仅支持 jpg/png/webp 图片')
      onError?.(new Error('type'))
      return
    }
    try {
      const url = await uploadImage(f)
      const next = [...fileList, { url }]
      setFileList(next)
      update(next.map((i) => i.url))
      onSuccess?.(null)
    } catch (e) {
      onError?.(e as Error)
    }
  }

  const onRemove = (item: { url: string }) => {
    const next = fileList.filter((i) => i.url !== item.url)
    setFileList(next)
    update(next.map((i) => i.url))
  }

  return (
    <Upload
      listType="picture-card"
      fileList={fileList.map((item) => ({ uid: item.url, name: item.url, status: 'done' as const, url: item.url }))}
      customRequest={customRequest}
      onRemove={(f) => onRemove({ url: (f as any).url })}
      accept=".jpg,.jpeg,.png,.webp"
    >
      {fileList.length >= max ? null : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 8, fontSize: 12 }}>上传图片</div>
        </div>
      )}
    </Upload>
  )
}
