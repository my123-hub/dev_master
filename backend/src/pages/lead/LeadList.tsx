// 留资管理页：预约 Tab（筛选/详情/状态流转可回退/删除/导出）+ 留言 Tab（标记处理/删除/导出）（BR-52~60）
import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import {
  downloadBlob,
  leadApi,
  parseFileName,
  type AppointmentItem,
  type MessageItem,
} from '@/api'
import { hasPerm } from '@/store/auth'

// 预约状态机标签与合法跃迁（BR-54 可回退：0→1→2→3，1→0）
const APPT_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待处理', color: 'orange' },
  1: { text: '已联系', color: 'blue' },
  2: { text: '已到店', color: 'purple' },
  3: { text: '已关闭', color: 'default' },
}
const APPT_ACTIONS: Record<number, { target: number; label: string }[]> = {
  0: [{ target: 1, label: '标记已联系' }],
  1: [
    { target: 0, label: '回退待处理' },
    { target: 2, label: '标记到店' },
    { target: 3, label: '关闭' },
  ],
  2: [{ target: 3, label: '结束关闭' }],
}

function AppointmentTab() {
  const [list, setList] = useState<AppointmentItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<AppointmentItem | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await leadApi.appointments({
        page,
        page_size: pageSize,
        status,
        date_from: dateRange?.[0]?.format('YYYY-MM-DD'),
        date_to: dateRange?.[1]?.format('YYYY-MM-DD'),
        keyword: keyword || undefined,
      })
      setList(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, dateRange])

  const changeStatus = async (row: AppointmentItem, target: number) => {
    await leadApi.changeAppointmentStatus(row.id, target)
    message.success('状态已更新')
    load()
  }
  const remove = async (row: AppointmentItem) => {
    await leadApi.removeAppointment(row.id)
    message.success('预约记录已删除')
    load()
  }
  const openDetail = async (row: AppointmentItem) => {
    const res = await leadApi.appointmentDetail(row.id)
    setDetail(res)
  }
  const doExport = async (fmt: 'csv' | 'excel') => {
    const resp: any = await leadApi.exportAppointments({
      fmt,
      status,
      date_from: dateRange?.[0]?.format('YYYY-MM-DD'),
      date_to: dateRange?.[1]?.format('YYYY-MM-DD'),
      keyword: keyword || undefined,
    })
    const blob = resp.data as Blob
    const filename = parseFileName(resp.headers?.['content-disposition'] ?? null, `预约导出.${fmt}`)
    downloadBlob(blob, filename)
  }

  const columns: ColumnsType<AppointmentItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '门店', dataIndex: 'store_name', width: 120 },
    {
      title: '预约时间',
      dataIndex: 'appointment_date',
      width: 160,
      render: (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—'),
    },
    { title: '意向', dataIndex: 'intention', ellipsis: true, render: (v) => v || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: number) => <Tag color={APPT_STATUS[v].color}>{APPT_STATUS[v].text}</Tag>,
    },
    { title: '提交时间', dataIndex: 'created_date', width: 160, render: (v: string) => v?.replace('T', ' ').slice(0, 19) },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_, row) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => openDetail(row)}>
            详情
          </Button>
          {APPT_ACTIONS[row.status]?.map((act) => (
            <Button
              key={act.target}
              type="link"
              size="small"
              onClick={() => changeStatus(row, act.target)}
              disabled={!hasPerm('lead:status')}
            >
              {act.label}
            </Button>
          ))}
          <Popconfirm title="确认删除该预约？" onConfirm={() => remove(row)}>
            <Button type="link" size="small" danger disabled={!hasPerm('lead:delete')}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索姓名/手机号"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => {
            setKeyword(v)
            setPage(1)
          }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 120 }}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={Object.entries(APPT_STATUS).map(([k, v]) => ({ value: Number(k), label: v.text }))}
        />
        <DatePicker.RangePicker
          value={dateRange as any}
          onChange={(v) => {
            setDateRange(v as any)
            setPage(1)
          }}
        />
        <Button icon={<DownloadOutlined />} onClick={() => doExport('csv')} disabled={!hasPerm('lead:export')}>
          导出 CSV
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => doExport('excel')} disabled={!hasPerm('lead:export')}>
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

      <Drawer title="预约详情" open={!!detail} onClose={() => setDetail(null)} width={480}>
        {detail && (
          <>
            <p>
              <b>姓名：</b>
              {detail.name}
            </p>
            <p>
              <b>手机号：</b>
              {detail.phone}
            </p>
            <p>
              <b>门店：</b>
              {detail.store_name}
            </p>
            <p>
              <b>预约到店：</b>
              {detail.appointment_date ? detail.appointment_date.replace('T', ' ').slice(0, 16) : '—'}
            </p>
            <p>
              <b>意向产品/系列：</b>
              {detail.intention || '—'}
            </p>
            <p>
              <b>备注：</b>
            </p>
            <div style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 6 }}>
              {detail.remark || '无'}
            </div>
            <p style={{ marginTop: 12 }}>
              <b>提交时间：</b>
              {detail.created_date?.replace('T', ' ').slice(0, 19)}
            </p>
          </>
        )}
      </Drawer>
    </>
  )
}

function MessageTab() {
  const [list, setList] = useState<MessageItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<number | undefined>()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await leadApi.messages({ page, page_size: pageSize, status, keyword: keyword || undefined })
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

  const markHandled = async (row: MessageItem) => {
    await leadApi.changeMessageStatus(row.id, 1)
    message.success('已标记处理')
    load()
  }
  const remove = async (row: MessageItem) => {
    await leadApi.removeMessage(row.id)
    message.success('留言已删除')
    load()
  }
  const doExport = async (fmt: 'csv' | 'excel') => {
    const resp: any = await leadApi.exportMessages({ fmt, status, keyword: keyword || undefined })
    const blob = resp.data as Blob
    const filename = parseFileName(resp.headers?.['content-disposition'] ?? null, `留言导出.${fmt}`)
    downloadBlob(blob, filename)
  }

  const columns: ColumnsType<MessageItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 160, render: (v) => v || '—' },
    { title: '留言内容', dataIndex: 'content', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: number) => <Tag color={v === 0 ? 'orange' : 'green'}>{v === 0 ? '待处理' : '已处理'}</Tag>,
    },
    { title: '提交时间', dataIndex: 'created_date', width: 160, render: (v: string) => v?.replace('T', ' ').slice(0, 19) },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, row) => (
        <Space size="small">
          {row.status === 0 && (
            <Button type="link" size="small" onClick={() => markHandled(row)} disabled={!hasPerm('lead:status')}>
              标记处理
            </Button>
          )}
          <Popconfirm title="确认删除该留言？" onConfirm={() => remove(row)}>
            <Button type="link" size="small" danger disabled={!hasPerm('lead:delete')}>
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
          style={{ width: 200 }}
          onSearch={(v) => {
            setKeyword(v)
            setPage(1)
          }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 120 }}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={[
            { value: 0, label: '待处理' },
            { value: 1, label: '已处理' },
          ]}
        />
        <Button icon={<DownloadOutlined />} onClick={() => doExport('csv')} disabled={!hasPerm('lead:export')}>
          导出 CSV
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => doExport('excel')} disabled={!hasPerm('lead:export')}>
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
    </>
  )
}

export default function LeadList() {
  return (
    <Card
      title="留资管理"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
          刷新
        </Button>
      }
    >
      <Tabs
        defaultActiveKey="appointments"
        items={[
          { key: 'appointments', label: '在线预约', children: <AppointmentTab /> },
          { key: 'messages', label: '在线留言', children: <MessageTab /> },
        ]}
      />
    </Card>
  )
}
