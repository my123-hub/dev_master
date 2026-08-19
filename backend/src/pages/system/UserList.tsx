// 用户管理：列表 / 新增 / 编辑 / 停用启用 / 重置密码（BR-61）
// - 列表：关键字(登录名/姓名)搜索、角色筛选、启用状态筛选
// - 抽屉：新增/编辑（密码仅新增填写，强度校验在后端；所属部门/角色下拉）
// - 操作：编辑 / 停用启用 / 重置密码（弹窗展示新密码）
import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message,
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { systemApi, UserItem, RoleItem, DeptItem } from '@/api'
import { hasPerm } from '@/store/auth'

// 性别选项
const GENDER_OPTS = [
  { value: 0, label: '未知' },
  { value: 1, label: '男' },
  { value: 2, label: '女' },
]

export default function UserList() {
  const [list, setList] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [depts, setDepts] = useState<DeptItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<{ keyword?: string; role_id?: number; is_activate?: number }>({})
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<UserItem | null>(null)
  const [form] = Form.useForm()

  const canUser = hasPerm('system:user')

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const data = await systemApi.users({ page: p, page_size: 10, ...filters })
      setList(data.items)
      setTotal(data.total)
    } catch {
      /* 统一提示 */
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  // 角色 + 部门下拉数据
  useEffect(() => {
    systemApi.roles().then((d) => setRoles(d.items)).catch(() => {})
    systemApi.departments().then((d) => setDepts(d)).catch(() => {})
  }, [])

  const openDrawer = (item: UserItem | null) => {
    setEditing(item)
    form.resetFields()
    if (item) {
      form.setFieldsValue({ ...item, password: undefined })
    } else {
      form.setFieldsValue({ gender: 0, is_activate: 1 })
    }
    setDrawerOpen(true)
  }

  const onSave = async () => {
    const values = await form.validateFields() as any
    const payload: any = { ...values }
    if (editing) {
      delete payload.password // 编辑不修改密码
      await systemApi.updateUser(editing.id, payload)
      message.success('用户已更新')
    } else {
      await systemApi.createUser(payload)
      message.success('用户已创建')
    }
    setDrawerOpen(false)
    load(editing ? page : 1)
  }

  const onDisable = async (id: number) => {
    try {
      await systemApi.disableUser(id)
      message.success('用户已停用')
      load()
    } catch { /* 统一提示 */ }
  }

  const onResetPwd = async (id: number) => {
    try {
      const data = await systemApi.resetPassword(id)
      Modal.success({
        title: '密码重置成功',
        content: (
          <div>
            <p>新密码已生成，请尽快通知用户登录并修改：</p>
            <p style={{ fontWeight: 600, color: '#0F3D2E', letterSpacing: 1 }}>{data.new_password}</p>
          </div>
        ),
      })
    } catch { /* 统一提示 */ }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '登录名', dataIndex: 'username', width: 130 },
    { title: '姓名', dataIndex: 'name', width: 100, render: (v: string) => v || '—' },
    {
      title: '角色', dataIndex: 'role_name', width: 110,
      render: (v: string) => (v === 'super_admin'
        ? <Tag color="gold">超级管理员</Tag>
        : <Tag color="green">内容编辑</Tag>),
    },
    { title: '部门', dataIndex: 'dept_name', width: 110, render: (v: string) => v || '—' },
    { title: '手机号', dataIndex: 'mobile', width: 130, render: (v: string) => v || '—' },
    { title: '邮箱', dataIndex: 'email', width: 160, render: (v: string) => v || '—' },
    {
      title: '状态', dataIndex: 'is_activate', width: 90,
      render: (v: number, row: UserItem) => (
        <Space>
          <Tag color={v === 1 ? 'green' : 'red'}>{v === 1 ? '启用' : '停用'}</Tag>
          {row.must_change_pwd && <Tag color="orange">需改密</Tag>}
        </Space>
      ),
    },
    {
      title: '操作', width: 220,
      render: (_: unknown, row: UserItem) => (
        <Space size={0}>
          {canUser && <Button size="small" type="link" onClick={() => openDrawer(row)}>编辑</Button>}
          {canUser && row.is_activate === 1 && (
            <Popconfirm title="确认停用该用户？" description="停用后无法登录" onConfirm={() => onDisable(row.id)}>
              <Button size="small" type="link" danger>停用</Button>
            </Popconfirm>
          )}
          {canUser && row.is_activate === 0 && (
            <Button size="small" type="link" onClick={() => onToggleEnable(row)}>启用</Button>
          )}
          {canUser && (
            <Popconfirm title="确认重置密码？" description="将生成新随机密码" onConfirm={() => onResetPwd(row.id)}>
              <Button size="small" type="link" icon={<ReloadOutlined />}>重置密码</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // 启用（恢复 is_activate=1）
  const onToggleEnable = async (row: UserItem) => {
    try {
      await systemApi.updateUser(row.id, { is_activate: 1 })
      message.success('用户已启用')
      load()
    } catch { /* 统一提示 */ }
  }

  return (
    <Card
      title="用户管理"
      variant="borderless"
      extra={canUser && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>新增用户</Button>
      )}
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="全部角色"
          allowClear
          style={{ width: 150 }}
          options={roles.map((r) => ({ value: r.id, label: r.role_name === 'super_admin' ? '超级管理员' : '内容编辑' }))}
          onChange={(v) => { setFilters((f) => ({ ...f, role_id: v })); load(1) }}
        />
        <Select
          placeholder="全部状态"
          allowClear
          style={{ width: 120 }}
          options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]}
          onChange={(v) => { setFilters((f) => ({ ...f, is_activate: v })); load(1) }}
        />
        <Input.Search
          placeholder="登录名/姓名搜索"
          allowClear
          style={{ width: 220 }}
          onSearch={(v) => { setFilters((f) => ({ ...f, keyword: v })); load(1) }}
        />
      </Space>

      <Table
        rowKey="id" loading={loading} dataSource={list} columns={columns} size="middle"
        pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
      />

      <Drawer
        title={editing ? '编辑用户' : '新增用户'}
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={(
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={onSave}>保存</Button>
          </Space>
        )}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="登录名" rules={[{ required: true, message: '请输入登录名' }]}>
            <Input placeholder="登录名（唯一）" maxLength={50} disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="password" label="初始密码"
              extra="至少 8 位，含字母和数字；用户首次登录需修改"
              rules={[{ required: true, message: '请输入初始密码' }]}
            >
              <Input.Password placeholder="如 Test@123456" maxLength={64} />
            </Form.Item>
          )}
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="name" label="姓名" style={{ width: 240 }}>
              <Input placeholder="姓名" maxLength={50} />
            </Form.Item>
            <Form.Item name="nickname" label="昵称" style={{ width: 240 }}>
              <Input placeholder="昵称" maxLength={50} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="mobile" label="手机号" style={{ width: 240 }}>
              <Input placeholder="手机号" maxLength={20} />
            </Form.Item>
            <Form.Item name="email" label="邮箱" style={{ width: 240 }}>
              <Input placeholder="邮箱" maxLength={100} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="gender" label="性别" style={{ width: 150 }}>
              <Select options={GENDER_OPTS} />
            </Form.Item>
            <Form.Item name="position" label="岗位" style={{ width: 200 }}>
              <Input placeholder="岗位" maxLength={50} />
            </Form.Item>
            <Form.Item name="role_id" label="角色" rules={[{ required: true, message: '请选择角色' }]} style={{ width: 150 }}>
              <Select options={roles.map((r) => ({ value: r.id, label: r.role_name === 'super_admin' ? '超级管理员' : '内容编辑' }))} />
            </Form.Item>
          </Space>
          <Form.Item name="dept_id" label="部门">
            <Select
              allowClear
              placeholder="选择部门（可选）"
              options={depts.map((d) => ({ value: d.id, label: d.dept_name }))}
            />
          </Form.Item>
          {editing && (
            <Form.Item name="is_activate" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          )}
        </Form>
      </Drawer>
    </Card>
  )
}
