// FAQ 管理：问题列表 CRUD（BR-41，前台手风琴展示）
import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Drawer, Form, Input, InputNumber, Popconfirm, Space, Table, message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { FaqItem, contentApi } from '@/api'
import { hasPerm } from '@/store/auth'
import RichEditor from '@/components/RichEditor'

export default function FaqList() {
  const [list, setList] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<FaqItem | null>(null)
  const [form] = Form.useForm()
  const canEdit = hasPerm('content:edit')

  const load = useCallback(() => {
    setLoading(true)
    contentApi.faqs().then(setList).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openDrawer = (item: FaqItem | null) => {
    setEditing(item)
    form.resetFields()
    if (item) form.setFieldsValue(item)
    setDrawerOpen(true)
  }

  const onSave = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await contentApi.updateFaq(editing.id, values)
        message.success('已更新')
      } else {
        await contentApi.createFaq(values)
        message.success('已创建')
      }
      setDrawerOpen(false)
      load()
    } catch { /* 统一提示 */ }
  }

  const onDelete = async (id: number) => {
    try {
      await contentApi.removeFaq(id)
      message.success('已删除')
      load()
    } catch { /* 统一提示 */ }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '分类', dataIndex: 'category', width: 100, render: (v: string) => v || '—' },
    { title: '问题', dataIndex: 'question', width: 260, ellipsis: true },
    { title: '答案', dataIndex: 'answer', ellipsis: true, render: (v: string) => (v ? v.replace(/<[^>]+>/g, '').slice(0, 40) : '—') },
    { title: '排序', dataIndex: 'sort_order', width: 80 },
    {
      title: '操作', width: 120,
      render: (_: unknown, row: FaqItem) => (
        <Space>
          {canEdit && <Button size="small" type="link" onClick={() => openDrawer(row)}>编辑</Button>}
          {canEdit && (
            <Popconfirm title="确认删除该问题？" onConfirm={() => onDelete(row.id)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="常见问题 FAQ"
      variant="borderless"
      extra={canEdit && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>新增问题</Button>
      )}
    >
      <Table rowKey="id" loading={loading} dataSource={list} columns={columns} size="middle"
        pagination={false} />
      <Drawer title={editing ? '编辑问题' : '新增问题'} width={560} open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Space><Button onClick={() => setDrawerOpen(false)}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></Space>}>
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="category" label="分类" style={{ width: 200 }}>
              <Input placeholder="如：配送安装" maxLength={50} />
            </Form.Item>
            <Form.Item name="sort_order" label="排序（小在前）" initialValue={0} style={{ width: 160 }}>
              <InputNumber min={0} max={9999} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="question" label="问题" rules={[{ required: true, message: '请输入问题' }]}>
            <Input placeholder="如：多久发货？" maxLength={300} />
          </Form.Item>
          <Form.Item name="answer" label="答案（富文本）">
            <RichEditor placeholder="请输入答案…" height={200} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}
