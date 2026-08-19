// 角色权限：角色列表 + 权限点勾选式配置（BR-62，服务端强制 NFR-07）
// - 权限点按菜单分组（menu_key）展示，勾选即授权
// - 内置「超级管理员」角色权限不可修改（后端返回 is_builtin 并拦截）
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Checkbox, Drawer, Empty, Space, Table, Tag, Typography, message } from 'antd'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import { systemApi, RoleItem, PermissionCatalogItem } from '@/api'
import { hasPerm } from '@/store/auth'

// 菜单 key → 中文分组名（与后端权限点全量清单一致，M6-4）
const MENU_LABELS: Record<string, string> = {
  dashboard: '工作台',
  product: '产品管理',
  case: '案例管理',
  news: '新闻管理',
  recruit: '招聘管理',
  application: '简历投递',
  content: '内容管理',
  store: '门店管理',
  home: '首页配置',
  lead: '留资管理',
  system: '系统管理',
}

// 排序：让展示顺序稳定
const MENU_ORDER = ['dashboard', 'product', 'case', 'news', 'recruit', 'application', 'content', 'store', 'home', 'lead', 'system']

export default function RoleList() {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<RoleItem | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const canRole = hasPerm('system:role')

  const load = () => {
    setLoading(true)
    systemApi.roles().then((d) => {
      setRoles(d.items)
      setCatalog(d.permissions)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // 按 menu_key 分组后的权限点
  const grouped = useMemo(() => {
    const map: Record<string, PermissionCatalogItem[]> = {}
    for (const p of catalog) {
      const key = p.menu_key || 'other'
      ;(map[key] ||= []).push(p)
    }
    // 按固定顺序输出
    return MENU_ORDER.filter((k) => map[k]).map((k) => ({ key: k, label: MENU_LABELS[k] || k, items: map[k] }))
      .concat(Object.keys(map).filter((k) => !MENU_ORDER.includes(k))
        .map((k) => ({ key: k, label: k, items: map[k] })))
  }, [catalog])

  const openConfig = (role: RoleItem) => {
    setEditing(role)
    setSelected([...role.permissions])
    setDrawerOpen(true)
  }

  // 切换某一组的全选/全不选
  const toggleGroup = (groupCodes: string[], checked: boolean) => {
    setSelected((prev) => {
      const rest = prev.filter((c) => !groupCodes.includes(c))
      return checked ? [...rest, ...groupCodes] : rest
    })
  }

  // 切换单条权限
  const toggleOne = (code: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, code] : prev.filter((c) => c !== code)))
  }

  const onSave = async () => {
    if (!editing) return
    try {
      await systemApi.updateRole(editing.id, { permission_codes: selected })
      message.success('角色权限已更新')
      setDrawerOpen(false)
      load()
    } catch { /* 统一提示 */ }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '角色名称', dataIndex: 'role_name', width: 160,
      render: (v: string, row: RoleItem) => (
        <Space>
          <Typography.Text strong>{v === 'super_admin' ? '超级管理员' : '内容编辑'}</Typography.Text>
          {row.is_builtin && <Tag color="gold">内置</Tag>}
        </Space>
      ),
    },
    { title: '说明', dataIndex: 'remark', width: 240, render: (v: string) => v || '—' },
    {
      title: '权限点数量', dataIndex: 'permissions', width: 120,
      render: (v: string[]) => <Tag color="green">{v.length}</Tag>,
    },
    {
      title: '操作', width: 140,
      render: (_: unknown, row: RoleItem) => (
        canRole && !row.is_builtin ? (
          <Button size="small" type="link" icon={<SafetyCertificateOutlined />} onClick={() => openConfig(row)}>
            配置权限
          </Button>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        )
      ),
    },
  ]

  return (
    <Card title="角色权限" variant="borderless">
      <Table rowKey="id" loading={loading} dataSource={roles} columns={columns} size="middle" pagination={false} />

      <Drawer
        title={editing ? `配置权限：${editing.role_name === 'super_admin' ? '超级管理员' : '内容编辑'}` : '配置权限'}
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
        {grouped.length === 0 ? (
          <Empty description="暂无权限点" />
        ) : (
          grouped.map((g) => {
            const groupCodes = g.items.map((i) => i.perm_code)
            const checkedCount = groupCodes.filter((c) => selected.includes(c)).length
            const allChecked = checkedCount === groupCodes.length
            const indeterminate = checkedCount > 0 && !allChecked
            return (
              <div key={g.key} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Typography.Text strong>{g.label}</Typography.Text>
                  <Checkbox
                    checked={allChecked}
                    indeterminate={indeterminate}
                    onChange={(e) => toggleGroup(groupCodes, e.target.checked)}
                  >
                    全选
                  </Checkbox>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', paddingLeft: 8 }}>
                  {g.items.map((p) => (
                    <Checkbox
                      key={p.perm_code}
                      checked={selected.includes(p.perm_code)}
                      onChange={(e) => toggleOne(p.perm_code, e.target.checked)}
                    >
                      {p.perm_name || p.perm_code}
                      <Typography.Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
                        {p.perm_code}
                      </Typography.Text>
                    </Checkbox>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </Drawer>
    </Card>
  )
}
