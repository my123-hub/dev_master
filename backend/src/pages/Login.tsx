// 登录页：墨玉翡翠风格（全站禁用蓝色）
import { useState } from 'react'
import { Button, Card, Form, Input, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api'
import { setToken, setUser } from '@/store/auth'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const data = await authApi.login(values.username, values.password)
      setToken(data.access_token)
      // 拉取用户信息（含权限点）用于菜单显隐
      const user = await authApi.me()
      setUser(user)
      message.success('登录成功')
      // 首次登录强制改密（BR-06）
      if (data.must_change_pwd) {
        navigate('/password', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch {
      // 错误提示已由请求层统一处理
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0F3D2E 0%, #0A2F23 60%, #081F18 100%)',
      }}
    >
      <Card
        style={{ width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.35)', borderRadius: 12 }}
        styles={{ body: { padding: '32px 36px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F3D2E', letterSpacing: 3 }}>
            STK 本然家居
          </div>
          <div style={{ color: '#C9A86A', marginTop: 6, fontSize: 13, letterSpacing: 2 }}>
            后台管理系统
          </div>
        </div>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} style={{ marginTop: 8 }}>
            登 录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
