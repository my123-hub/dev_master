// 新闻管理：栏目管理 + 文章 CRUD（草稿/发布/置顶，BR-26~33）
// - 顶部 Tabs：全部文章 / 各栏目（可管理栏目：新增/编辑/删除，有文章禁删）
// - 文章编辑抽屉：富文本正文 + 封面上传 + 发布/置顶开关
import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { NewsCategoryItem, NewsItem, NewsPayload, newsApi } from '@/api'
import { hasPerm } from '@/store/auth'
import RichEditor from '@/components/RichEditor'
import ImageUpload from '@/components/ImageUpload'

export default function NewsList() {
  const [cats, setCats] = useState<NewsCategoryItem[]>([])
  const [list, setList] = useState<NewsItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [activeCat, setActiveCat] = useState<number | 'all'>('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<NewsItem | null>(null)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catForm] = Form.useForm()
  const [form] = Form.useForm()

  const canCreate = hasPerm('news:create')
  const canEdit = hasPerm('news:edit')
  const canDelete = hasPerm('news:delete')
  const canStatus = hasPerm('news:status')

  const loadCats = useCallback(() => {
    newsApi.categories().then(setCats).catch(() => {})
  }, [])

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const data = await newsApi.list({
        page: p, page_size: 10,
        category_id: activeCat === 'all' ? undefined : activeCat,
        keyword: keyword || undefined,
      })
      setList(data.items)
      setTotal(data.total)
    } catch { /* 统一提示 */ } finally { setLoading(false) }
  }, [page, activeCat, keyword])

  useEffect(() => { loadCats() }, [loadCats])
  useEffect(() => { load() }, [load])

  const openDrawer = (item: NewsItem | null) => {
    setEditing(item)
    form.resetFields()
    if (item) {
      form.setFieldsValue({ ...item, is_published: item.is_published === 1, is_top: item.is_top === 1 })
    } else {
      form.setFieldsValue({ category_id: activeCat === 'all' ? undefined : activeCat, is_published: false, is_top: false })
    }
    setDrawerOpen(true)
  }

  const onSave = async () => {
    const values = await form.validateFields()
    const payload: NewsPayload = {
      category_id: values.category_id,
      title: values.title,
      summary: values.summary || '',
      content: values.content || '',
      source: values.source || '',
      cover_url: values.cover_url || '',
      is_published: values.is_published ? 1 : 0,
      is_top: values.is_top ? 1 : 0,
    }
    try {
      if (editing) {
        await newsApi.update(editing.id, payload)
        message.success('文章已更新')
      } else {
        await newsApi.create(payload)
        message.success('文章已创建')
      }
      setDrawerOpen(false)
      load(editing ? page : 1)
    } catch { /* 统一提示 */ }
  }

  const onDelete = async (id: number) => {
    try {
      await newsApi.remove(id)
      message.success('文章已删除')
      load()
    } catch { /* 统一提示 */ }
  }

  const onPublish = async (row: NewsItem) => {
    try {
      await newsApi.changeStatus(row.id, row.is_published === 1 ? 0 : 1)
      message.success(row.is_published === 1 ? '已撤回为草稿' : '已发布')
      load()
    } catch { /* 统一提示 */ }
  }

  // ---- 栏目管理 ----
  const openCatModal = () => { catForm.resetFields(); setCatModalOpen(true) }
  const onSaveCat = async () => {
    const values = await catForm.validateFields()
    try {
      await newsApi.createCategory(values)
      message.success('栏目已创建')
      setCatModalOpen(false)
      loadCats()
    } catch { /* 统一提示 */ }
  }
  const onDeleteCat = async (id: number) => {
    try {
      await newsApi.removeCategory(id)
      message.success('栏目已删除')
      loadCats()
    } catch { /* 409 已提示 */ }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '标题', dataIndex: 'title', width: 260,
      render: (_: unknown, row: NewsItem) => (
        <Space>
          {row.is_top === 1 && <Tag color="gold">置顶</Tag>}
          <span>{row.title}</span>
        </Space>
      ),
    },
    { title: '栏目', dataIndex: 'category_name', width: 110 },
    { title: '来源', dataIndex: 'source', width: 100, render: (v: string) => v || '—' },
    {
      title: '状态', dataIndex: 'is_published', width: 90,
      render: (v: number) => (v === 1 ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>),
    },
    { title: '发布时间', dataIndex: 'publish_time', width: 150, render: (v: string) => (v ? v.slice(0, 16).replace('T', ' ') : '—') },
    {
      title: '操作', width: 180,
      render: (_: unknown, row: NewsItem) => (
        <Space size={0}>
          {canEdit && <Button size="small" type="link" onClick={() => openDrawer(row)}>编辑</Button>}
          {canStatus && (
            <Button size="small" type="link" onClick={() => onPublish(row)}>
              {row.is_published === 1 ? '撤回' : '发布'}
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="确认删除该文章？" onConfirm={() => onDelete(row.id)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card variant="borderless" title="新闻管理">
      <Tabs
        activeKey={String(activeCat)}
        onChange={(k) => { setActiveCat(k === 'all' ? 'all' : Number(k)); setPage(1) }}
        items={[
          { key: 'all', label: `全部（${total}）` },
          ...cats.map((c) => ({
            key: String(c.id),
            label: `${c.name}（${c.article_count}）`,
          })),
        ]}
        tabBarExtraContent={
          <Space>
            <Input.Search placeholder="标题搜索" allowClear style={{ width: 200 }} onSearch={(v) => { setKeyword(v); load(1) }} />
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>新增文章</Button>
            )}
            {canCreate && <Button onClick={openCatModal}>管理栏目</Button>}
          </Space>
        }
      />

      <Table rowKey="id" loading={loading} dataSource={list} columns={columns} size="middle"
        pagination={{ current: page, pageSize: 10, total, onChange: setPage }} />

      {/* 文章编辑抽屉 */}
      <Drawer title={editing ? '编辑文章' : '新增文章'} width={680} open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Space><Button onClick={() => setDrawerOpen(false)}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></Space>}>
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="category_id" label="所属栏目" rules={[{ required: true, message: '请选择栏目' }]} style={{ width: 220 }}>
              <Select options={cats.map((c) => ({ value: c.id, label: c.name }))} placeholder="选择栏目" />
            </Form.Item>
            <Form.Item name="source" label="来源" style={{ width: 220 }}>
              <Input placeholder="转载来源（可选）" maxLength={100} />
            </Form.Item>
          </Space>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="文章标题" maxLength={200} />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea placeholder="摘要（前台列表展示）" maxLength={300} rows={2} />
          </Form.Item>
          <Form.Item name="cover_url" label="封面图" valuePropName="src">
            <ImageUpload max={1} />
          </Form.Item>
          <Form.Item name="content" label="正文（富文本）">
            <RichEditor placeholder="请输入文章正文…" height={300} />
          </Form.Item>
          <Space size={32}>
            <Form.Item name="is_published" label="发布状态" valuePropName="checked">
              <Switch checkedChildren="已发布" unCheckedChildren="草稿" />
            </Form.Item>
            <Form.Item name="is_top" label="置顶推荐" valuePropName="checked">
              <Switch checkedChildren="置顶" unCheckedChildren="普通" />
            </Form.Item>
          </Space>
        </Form>
      </Drawer>

      {/* 栏目管理弹窗 */}
      <Modal title="新增栏目" open={catModalOpen} onCancel={() => setCatModalOpen(false)}
        onOk={onSaveCat} okText="创建" cancelText="取消">
        <Form form={catForm} layout="vertical">
          <Form.Item name="name" label="栏目名称" rules={[{ required: true, message: '请输入栏目名称' }]}>
            <Input placeholder="如：企业新闻" maxLength={50} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序（小在前）" initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
        {/* 已有栏目列表（可删除，有文章禁删） */}
        <div style={{ marginTop: 8 }}>
          {cats.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>{c.name}（{c.article_count} 篇）</span>
              {canDelete && (
                <Popconfirm title={`确认删除栏目「${c.name}」？`} onConfirm={() => onDeleteCat(c.id)}>
                  <Button size="small" type="link" danger>删除</Button>
                </Popconfirm>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  )
}
