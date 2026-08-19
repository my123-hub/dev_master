// 招聘管理页：职位 Tab（CRUD/急招/启停）+ 投递 Tab（列表/状态流转/删除/导出）（BR-34~38/69~72）
import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import { DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  applicationApi,
  downloadBlob,
  jobApi,
  parseFileName,
  type JobApplicationItem,
  type JobItem,
  type JobPayload,
} from '@/api'
import RichEditor from '@/components/RichEditor'
import { hasPerm } from '@/store/auth'

// 投递状态机标签（与后端 §7.4 一致，BR-71 可回退）
const APP_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待处理', color: 'orange' },
  1: { text: '已联系', color: 'blue' },
  2: { text: '已淘汰', color: 'default' },
  3: { text: '已录用', color: 'green' },
}
// 状态流转按钮：仅展示合法跃迁（0→1，1→0/2/3）
const APP_ACTIONS: Record<number, { target: number; label: string }[]> = {
  0: [{ target: 1, label: '标记已联系' }],
  1: [
    { target: 0, label: '回退待处理' },
    { target: 2, label: '淘汰' },
    { target: 3, label: '录用' },
  ],
}

function JobTab() {
  const [list, setList] = useState<JobItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<JobItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<JobPayload>()

  const load = async () => {
    setLoading(true)
    try {
      const res = await jobApi.list({ page, page_size: pageSize, keyword: keyword || undefined, category })
      setList(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, category])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ category: 1, location: '上海', status: 1, is_urgent: 0 })
    setOpen(true)
  }
  const openEdit = (row: JobItem) => {
    setEditing(row)
    form.setFieldsValue({ ...row, is_urgent: row.is_urgent })
    setOpen(true)
  }
  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await jobApi.update(editing.id, values)
        message.success('职位已更新')
      } else {
        await jobApi.create(values)
        message.success('职位已创建')
      }
      setOpen(false)
      load()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }
  const toggleStatus = async (row: JobItem, next: number) => {
    await jobApi.changeStatus(row.id, next)
    message.success(next === 1 ? '职位已开启招聘' : '职位已关闭')
    load()
  }
  const remove = async (row: JobItem) => {
    await jobApi.remove(row.id)
    message.success('职位已删除')
    load()
  }

  const columns: ColumnsType<JobItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '职位名称',
      dataIndex: 'title',
      render: (v: string, row) => (
        <Space>
          {v}
          {row.is_urgent === 1 && <Tag color="red">急招</Tag>}
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (v: number) => (v === 1 ? '社会招聘' : '校园招聘'),
    },
    { title: '地点', dataIndex: 'location', width: 100 },
    { title: '类型', dataIndex: 'job_type', width: 90, render: (v) => v || '—' },
    { title: '薪资', dataIndex: 'salary_range', width: 110, render: (v) => v || '—' },
    { title: '投递数', dataIndex: 'application_count', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '招聘中' : '已关闭'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, row) => (
        <Space size="small">
          <Switch
            size="small"
            checked={row.status === 1}
            checkedChildren="招聘"
            unCheckedChildren="关闭"
            onChange={(checked) => toggleStatus(row, checked ? 1 : 0)}
            disabled={!hasPerm('recruit:status')}
          />
          <Button type="link" size="small" onClick={() => openEdit(row)} disabled={!hasPerm('recruit:edit')}>
            编辑
          </Button>
          <Popconfirm title="确认删除？有投递记录时将禁止删除" onConfirm={() => remove(row)}>
            <Button type="link" size="small" danger disabled={!hasPerm('recruit:delete')}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索职位名称"
          allowClear
          style={{ width: 240 }}
          onSearch={(v) => {
            setKeyword(v)
            setPage(1)
          }}
        />
        <Radio.Group
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setPage(1)
          }}
        >
          <Radio.Button value={undefined}>全部</Radio.Button>
          <Radio.Button value={1}>社会招聘</Radio.Button>
          <Radio.Button value={2}>校园招聘</Radio.Button>
        </Radio.Group>
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
        title={editing ? '编辑职位' : '新增职位'}
        open={open}
        onOk={save}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        width={760}
        okText="保存"
      >
        <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 20 }}>
          <Form.Item name="title" label="职位名称" rules={[{ required: true, message: '请输入职位名称' }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value={1}>社会招聘</Radio.Button>
              <Radio.Button value={2}>校园招聘</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="location" label="工作地点" rules={[{ required: true, message: '请输入工作地点' }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="job_type" label="职位类型">
            <Select
              allowClear
              options={[
                { value: '全职', label: '全职' },
                { value: '实习', label: '实习' },
                { value: '校招', label: '校招' },
              ]}
            />
          </Form.Item>
          <Form.Item name="salary_range" label="薪资范围">
            <Input placeholder="如 15-25K" maxLength={50} />
          </Form.Item>
          <Form.Item name="is_urgent" label="急招">
            <Switch checkedChildren="急招" unCheckedChildren="普通" />
          </Form.Item>
          <Form.Item name="responsibility" label="岗位职责" valuePropName="html">
            <RichEditor />
          </Form.Item>
          <Form.Item name="requirement" label="任职要求" valuePropName="html">
            <RichEditor />
          </Form.Item>
          <Form.Item name="contact" label="投递邮箱" rules={[{ required: true, message: '请输入简历投递邮箱/联系方式' }]}>
            <Input placeholder="hr@stk.com" maxLength={200} />
          </Form.Item>
          <Form.Item name="status" label="招聘状态">
            <Radio.Group>
              <Radio.Button value={1}>招聘中</Radio.Button>
              <Radio.Button value={0}>已关闭</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function ApplicationTab() {
  const [list, setList] = useState<JobApplicationItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<number | undefined>()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<JobApplicationItem | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await applicationApi.list({ page, page_size: pageSize, status, keyword: keyword || undefined })
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

  const changeStatus = async (row: JobApplicationItem, target: number) => {
    await applicationApi.changeStatus(row.id, target)
    message.success('状态已更新')
    load()
  }
  const remove = async (row: JobApplicationItem) => {
    await applicationApi.remove(row.id)
    message.success('投递记录已删除')
    load()
  }
  const openDetail = async (row: JobApplicationItem) => {
    const res = await applicationApi.detail(row.id)
    setDetail(res)
  }
  // 导出：支持 CSV/Excel，携带当前筛选条件；文件名从响应头解析（中文兼容 RFC 5987）
  const doExport = async (fmt: 'csv' | 'excel') => {
    const resp: any = await applicationApi.export({ fmt, status, keyword: keyword || undefined })
    const blob = resp.data as Blob
    const filename = parseFileName(resp.headers?.['content-disposition'] ?? null, `简历投递导出.${fmt}`)
    downloadBlob(blob, filename)
  }

  const columns: ColumnsType<JobApplicationItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '应聘职位', dataIndex: 'job_title', ellipsis: true, render: (v) => v || '—' },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 160, render: (v) => v || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: number) => <Tag color={APP_STATUS[v].color}>{APP_STATUS[v].text}</Tag>,
    },
    { title: '投递时间', dataIndex: 'created_date', width: 160, render: (v: string) => v?.replace('T', ' ').slice(0, 19) },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, row) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => openDetail(row)}>
            详情
          </Button>
          {APP_ACTIONS[row.status]?.map((act) => (
            <Button
              key={act.target}
              type="link"
              size="small"
              onClick={() => changeStatus(row, act.target)}
              disabled={!hasPerm('application:status')}
            >
              {act.label}
            </Button>
          ))}
          <Popconfirm title="确认删除该投递记录？" onConfirm={() => remove(row)}>
            <Button type="link" size="small" danger disabled={!hasPerm('application:delete')}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索姓名/手机号"
          allowClear
          style={{ width: 220 }}
          onSearch={(v) => {
            setKeyword(v)
            setPage(1)
          }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 130 }}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={Object.entries(APP_STATUS).map(([k, v]) => ({ value: Number(k), label: v.text }))}
        />
        <Button icon={<DownloadOutlined />} onClick={() => doExport('csv')} disabled={!hasPerm('application:export')}>
          导出 CSV
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => doExport('excel')} disabled={!hasPerm('application:export')}>
          导出 Excel
        </Button>
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

      {/* 投递详情抽屉：展示完整信息 + 简历附件下载链接 */}
      <Drawer title="投递详情" open={!!detail} onClose={() => setDetail(null)} width={480}>
        {detail && (
          <>
            <p>
              <b>应聘职位：</b>
              {detail.job_title}
            </p>
            <p>
              <b>姓名：</b>
              {detail.name}
            </p>
            <p>
              <b>手机号：</b>
              {detail.phone}
            </p>
            <p>
              <b>邮箱：</b>
              {detail.email || '—'}
            </p>
            <p>
              <b>投递时间：</b>
              {detail.created_date?.replace('T', ' ').slice(0, 19)}
            </p>
            <p>
              <b>简历附件：</b>
              <a href={detail.resume_url} target="_blank" rel="noreferrer">
                {detail.resume_url.split('/').pop()}
              </a>
            </p>
            <p>
              <b>自我推荐：</b>
            </p>
            <div style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 6 }}>
              {detail.note || '无'}
            </div>
          </>
        )}
      </Drawer>
    </>
  )
}

export default function JobList() {
  return (
    <Card
      title="招聘管理"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
          刷新
        </Button>
      }
    >
      <Tabs
        defaultActiveKey="jobs"
        items={[
          { key: 'jobs', label: '职位管理', children: <JobTab /> },
          { key: 'applications', label: '简历投递', children: <ApplicationTab /> },
        ]}
      />
    </Card>
  )
}
