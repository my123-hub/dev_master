// 富文本编辑器封装（wangEditor v5，UI-UX §13.2 推荐）
// - 受控组件：value/onChange 对接 AntD Form
// - 图片上传：自定义上传回调，复用后端 /api/admin/upload（先传图拿 URL 再插入）
import { useEffect, useRef } from 'react'
import { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import '@wangeditor/editor/dist/css/style.css'
import { uploadImage } from '@/api'
import { message } from 'antd'

interface Props {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  height?: number
}

export default function RichEditor({ value, onChange, placeholder = '请输入内容…', height = 300 }: Props) {
  const editorRef = useRef<IDomEditor | null>(null)

  const toolbarConfig: Partial<IToolbarConfig> = {
    // 常用工具栏按钮（排除不常用的插入表格/视频等）
    excludeKeys: ['group-video', 'insertTable', 'codeBlock', 'fullScreen'],
  }

  const editorConfig: Partial<IEditorConfig> = {
    placeholder,
    // 图片自定义上传：调后端统一上传接口，成功后插入图片（BR-19/NFR-09）
    MENU_CONF: {
      uploadImage: {
        async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
          try {
            const url = await uploadImage(file)
            insertFn(url, '', '')
          } catch {
            message.error('图片上传失败')
          }
        },
      },
    },
  }

  // 组件卸载时销毁编辑器实例（wangEditor 官方要求）
  useEffect(() => {
    return () => {
      editorRef.current?.destroy()
      editorRef.current = null
    }
  }, [])

  return (
    <div style={{ border: '1px solid #d9d9d9', zIndex: 100 }}>
      <Toolbar
        editor={editorRef.current}
        defaultConfig={toolbarConfig}
        mode="default"
        style={{ borderBottom: '1px solid #d9d9d9' }}
      />
      <Editor
        defaultConfig={editorConfig}
        value={value || ''}
        onCreated={(editor) => (editorRef.current = editor)}
        onChange={(editor) => onChange?.(editor.getHtml())}
        mode="default"
        style={{ height, overflowY: 'hidden' }}
      />
    </div>
  )
}
