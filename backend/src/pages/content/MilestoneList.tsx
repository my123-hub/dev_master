// 发展历程管理：时间轴条目 CRUD（BR-40）
import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Drawer, Form, Input, InputNumber, Popconfirm, Space, Table, message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { MilestoneItem, contentApi } from '@/api'
import { hasPerm } from '@/store/auth'

export default function MilestoneList() {
  const [list, setList] = useState<MilestoneItem[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<MilestoneItem | null>(null)
  const [form] = Form.useForm()
  const canEdit = hasPerm('content:edit')

  const load = useCallback(() => {
    setLoading(true)
    contentApi.milestones().then(setList).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openDrawer = (item: MilestoneItem | null) => {
    setEditing(item)
    form.resetFields()
    if (item) form.setFieldsValue(item)
    setDrawerOpen(true)
  }

  const onSave = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await contentApi.updateMilestone(editing.id, values)
        message.success('已更新')
      } else {
        await contentApi.createMilestone(values)
        message.success('已创建')
      }
      setDrawerOpen(false)
      load()
    } catch { /* 统一提示 */ }
  }

  const onDelete = async (id: number) => {
    try {
      await contentApi.removeMilestone(id)
      message.success('已删除')
      load()
    } catch { /* 统一提示 */ }
  }

  const columns = [
    { title: '年份', dataIndex: 'year', width: 100, render: (v: string) => <strong style={{ color: '#0F3D2E' }}>{v}</strong> },
    { title: '事件标题', dataIndex: 'title', width: 220, render: (v: string) => v || '—' },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sort_order', width: 80 },
    {
      title: '操作', width: 120,
      render: (_: unknown, row: MilestoneItem) => (
        <Space>
          {canEdit && <Button size="small" type="link" onClick={() => openDrawer(row)}>编辑</Button>}
          {canEdit && (
            <Popconfirm title="确认删除该条目？" onConfirm={() => onDelete(row.id)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="发展历程"
      variant="borderless"
      extra={canEdit && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>新增条目</Button>
      )}
    >
      <Table rowKey="id" loading={loading} dataSource={list} columns={columns} size="middle"
        pagination={false} />
      <Drawer title={editing ? '编辑条目' : '新增条目'} width={460} open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Space><Button onClick={() => setDrawerOpen(false)}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></Space>}>
        <Form form={form} layout="vertical">
          <Form.Item name="year" label="年份" rules={[{ required: true, message: '请输入年份' }]}>
            <Input placeholder="如 2020" maxLength={10} />
          </Form.Item>
          <Form.Item name="title" label="事件标题">
            <Input placeholder="如：品牌创立" maxLength={150} />
          </Form.Item>
          <Form.Item name="description" label="事件说明">
            <Input.TextArea rows={4} placeholder="事件描述" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序（大在前）" initialValue={0}>
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}
