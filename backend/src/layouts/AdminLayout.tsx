// 后台主布局：手风琴二级导航 + 顶栏 + 内容区（UI-UX §6 核心规范）
// - 侧边栏深墨绿 #0F3D2E，菜单手风琴（同组仅展开当前父级）
// - 顶栏：面包屑 + 用户信息（角色标签 + 登出）
// - 权限入口：菜单按权限点显隐（hasPerm，仅视觉，服务端强制 NFR-07）
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Layout, Menu, Breadcrumb, Dropdown, Tag, Avatar } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  ReadOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  UserOutlined,
  CameraOutlined,
  TeamOutlined,
  ShopOutlined,
  InboxOutlined,
  SettingOutlined,
  KeyOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getUser, hasPerm, logout } from '@/store/auth'

const { Sider, Header, Content } = Layout

// 菜单项类型：key 即路由路径；需要权限点的项用 perm 标注（子项也可带 perm）
interface MenuItem {
  key: string
  icon?: ReactNode
  label: string
  perm?: string
  children?: MenuItem[]
}

// 菜单配置：key 即路由路径；需要权限点的项用 perm 标注
const MENU: MenuItem[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '工作台',
    perm: 'dashboard:view',
  },
  {
    key: '/products',
    icon: <AppstoreOutlined />,
    label: '产品管理',
    perm: 'product:view',
    children: [
      { key: '/products/categories', label: '产品系列' },
      { key: '/products', label: '产品管理' },
    ],
  },
  {
    key: '/cases',
    icon: <CameraOutlined />,
    label: '案例管理',
    perm: 'case:view',
  },
  {
    key: '/news',
    icon: <ReadOutlined />,
    label: '新闻管理',
    perm: 'news:view',
  },
  {
    key: '/recruit',
    icon: <TeamOutlined />,
    label: '招聘管理',
    perm: 'recruit:view',
  },
  {
    key: '/content',
    icon: <FileTextOutlined />,
    label: '内容管理',
    perm: 'content:view',
    children: [
      { key: '/content/pages', label: '单页内容' },
      { key: '/content/milestones', label: '发展历程' },
      { key: '/content/faqs', label: '常见问题 FAQ' },
    ],
  },
  {
    key: '/store',
    icon: <ShopOutlined />,
    label: '门店管理',
    perm: 'store:view',
  },
  {
    key: '/leads',
    icon: <InboxOutlined />,
    label: '留资管理',
    perm: 'lead:view',
  },
  {
    key: '/home',
    icon: <HomeOutlined />,
    label: '首页配置',
    perm: 'home:view',
  },
  {
    key: '/system',
    icon: <SettingOutlined />,
    label: '系统管理',
    perm: 'system:user',
    children: [
      { key: '/system/users', label: '用户管理', perm: 'system:user' },
      { key: '/system/roles', label: '角色权限', perm: 'system:role' },
      { key: '/system/logs', label: '操作日志', perm: 'system:log' },
    ],
  },
]

/** 按权限过滤菜单（无权限点要求的菜单项始终可见；子项同样按权限显隐） */
function filterByPerm(items: MenuItem[]): MenuItem[] {
  return items
    .filter((m) => !m.perm || hasPerm(m.perm))
    .map((m) => (m.children
      ? { ...m, children: m.children.filter((c) => !c.perm || hasPerm(c.perm)) }
      : m))
}

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getUser()
  // 手风琴受控：只保留当前路径所属父级展开（UI-UX §6.2）
  const [openKeys, setOpenKeys] = useState<string[]>([])

  const menus = useMemo(() => filterByPerm(MENU), [])

  // 根据当前路径计算应展开的父级
  const currentParent = useMemo(() => {
    const found = MENU.find((m) => m.children?.some((c) => c.key === location.pathname))
    return found ? [found.key] : []
  }, [location.pathname])

  // 当前选中菜单项
  const selectedKey = useMemo(() => {
    if (location.pathname === '/') return '/dashboard'
    return location.pathname
  }, [location.pathname])

  // 面包屑文案：父级 + 当前项
  const crumbs = useMemo(() => {
    const parent = MENU.find((m) => m.children?.some((c) => c.key === location.pathname))
    const leaf = parent?.children?.find((c) => c.key === location.pathname)
    const direct = MENU.find((m) => m.key === location.pathname)
    if (parent && leaf) return [parent.label, leaf.label]
    if (direct) return [direct.label]
    return ['后台管理']
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧深墨绿侧边栏 */}
      <Sider width={220} theme="dark">
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#C9A86A',
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: 2,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          STK 本然家居
        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={menus as any}
          selectedKeys={[selectedKey]}
          // 手风琴：openKeys 受控，只保留当前父级
          openKeys={currentParent}
          onOpenChange={(keys) => setOpenKeys(keys)}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        {/* 顶栏：面包屑 + 用户 */}
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Breadcrumb items={crumbs.map((c) => ({ title: c }))} />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: '#0F3D2E' }} />
              <span>{user?.name || user?.username}</span>
              {user?.role_name && (
                <Tag color="green" style={{ marginInlineEnd: 0 }}>
                  {user.role_name === 'super_admin' ? '超级管理员' : '内容编辑'}
                </Tag>
              )}
            </div>
          </Dropdown>
        </Header>

        {/* 内容区：浅灰底 + 白色卡片（UI-UX §6.1） */}
        <Content style={{ margin: 16, background: '#f0f2f5', minHeight: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
