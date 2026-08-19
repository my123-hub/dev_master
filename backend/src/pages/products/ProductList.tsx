// 产品管理：列表 / 新增 / 编辑 / 软删除 / 上下架（BR-13~20）
// - 规格参数 specs 为动态行表单（Form.List）
// - 图集 images 多图上传；描述 description 富文本
// - 列表：系列/状态筛选、名称搜索；is_top 首页推荐标记
import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch,
  Table, Tag, message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { CategoryItem, ProductItem, ProductPayload, categoryApi, productApi } from '@/api'
import { hasPerm } from '@/store/auth'
import RichEditor from '@/components/RichEditor'
import ImageUpload from '@/components/ImageUpload'

// 状态标签（红=下架/禁用语义，绿=上架；全站禁用蓝色）
const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '上架', color: 'green' },
  2: { text: '下架', color: 'red' },
}

export default function ProductList() {
  const [list, setList] = useState<ProductItem[]>([])
  const [cats, setCats] = useState<CategoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<{ category_id?: number; status?: number; keyword?: string }>({})
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ProductItem | null>(null)
  const [form] = Form.useForm()

  const canCreate = hasPerm('product:create')
  const canEdit = hasPerm('product:edit')
  const canDelete = hasPerm('product:delete')
  const canStatus = hasPerm('product:status')

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const data = await productApi.list({ page: p, page_size: 10, ...filters })
      setList(data.items)
      setTotal(data.total)
    } catch {
      /* 统一提示 */
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    load()
  }, [load])

  // 系列下拉选项
  useEffect(() => {
    categoryApi.list({ page: 1, page_size: 100 }).then((d) => setCats(d.items)).catch(() => {})
  }, [])

  const openDrawer = (item: ProductItem | null) => {
    setEditing(item)
    form.resetFields()
    if (item) {
      // 回填：specs/images 若为 null 转空数组，避免 Form.List 报错
      form.setFieldsValue({ ...item, specs: item.specs ?? [], images: item.images ?? [] })
    } else {
      form.setFieldsValue({ status: 0, is_top: 0, sort_order: 0, specs: [], images: [] })
    }
    setDrawerOpen(true)
  }

  const onSave = async () => {
    const values = (await form.validateFields()) as ProductPayload
    // 富文本/图集为受控组件，需从 form 取值后序列化
    const payload: ProductPayload = {
      ...values,
      specs: values.specs?.filter((s) => s?.name || s?.value) ?? [],
      images: (values.images as string[] | undefined) ?? [],
      description: values.description || '',
      cover_url: values.cover_url || '',
    }
    try {
      if (editing) {
        await productApi.update(editing.id, payload)
        message.success('产品已更新')
      } else {
        await productApi.create(payload)
        message.success('产品已创建')
      }
      setDrawerOpen(false)
      load(editing ? page : 1)
    } catch {
      /* 统一提示 */
    }
  }

  const onDelete = async (id: number) => {
    try {
      await productApi.remove(id)
      message.success('产品已删除')
      load()
    } catch { /* 统一提示 */ }
  }

  const onToggleStatus = async (row: ProductItem, status: number) => {
    try {
      await productApi.changeStatus(row.id, status)
      message.success('状态已更新')
      load()
    } catch { /* 统一提示 */ }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '产品', dataIndex: 'name', width: 180,
      render: (_: unknown, row: ProductItem) => (
        <Space>
          {row.cover_url ? (
            <img src={row.cover_url} alt="" style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4 }} />
          ) : null}
          <div>
            <div>{row.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{row.product_no}</div>
          </div>
        </Space>
      ),
    },
    { title: '系列', dataIndex: 'category_name', width: 110, render: (v: string) => v || '—' },
    { title: '系列名(业务)', dataIndex: 'series', width: 100, render: (v: string) => v || '—' },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: number) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.text || v}</Tag>,
    },
    {
      title: '推荐', dataIndex: 'is_top', width: 80,
      render: (v: number) => (v === 1 ? <Tag color="gold">首页推荐</Tag> : '—'),
    },
    { title: '排序', dataIndex: 'sort_order', width: 70 },
    {
      title: '操作', width: 200,
      render: (_: unknown, row: ProductItem) => (
        <Space size={0}>
          {canEdit && <Button size="small" type="link" onClick={() => openDrawer(row)}>编辑</Button>}
          {canStatus && (
            row.status === 1 ? (
              <Button size="small" type="link" danger onClick={() => onToggleStatus(row, 2)}>下架</Button>
            ) : (
              <Button size="small" type="link" onClick={() => onToggleStatus(row, 1)}>上架</Button>
            )
          )}
          {canDelete && (
            <Popconfirm title="确认删除该产品？" description="删除后不可恢复" onConfirm={() => onDelete(row.id)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="产品管理"
      variant="borderless"
      extra={
        canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>
            新增产品
          </Button>
        )
      }
    >
      {/* 筛选区 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="全部系列"
          allowClear
          style={{ width: 160 }}
          options={cats.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(v) => { setFilters((f) => ({ ...f, category_id: v })); load(1) }}
        />
        <Select
          placeholder="全部状态"
          allowClear
          style={{ width: 130 }}
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: Number(k), label: v.text }))}
          onChange={(v) => { setFilters((f) => ({ ...f, status: v })); load(1) }}
        />
        <Input.Search
          placeholder="名称/编号搜索"
          allowClear
          style={{ width: 220 }}
          onSearch={(v) => { setFilters((f) => ({ ...f, keyword: v })); load(1) }}
        />
      </Space>

      <Table
        rowKey="id" loading={loading} dataSource={list} columns={columns} size="middle"
        pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
      />

      {/* 新增/编辑抽屉 */}
      <Drawer
        title={editing ? '编辑产品' : '新增产品'}
        width={680}
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
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="category_id" label="所属系列" rules={[{ required: true, message: '请选择系列' }]} style={{ width: 240 }}>
              <Select options={cats.map((c) => ({ value: c.id, label: c.name }))} placeholder="选择系列" />
            </Form.Item>
            <Form.Item name="product_no" label="产品编号" rules={[{ required: true, message: '请输入产品编号' }]} style={{ width: 240 }}>
              <Input placeholder="如 STK-0001（唯一）" maxLength={50} />
            </Form.Item>
          </Space>
          <Form.Item name="name" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
            <Input placeholder="如：胡桃木餐桌" maxLength={100} />
          </Form.Item>
          <Form.Item name="series" label="所属系列（业务名）" extra="如「胡桃禮」，可与产品系列不同">
            <Input placeholder="如：胡桃禮" maxLength={50} />
          </Form.Item>
          <Form.Item name="cover_url" label="封面图" valuePropName="src">
            <ImageUpload max={1} />
          </Form.Item>
          <Form.Item name="images" label="图集（多图）">
            <ImageUpload max={12} />
          </Form.Item>
          <Form.Item name="description" label="产品描述（富文本）">
            <RichEditor placeholder="请输入产品描述…" height={260} />
          </Form.Item>

          {/* 动态规格参数（BR-15） */}
          <Form.Item label="规格参数">
            <Form.List name="specs">
              {(fields, { add, remove }) => (
                <div>
                  {fields.map((field, idx) => (
                    <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[field.name, 'name']} rules={[{ required: true, message: '参数名' }]} noStyle>
                        <Input placeholder="参数名，如 材质" style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'value']} rules={[{ required: true, message: '参数值' }]} noStyle>
                        <Input placeholder="参数值，如 胡桃木" style={{ width: 240 }} />
                      </Form.Item>
                      <Button type="text" danger onClick={() => remove(field.name)}>移除</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                    添加规格参数（第 {fields.length + 1} 项）
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          <Space size={32}>
            <Form.Item name="status" label="发布状态" valuePropName="checked">
              <Switch
                checkedChildren="上架" unCheckedChildren="草稿"
                // status: 0 草稿 / 1 上架（Switch 布尔 ↔ 数值映射）
                onChange={(checked) => form.setFieldValue('status', checked ? 1 : 0)}
              />
            </Form.Item>
            <Form.Item name="is_top" label="首页推荐" valuePropName="checked">
              <Switch
                checkedChildren="推荐" unCheckedChildren="普通"
                onChange={(checked) => form.setFieldValue('is_top', checked ? 1 : 0)}
              />
            </Form.Item>
            <Form.Item name="sort_order" label="排序（大在前）" initialValue={0}>
              <InputNumber min={0} max={9999} style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Drawer>
    </Card>
  )
}
