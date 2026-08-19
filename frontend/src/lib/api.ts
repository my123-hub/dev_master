// 前台请求层：fetch 封装
// - baseURL 统一 /api（开发期 Vite proxy 转发到后端，生产同域）
// - 后端统一响应 {code, message, data}；code=0 成功，非 0 抛出业务错误
// - 前台全部为公开接口，无需 token

// 后端统一响应结构（开发技术文档 §1.3.1）
export interface ApiResult<T = any> {
  code: number
  message: string
  data: T
}

// 分页数据结构
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

/** 业务错误：携带后端返回的 code 与 message */
export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** 表单文件上传：FormData（不设 Content-Type，由浏览器自动带 boundary） */
  formData?: FormData
}

/** 统一请求：解析 {code, message, data}；code!=0 抛 ApiError */
export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, formData } = options
  const reqInit: RequestInit = { method, headers }
  if (formData) {
    reqInit.body = formData
  } else if (body !== undefined) {
    reqInit.headers = { ...headers, 'Content-Type': 'application/json' }
    reqInit.body = JSON.stringify(body)
  }
  const res = await fetch(`/api${path}`, reqInit)
  const result = (await res.json()) as ApiResult<T>
  if (result.code !== 0) {
    throw new ApiError(result.code, result.message || '请求失败')
  }
  return result.data
}

/** GET 便捷方法 */
export const get = <T = any>(path: string, params?: Record<string, unknown>) => {
  if (!params) return request<T>(path)
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  const q = qs.toString()
  return request<T>(q ? `${path}?${q}` : path)
}

/** POST 便捷方法（JSON） */
export const post = <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body })

/** POST 便捷方法（multipart/form-data 上传） */
export const postForm = <T = any>(path: string, formData: FormData) =>
  request<T>(path, { method: 'POST', formData })

// ============================================================
// 公开接口封装（开发技术文档 §6.2）
// ============================================================

// ---- 首页聚合 ----
export interface HomeData {
  banners: { id: number; image_url: string; title: string | null; subtitle: string | null; link_url: string | null }[]
  highlights: { title: string; desc: string }[]
  slogan: { title: string; subtitle: string }
  products: { id: number; name: string; cover_url: string | null; category_name: string | null }[]
  cases: { id: number; title: string; cover_url: string | null; space_tags: string[] }[]
  news: { id: number; title: string; publish_time: string; category_name: string }[]
}
export const fetchHome = () => get<HomeData>('/home')

// ---- 产品 ----
export interface CategoryItem { id: number; name: string; cover_url: string | null; sort_order: number }
export interface ProductListItem { id: number; name: string; category_name: string | null; cover_url: string | null; status: number }
export interface ProductDetail {
  id: number
  name: string
  category_name: string | null
  status: number
  cover_url: string | null
  images: string[]
  description: string | null
  specs: { name: string; value: string }[] | null
  same_series: { id: number; name: string; cover_url: string | null }[]
}
export const fetchCategories = () => get<CategoryItem[]>('/categories')
export const fetchProducts = (params: {
  category_id?: number
  keyword?: string
  sort?: 'default' | 'latest'
  page?: number
  page_size?: number
}) => get<PageResult<ProductListItem>>('/products', params as Record<string, unknown>)
export const fetchProductDetail = (id: number) => get<ProductDetail>(`/products/${id}`)

// ---- 案例 ----
export interface CaseListItem { id: number; title: string; cover_url: string | null; space_tags: string[]; city: string | null; area: string | null }
export interface CaseDetail {
  id: number
  title: string
  cover_url: string | null
  space_tags: string[]
  city: string | null
  area: string | null
  finished_at: string | null
  content: string | null
  images: string[]
}
export const fetchCases = (params: { space_tag?: string; page?: number; page_size?: number }) =>
  get<PageResult<CaseListItem>>('/cases', params as Record<string, unknown>)
export const fetchCaseDetail = (id: number) => get<CaseDetail>(`/cases/${id}`)

// ---- 新闻 ----
export interface NewsCategoryItem { id: number; name: string }
export interface NewsListItem { id: number; title: string; cover_url: string | null; summary: string | null; category_id: number; publish_time: string }
export interface NewsDetail { id: number; title: string; category_name: string; source: string | null; publish_time: string; content: string | null }
export const fetchNewsCategories = () => get<NewsCategoryItem[]>('/news/categories')
export const fetchNewsList = (params: { category_id?: number; page?: number; page_size?: number }) =>
  get<PageResult<NewsListItem>>('/news', params as Record<string, unknown>)
export const fetchNewsDetail = (id: number) => get<NewsDetail>(`/news/${id}`)

// ---- 公共配置 / 门店 ----
export interface PublicConfig {
  contact: { address: string; phone: string; email: string }
  footer: { copyright: string }
}
export interface StoreInfo {
  id: number
  name: string
  city: string
  address: string
  phone: string
  business_hours: string | null
  longitude: string | null
  latitude: string | null
}
export const fetchPublicConfig = () => get<PublicConfig>('/config/public')
export const fetchStore = () => get<StoreInfo>('/stores')

// ---- 留资提交（限流 5/min/IP，后端校验） ----
export const submitAppointment = (data: {
  name: string
  phone: string
  appointment_date?: string
  intention?: string
  remark?: string
}) => post('/appointments', data)

export const submitMessage = (data: { name: string; phone: string; email?: string; content: string }) =>
  post('/messages', data)

// ---- 招聘（§6.2.10~6.2.11 + 6.2.19） ----
export interface JobItem {
  id: number
  title: string
  location: string
  category: number // 1 社会招聘 / 2 校园招聘
  job_type: string | null
  salary_range: string | null
  is_urgent: number
  created_date: string
}
export interface JobDetail extends JobItem {
  responsibility: string | null
  requirement: string | null
  contact: string
}
export const fetchJobs = (category?: number) =>
  get<JobItem[]>('/jobs', category ? { category } : undefined)
export const fetchJobDetail = (id: number) => get<JobDetail>(`/jobs/${id}`)

/** 投递简历（multipart）：resume 为 PDF/Word 文件（≤10MB，后端校验） */
export const submitApplication = (jobId: number, data: {
  name: string
  phone: string
  email?: string
  resume: File
  note?: string
}) => {
  const form = new FormData()
  form.append('name', data.name)
  form.append('phone', data.phone)
  if (data.email) form.append('email', data.email)
  form.append('resume', data.resume)
  if (data.note) form.append('note', data.note)
  return postForm(`/jobs/${jobId}/apply`, form)
}

// ---- 单页 / 历程 / FAQ（§6.2.12~6.2.14） ----
export interface PageContent {
  title: string | null
  content: string | null
  cover_url: string | null
}
export interface MilestoneItem {
  year: string
  title: string | null
  description: string | null
}
export interface FaqItem {
  id: number
  category: string | null
  question: string
  answer: string | null
}
export const fetchPage = (contentType: 'about_stk' | 'brand_intro' | 'after_sales_policy') =>
  get<PageContent>(`/page/${contentType}`)
export const fetchMilestones = () => get<MilestoneItem[]>('/milestones')
export const fetchFaqs = () => get<FaqItem[]>('/faqs')
