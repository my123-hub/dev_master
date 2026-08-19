// 门店管理页：单店信息编辑（本期仅一家上海旗舰店，不开放新增/删除，BR-43~46）
import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, message, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { storeApi, type StorePayload } from '@/api'
import { hasPerm } from '@/store/auth'

export default function StoreEdit() {
  const [form] = Form.useForm<StorePayload>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState<number | null>(null)

  // 加载唯一门店信息
  useEffect(() => {
    ;(async () => {
      try {
        const stores = await storeApi.list()
        if (stores.length === 0) {
          message.warning('尚未创建门店信息，请联系系统管理员')
          return
        }
        const s = stores[0]
        setStoreId(s.id)
        form.setFieldsValue({
          name: s.name,
          city: s.city,
          address: s.address,
          phone: s.phone,
          business_hours: s.business_hours ?? undefined,
          longitude: s.longitude ?? undefined,
          latitude: s.latitude ?? undefined,
          sort_order: s.sort_order,
        })
      } catch (e: any) {
        message.error(e?.message || '门店信息加载失败')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (!storeId) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      await storeApi.update(storeId, values)
      message.success('门店信息已更新')
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="门店管理" extra={<span style={{ color: '#999', fontSize: 12 }}>本期仅维护一家门店（上海旗舰店）</span>}>
      <Spin spinning={loading}>
        <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 12 }} style={{ maxWidth: 720 }}>
          <Form.Item name="name" label="门店名称" rules={[{ required: true, message: '请输入门店名称' }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="city" label="城市" rules={[{ required: true, message: '请输入城市' }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="address" label="门店地址" rules={[{ required: true, message: '请输入详细地址' }]}>
            <Input.TextArea rows={2} maxLength={255} placeholder="如：上海市黄浦区中山东一路 1 号" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="business_hours" label="营业时间">
            <Input placeholder="如 10:00 - 22:00" maxLength={100} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <Input type="number" />
          </Form.Item>
          <Form.Item label=" " colon={false}>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save} disabled={!hasPerm('store:edit')}>
              保存门店信息
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </Card>
  )
}
