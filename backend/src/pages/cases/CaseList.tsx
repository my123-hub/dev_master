// 案例管理页：列表（关键词/状态筛选）+ 新增/编辑（富文本/空间标签/图集）+ 发布切换（BR-21~25）
import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { caseApi, type CaseItem, type CasePayload } from '@/api'
import RichEditor from '@/components/RichEditor'
import ImageUpload from '@/components/ImageUpload'
import { hasPerm } from '@/store/auth'

// 空间标签候选：与 PRD §8.4 案例空间维度一致（前台 Tab 筛选维度）
const SPACE_TAGS = ['客厅', '卧室', '餐厅', '书房', '厨房', '卫浴', '全屋']

const statusMap: Record<number, { text: string; color: string }> = {
  1: { text: '已发布', color: 'green' },
  0: { text: '已下线', color: 'default' },
}

export default function CaseList() {
  const [list, setList] = useState<CaseItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CaseItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<CasePayload>()

  const load = async () => {
    setLoading(true)
    try {
      const res = await caseApi.list({ page, page_size: pageSize, keyword: keyword || undefined, status })
      setList(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 1, sort_order: 0, space_tags: [] })
    setOpen(true)
  }
  const openEdit = (row: CaseItem) => {
    setEditing(row)
    form.setFieldsValue({
      title: row.title,
      cover_url: row.cover_url,
      space_tags: row.space_tags ?? [],
      city: row.city ?? undefined,
      area: row.area ?? undefined,
      finished_at: row.finished_at ?? undefined,
      content: row.content ?? undefined,
      images: row.images ?? [],
      sort_order: row.sort_order,
      status: row.status,
    })
    setOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await caseApi.update(editing.id, values)
        message.success('案例已更新')
      } else {
        await caseApi.create(values)
        message.success('案例已创建')
      }
      setOpen(false)
      load()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (row: CaseItem, next: number) => {
    await caseApi.changeStatus(row.id, next)
    message.success(next === 1 ? '案例已发布' : '案例已下线')
    load()
  }

  const remove = async (row: CaseItem) => {
    await caseApi.remove(row.id)
    message.success('案例已删除')
    load()
  }

  const columns: ColumnsType<CaseItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '封面',
      dataIndex: 'cover_url',
      width: 90,
      render: (v: string | null) =>
        v ? <img src={v} alt="cover" style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 4 }} /> : '—',
    },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '空间标签',
      dataIndex: 'space_tags',
      width: 200,
      render: (tags: string[] | null) =>
        tags?.length ? tags.map((t) => <Tag key={t}>{t}</Tag>) : '—',
    },
    { title: '城市', dataIndex: 'city', width: 90, render: (v) => v || '—' },
    { title: '面积', dataIndex: 'area', width: 90, render: (v) => v || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: number) => <Tag color={statusMap[v].color}>{statusMap[v].text}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, row) => (
        <Space size="small">
          <Switch
            size="small"
            checked={row.status === 1}
            checkedChildren="发布"
            unCheckedChildren="下线"
            onChange={(checked) => toggleStatus(row, checked ? 1 : 0)}
            disabled={!hasPerm('case:status')}
          />
          <Button type="link" size="small" onClick={() => openEdit(row)} disabled={!hasPerm('case:edit')}>
            编辑
          </Button>
          <Popconfirm title="确认删除该案例？" onConfirm={() => remove(row)}>
            <Button type="link" size="small" danger disabled={!hasPerm('case:delete')}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="案例管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!hasPerm('case:create')}>
            新增案例
          </Button>
        </Space>
      }
    >
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索案例标题"
          allowClear
          style={{ width: 260 }}
          onSearch={(v) => {
            setKeyword(v)
            setPage(1)
          }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 140 }}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={[
            { value: 1, label: '已发布' },
            { value: 0, label: '已下线' },
          ]}
        />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
      />

      <Modal
        title={editing ? '编辑案例' : '新增案例'}
        open={open}
        onOk={save}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        width={760}
        okText="保存"
      >
        <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 20 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：上海·私宅全屋定制" maxLength={150} />
          </Form.Item>
          <Form.Item name="space_tags" label="空间标签">
            <Select mode="multiple" options={SPACE_TAGS.map((t) => ({ value: t, label: t }))} placeholder="选择空间（可多选）" />
          </Form.Item>
          <Form.Item name="cover_url" label="封面图">
            <ImageUpload value={form.getFieldValue('cover_url')} onChange={(url) => form.setFieldValue('cover_url', url)} />
          </Form.Item>
          <Form.Item name="images" label="实景图集">
            <ImageUpload max={9} value={form.getFieldValue('images')} onChange={(urls) => form.setFieldValue('images', urls)} />
          </Form.Item>
          <Form.Item label="项目信息">
            <Space.Compact block>
              <Form.Item name="city" noStyle rules={[{ required: false }]}>
                <Input placeholder="城市" style={{ width: '33%' }} />
              </Form.Item>
              <Form.Item name="area" noStyle>
                <Input placeholder="面积（如 120㎡）" style={{ width: '33%' }} />
              </Form.Item>
              <Form.Item name="finished_at" noStyle>
                <Input placeholder="完工时间（如 2026-06）" style={{ width: '34%' }} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="content" label="项目介绍" valuePropName="html">
            <RichEditor />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="status" label="发布状态">
            <Select
              options={[
                { value: 1, label: '发布' },
                { value: 0, label: '下线' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
