// 首页配置：轮播图 CRUD + 品牌标语/亮点文案（BR-47~51）
// - 轮播表：图片/标题/副标题/跳转链接/排序/启停
// - 配置区：brand.slogan 品牌标语、highlight.title_1~3 亮点、contact.* 联系信息（BR-42/51）
import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Col, Drawer, Form, Input, InputNumber, Popconfirm, Row, Space, Switch, Table, Tag, message,
} from 'antd'
import { PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { BannerItem, ConfigItem, bannerApi, configApi } from '@/api'
import { hasPerm } from '@/store/auth'
import ImageUpload from '@/components/ImageUpload'

export default function HomeConfig() {
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<BannerItem | null>(null)
  const [form] = Form.useForm()
  // 配置表单：键值对（初始化自后端 /config）
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [configSaving, setConfigSaving] = useState(false)

  const canEdit = hasPerm('home:edit')

  // 配置项表单定义：键 / 中文标签 / 说明
  const CONFIG_FIELDS: { key: string; label: string; hint: string }[] = [
    { key: 'brand.slogan', label: '品牌标语（Slogan）', hint: '首页主标语' },
    { key: 'brand.sub_slogan', label: '品牌副标语', hint: '首页副标语' },
    { key: 'highlight.title_1', label: '亮点文案 1', hint: '首页三大亮点标题' },
    { key: 'highlight.desc_1', label: '亮点描述 1', hint: '亮点 1 描述' },
    { key: 'highlight.title_2', label: '亮点文案 2', hint: '' },
    { key: 'highlight.desc_2', label: '亮点描述 2', hint: '' },
    { key: 'highlight.title_3', label: '亮点文案 3', hint: '' },
    { key: 'highlight.desc_3', label: '亮点描述 3', hint: '' },
    { key: 'contact.phone', label: '客服电话', hint: '前台联系展示' },
    { key: 'contact.email', label: '客服邮箱', hint: '' },
    { key: 'contact.address', label: '门店地址', hint: '前台页脚/联系展示' },
  ]

  const load = useCallback(() => {
    setLoading(true)
    bannerApi.list().then(setBanners).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const loadConfig = useCallback(() => {
    configApi.list().then((items) => {
      const map: Record<string, string> = {}
      items.forEach((i) => { map[i.config_key] = i.config_value ?? '' })
      setConfigs(map)
    }).catch(() => {})
  }, [])

  useEffect(() => { load(); loadConfig() }, [load, loadConfig])

  const openDrawer = (item: BannerItem | null) => {
    setEditing(item)
    form.resetFields()
    if (item) form.setFieldsValue(item)
    setDrawerOpen(true)
  }

  const onSaveBanner = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await bannerApi.update(editing.id, values)
        message.success('轮播已更新')
      } else {
        await bannerApi.create(values)
        message.success('轮播已创建')
      }
      setDrawerOpen(false)
      load()
    } catch { /* 统一提示 */ }
  }

  const onDeleteBanner = async (id: number) => {
    try {
      await bannerApi.remove(id)
      message.success('已删除')
      load()
    } catch { /* 统一提示 */ }
  }

  const onToggleBanner = async (row: BannerItem) => {
    try {
      await bannerApi.changeStatus(row.id, row.is_activate === 1 ? 0 : 1)
      message.success('状态已更新')
      load()
    } catch { /* 统一提示 */ }
  }

  const onSaveConfig = async () => {
    setConfigSaving(true)
    try {
      const items: ConfigItem[] = CONFIG_FIELDS
        .filter((f) => configs[f.key] !== undefined)
        .map((f) => ({ config_key: f.key, config_value: configs[f.key] || '' }))
      await configApi.save(items)
      message.success('配置已保存')
    } catch { /* 统一提示 */ } finally {
      setConfigSaving(false)
    }
  }

  const bannerColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '图片', dataIndex: 'image_url', width: 120,
      render: (v: string) => <img src={v} alt="" style={{ width: 96, height: 48, objectFit: 'cover', borderRadius: 4 }} />,
    },
    { title: '标题', dataIndex: 'title', width: 160, render: (v: string) => v || '—' },
    { title: '副标题', dataIndex: 'subtitle', ellipsis: true, render: (v: string) => v || '—' },
    { title: '跳转', dataIndex: 'link_url', width: 140, ellipsis: true, render: (v: string) => v || '—' },
    { title: '排序', dataIndex: 'sort_order', width: 70 },
    {
      title: '状态', dataIndex: 'is_activate', width: 80,
      render: (v: number) => (v === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作', width: 180,
      render: (_: unknown, row: BannerItem) => (
        <Space size={0}>
          {canEdit && <Button size="small" type="link" onClick={() => openDrawer(row)}>编辑</Button>}
          {canEdit && (
            <Button size="small" type="link" onClick={() => onToggleBanner(row)}>
              {row.is_activate === 1 ? '停用' : '启用'}
            </Button>
          )}
          {canEdit && (
            <Popconfirm title="确认删除该轮播？" onConfirm={() => onDeleteBanner(row.id)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 轮播管理 */}
      <Card
        title="首页轮播图"
        variant="borderless"
        extra={canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>新增轮播</Button>
        )}
      >
        <Table rowKey="id" loading={loading} dataSource={banners} columns={bannerColumns} size="middle"
          pagination={false} />
      </Card>

      {/* 品牌标语/亮点/联系信息（sys_config） */}
      <Card
        title="品牌标语 / 亮点文案 / 联系信息"
        variant="borderless"
        style={{ marginTop: 16 }}
        extra={canEdit && (
          <Button type="primary" icon={<SaveOutlined />} loading={configSaving} onClick={onSaveConfig}>
            保存配置
          </Button>
        )}
      >
        <Row gutter={16}>
          {CONFIG_FIELDS.map((f) => (
            <Col span={12} key={f.key}>
              <Form.Item label={`${f.label}（${f.key}）`} style={{ marginBottom: 12 }}>
                <Input
                  value={configs[f.key] ?? ''}
                  disabled={!canEdit}
                  placeholder={f.hint}
                  onChange={(e) => setConfigs((c) => ({ ...c, [f.key]: e.target.value }))}
                />
              </Form.Item>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 轮播编辑抽屉 */}
      <Drawer title={editing ? '编辑轮播' : '新增轮播'} width={460} open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Space><Button onClick={() => setDrawerOpen(false)}>取消</Button><Button type="primary" onClick={onSaveBanner}>保存</Button></Space>}>
        <Form form={form} layout="vertical">
          <Form.Item name="image_url" label="轮播图片" rules={[{ required: true, message: '请上传图片' }]} valuePropName="src">
            <ImageUpload max={1} />
          </Form.Item>
          <Form.Item name="title" label="标题">
            <Input placeholder="如：秋季新品系列" maxLength={100} />
          </Form.Item>
          <Form.Item name="subtitle" label="副标题">
            <Input placeholder="副标题" maxLength={200} />
          </Form.Item>
          <Form.Item name="link_url" label="跳转链接" extra="可跳转产品/新闻详情或外部链接（可选）">
            <Input placeholder="/products/1 或 https://…" maxLength={255} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序（小在前）" initialValue={0}>
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
