// 强制修改密码页（BR-06）：首次登录必须改密后才能使用后台功能
import { useState } from 'react'
import { Button, Card, Form, Input, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api'
import { getUser, setUser } from '@/store/auth'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { old_password: string; new_password: string }) => {
    setLoading(true)
    try {
      await authApi.changePassword(values.old_password, values.new_password)
      message.success('密码修改成功，请使用新密码登录')
      // 更新本地 must_change_pwd 标记
      const user = getUser()
      if (user) {
        setUser({ ...user, must_change_pwd: false })
      }
      navigate('/dashboard', { replace: true })
    } catch {
      // 错误已由请求层统一提示
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
        title="首次登录 · 修改密码"
        style={{ width: 420, boxShadow: '0 12px 40px rgba(0,0,0,0.35)', borderRadius: 12 }}
        styles={{ body: { padding: '24px 32px' } }}
      >
        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="old_password"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="原密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少 8 位' },
              {
                pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                message: '需同时包含字母和数字',
              },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 8 位，含字母和数字）" />
          </Form.Item>
          <Form.Item
            name="confirm"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve()
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            确认修改
          </Button>
        </Form>
      </Card>
    </div>
  )
}
