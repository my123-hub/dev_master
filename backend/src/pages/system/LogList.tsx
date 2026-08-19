// 操作日志：只读分页查询（BR-63），按模块/动作/关键字/时间筛选
// - 日志由关键操作自动记录，后台仅提供查询，不可修改删除
import { useCallback, useEffect, useState } from 'react'
import { Card, DatePicker, Input, Select, Space, Table, Tag } from 'antd'
import type { Dayjs } from 'dayjs'
import { systemApi, LogItem } from '@/api'
import { hasPerm } from '@/store/auth'

const { RangePicker } = DatePicker

// 模块中文映射（与后端 module 值对应）
const MODULE_LABELS: Record<string, string> = {
  product: '产品', case: '案例', news: '新闻', recruit: '招聘',
  content: '内容', store: '门店', home: '首页配置', lead: '留资',
  system: '系统', application: '简历投递',
}
// 动作中文映射
const ACTION_LABELS: Record<string, string> = {
  create: '新增', update: '编辑', delete: '删除', status: '状态流转', export: '导出', login: '登录',
}
const ACTION_COLOR: Record<string, string> = {
  create: 'green', update: 'blue', delete: 'red', status: 'gold', export: 'default', login: 'geekblue',
}

export default function LogList() {
  const [list, setList] = useState<LogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<{ module?: string; action?: string; keyword?: string; date_from?: string; date_to?: string }>({})
  const [loading, setLoading] = useState(false)

  const canLog = hasPerm('system:log')

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const data = await systemApi.logs({ page: p, page_size: 10, ...filters })
      setList(data.items)
      setTotal(data.total)
    } catch {
      /* 统一提示 */
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  const apply = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
    // 立即重载（filters 变化触发 useEffect）
    setTimeout(() => load(1), 0)
  }

  const onDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      apply({ date_from: dates[0].format('YYYY-MM-DD'), date_to: dates[1].format('YYYY-MM-DD') })
    } else {
      apply({ date_from: undefined, date_to: undefined })
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '操作人', dataIndex: 'username', width: 110, render: (v: string) => v || '系统' },
    {
      title: '模块', dataIndex: 'module', width: 110,
      render: (v: string) => <Tag>{MODULE_LABELS[v] || v || '—'}</Tag>,
    },
    {
      title: '动作', dataIndex: 'action', width: 100,
      render: (v: string) => <Tag color={ACTION_COLOR[v] || 'default'}>{ACTION_LABELS[v] || v || '—'}</Tag>,
    },
    { title: '操作详情', dataIndex: 'detail', render: (v: string) => v || '—' },
    { title: '来源 IP', dataIndex: 'ip', width: 130, render: (v: string) => v || '—' },
    { title: '时间', dataIndex: 'created_date', width: 180 },
  ]

  return (
    <Card title="操作日志" variant="borderless">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="全部模块"
          allowClear
          style={{ width: 140 }}
          options={Object.entries(MODULE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          onChange={(v) => apply({ module: v })}
        />
        <Select
          placeholder="全部动作"
          allowClear
          style={{ width: 140 }}
          options={Object.entries(ACTION_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          onChange={(v) => apply({ action: v })}
        />
        <Input.Search
          placeholder="操作详情搜索"
          allowClear
          style={{ width: 220 }}
          onSearch={(v) => apply({ keyword: v })}
        />
        <RangePicker placeholder={['开始日期', '结束日期']} onChange={onDateChange} />
      </Space>

      <Table
        rowKey="id" loading={loading} dataSource={list} columns={columns} size="middle"
        pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
      />
    </Card>
  )
}
