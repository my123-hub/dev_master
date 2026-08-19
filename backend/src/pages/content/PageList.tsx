// 单页内容管理：关于STK / 品牌介绍 / 售后政策（BR-39）
// 每页一个卡片：标题 + 富文本正文 + 封面上传，保存即写库（GET/PUT /pages/{content_type}）
import { useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Form, Input, Row, Space, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { contentApi } from '@/api'
import { hasPerm } from '@/store/auth'
import RichEditor from '@/components/RichEditor'
import ImageUpload from '@/components/ImageUpload'

// 单页类型定义（与后端 PAGE_TYPES 白名单一致）
const PAGES = [
  { type: 'about_stk', title: '关于 STK' },
  { type: 'brand_intro', title: '品牌介绍' },
  { type: 'after_sales_policy', title: '售后政策' },
]

export default function PageList() {
  const canEdit = hasPerm('content:edit')
  // 各页数据与保存状态（按 content_type 存储）
  const [data, setData] = useState<Record<string, { title?: string; content?: string; cover_url?: string }>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    // 并行拉取全部单页
    PAGES.forEach((p) => {
      setLoading((s) => ({ ...s, [p.type]: true }))
      contentApi.getPage(p.type)
        .then((page) => setData((d) => ({ ...d, [p.type]: { title: page.title ?? '', content: page.content ?? '', cover_url: page.cover_url ?? '' } })))
        .catch(() => {})
        .finally(() => setLoading((s) => ({ ...s, [p.type]: false })))
    })
  }, [])

  const onSave = async (type: string) => {
    setSaving((s) => ({ ...s, [type]: true }))
    try {
      await contentApi.savePage(type, data[type] || {})
      message.success('保存成功')
    } catch { /* 统一提示 */ } finally {
      setSaving((s) => ({ ...s, [type]: false }))
    }
  }

  return (
    <div>
      <Row gutter={16}>
        {PAGES.map((p) => (
          <Col span={12} key={p.type}>
            <Card
              variant="borderless"
              title={p.title}
              loading={loading[p.type]}
              extra={
                canEdit && (
                  <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving[p.type]} onClick={() => onSave(p.type)}>
                    保存
                  </Button>
                )
              }
            >
              <Form layout="vertical">
                <Form.Item label="页面标题">
                  <Input
                    value={data[p.type]?.title}
                    disabled={!canEdit}
                    placeholder="页面标题"
                    maxLength={150}
                    onChange={(e) => setData((d) => ({ ...d, [p.type]: { ...d[p.type], title: e.target.value } }))}
                  />
                </Form.Item>
                <Form.Item label="封面图">
                  <ImageUpload
                    max={1}
                    value={data[p.type]?.cover_url || ''}
                    onChange={(url) => setData((d) => ({ ...d, [p.type]: { ...d[p.type], cover_url: url as string } }))}
                  />
                </Form.Item>
                <Form.Item label="正文（富文本）">
                  <RichEditor
                    value={data[p.type]?.content}
                    placeholder="请输入页面内容…"
                    height={280}
                    onChange={(html) => setData((d) => ({ ...d, [p.type]: { ...d[p.type], content: html } }))}
                  />
                </Form.Item>
              </Form>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
