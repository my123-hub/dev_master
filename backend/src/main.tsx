// 应用入口：AntD 主题（墨玉翡翠）+ 路由挂载
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import 'antd/dist/reset.css'

// 墨玉翡翠视觉规范（UI-UX §2.1）：
// 主色深绿 #0F3D2E、辅助香槟金 #C9A86A；全站禁用蓝色（原 AntD 默认蓝 #1677ff 被覆盖）
const theme = {
  token: {
    colorPrimary: '#0F3D2E',            // 主色：深绿（替代 AntD 默认蓝）
    colorInfo: '#0F3D2E',
    colorLink: '#0F3D2E',
    colorSuccess: '#0F3D2E',
    colorWarning: '#C9A86A',            // 香槟金：警示/强调
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Layout: {
      siderBg: '#0F3D2E',               // 侧边栏深墨绿（UI-UX §6.1）
      headerBg: '#ffffff',
    },
    Menu: {
      darkItemBg: '#0F3D2E',
      darkSubMenuItemBg: '#0A2F23',     // 子菜单更深一档
      darkItemSelectedBg: '#C9A86A',    // 选中项香槟金
      darkItemSelectedColor: '#0F3D2E',
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
