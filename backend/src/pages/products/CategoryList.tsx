// 产品系列管理：列表 / 新增 / 编辑 / 删除（有产品禁删，BR-09~12）
import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { CategoryItem, CategoryPayload, categoryApi } from '@/api'
import { hasPerm } from '@/store/auth'

export default function CategoryList() {
  const [list, setList] = useState<CategoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryItem | null>(null)
  const [form] = Form.useForm()

  const canCreate = hasPerm('product:create')
  const canEdit = hasPerm('product:edit')
  const canDelete = hasPerm('product:delete')

  const load = useCallback(async (p = page, kw = keyword) => {
    setLoading(true)
    try {
      const data = await categoryApi.list({ page: p, page_size: 10, keyword: kw || undefined })
      setList(data.items)
      setTotal(data.total)
    } catch {
      /* 错误已统一提示 */
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => {
    load()
  }, [load])

  // 打开新增/编辑抽屉
  const openDrawer = (item: CategoryItem | null) => {
    setEditing(item)
    form.resetFields()
    if (item) form.setFieldsValue(item)
    setDrawerOpen(true)
  }

  // 保存（新增或编辑）
  const onSave = async () => {
    const values = (await form.validateFields()) as CategoryPayload
    try {
      if (editing) {
        await categoryApi.update(editing.id, values)
        message.success('系列已更新')
      } else {
        await categoryApi.create(values)
        message.success('系列已创建')
      }
      setDrawerOpen(false)
      load(editing ? page : 1)
    } catch {
      /* 错误已统一提示 */
    }
  }

  // 删除（有产品时后端返回 409，请求层自动提示）
  const onDelete = async (id: number) => {
    try {
      await categoryApi.remove(id)
      message.success('系列已删除')
      load()
    } catch {
      /* 409 已提示 */
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '系列名称', dataIndex: 'name' },
    { title: '封面图', dataIndex: 'cover_url', width: 100, render: (v: string) =>
        v ? <img src={v} alt="" style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4 }} /> : '—' },
    { title: '排序', dataIndex: 'sort_order', width: 80 },
    { title: '产品数', dataIndex: 'product_count', width: 90, render: (v: number) => <span>{v} 个</span> },
    {
      title: '操作', width: 150,
      render: (_: unknown, row: CategoryItem) => (
        <Space>
          {canEdit && <Button size="small" type="link" onClick={() => openDrawer(row)}>编辑</Button>}
          {canDelete && (
            <Popconfirm
              title="确认删除该系列？"
              description={row.product_count > 0 ? '该系列下有产品，删除将被禁止' : '删除后不可恢复'}
              onConfirm={() => onDelete(row.id)}
              okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
            >
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="产品系列"
      variant="borderless"
      extra={
        canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>
            新增系列
          </Button>
        )
      }
    >
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="按系列名称搜索"
          allowClear
          onSearch={(v) => { setKeyword(v); load(1, v) }}
          style={{ width: 240 }}
        />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns}
        pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
        size="middle"
      />

      {/* 新增/编辑抽屉（UI-UX §7 openDrawer 范式） */}
      <Drawer
        title={editing ? '编辑系列' : '新增系列'}
        width={420}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={onSave}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="系列名称" rules={[{ required: true, message: '请输入系列名称' }]}>
            <Input placeholder="如：胡桃禮系列" maxLength={100} />
          </Form.Item>
          <Form.Item name="cover_url" label="封面图 URL" extra="可通过编辑器图片上传获取，或直接粘贴 URL">
            <Input placeholder="/static/uploads/xxx.webp" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序（小在前）" initialValue={0}>
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}
