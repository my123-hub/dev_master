// 工作台：统计概览卡片（BR-07/08）
// 本期 M2 展示产品/新闻等基础统计，后续 M3 扩展案例/留资
import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic } from 'antd'
import { AppstoreOutlined, ReadOutlined, HomeOutlined, TagsOutlined } from '@ant-design/icons'
import { bannerApi, categoryApi, newsApi, productApi } from '@/api'

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, categories: 0, news: 0, banners: 0 })

  useEffect(() => {
    // 并行拉取各模块总数（工作台概览，BR-08）
    Promise.all([
      productApi.list({ page: 1, page_size: 1 }),
      categoryApi.list({ page: 1, page_size: 1 }),
      newsApi.list({ page: 1, page_size: 1 }),
      bannerApi.list(),
    ])
      .then(([p, c, n, b]) =>
        setStats({ products: p.total, categories: c.total, news: n.total, banners: b.length }),
      )
      .catch(() => {})
  }, [])

  const cards = [
    { title: '产品总数', value: stats.products, icon: <AppstoreOutlined />, color: '#0F3D2E' },
    { title: '产品系列', value: stats.categories, icon: <TagsOutlined />, color: '#C9A86A' },
    { title: '新闻文章', value: stats.news, icon: <ReadOutlined />, color: '#5B8A72' },
    { title: '首页轮播', value: stats.banners, icon: <HomeOutlined />, color: '#8A6A3B' },
  ]

  return (
    <div>
      <Row gutter={16}>
        {cards.map((c) => (
          <Col span={6} key={c.title}>
            <Card variant="borderless">
              <Statistic
                title={c.title}
                value={c.value}
                prefix={<span style={{ color: c.color, marginRight: 8, fontSize: 20 }}>{c.icon}</span>}
                valueStyle={{ color: '#0F3D2E', fontWeight: 600 }}
              />
            </Card>
          </Col>
        ))}
      </Row>
      <Card variant="borderless" style={{ marginTop: 16 }}>
        <div style={{ color: '#0F3D2E', fontWeight: 600, marginBottom: 8 }}>操作指引</div>
        <ul style={{ color: '#666', lineHeight: 2, paddingLeft: 18 }}>
          <li>产品管理 → 先维护「产品系列」，再录入产品（编号唯一，图片先经上传组件获取 URL）</li>
          <li>新闻管理 → 可管理栏目（内置企业新闻/行业资讯）与文章（草稿/发布/置顶）</li>
          <li>内容管理 → 单页富文本、发展历程时间轴、FAQ 手风琴</li>
          <li>首页配置 → 轮播图与品牌标语/亮点文案</li>
        </ul>
      </Card>
    </div>
  )
}
