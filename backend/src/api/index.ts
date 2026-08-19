// 各业务模块 API 封装：与后端开发技术文档 §6.3 接口一一对应
import request, { PageResult } from './request'

// ==================== 认证 ====================
export interface LoginResult {
  access_token: string
  token_type: string
  must_change_pwd: boolean
}
export const authApi = {
  login: (username: string, password: string) =>
    request.post<LoginResult>('/auth/login', { username, password }),
  me: () => request.get<any>('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    request.put<any>('/auth/password', { old_password, new_password }),
}

// ==================== 产品系列 ====================
export interface CategoryItem {
  id: number
  name: string
  cover_url: string | null
  sort_order: number
  is_activate: number
  product_count: number
}
export interface CategoryPayload {
  name: string
  cover_url?: string | null
  sort_order?: number
}
export const categoryApi = {
  list: (params: { page: number; page_size: number; keyword?: string }) =>
    request.get<PageResult<CategoryItem>>('/categories', { params }),
  create: (data: CategoryPayload) => request.post<CategoryItem>('/categories', data),
  update: (id: number, data: CategoryPayload) =>
    request.put<CategoryItem>(`/categories/${id}`, data),
  remove: (id: number) => request.delete<any>(`/categories/${id}`),
}

// ==================== 产品 ====================
export interface SpecItem { name: string; value: string }
export interface ProductItem {
  id: number
  category_id: number
  category_name: string | null
  name: string
  series: string | null
  product_no: string
  description: string | null
  specs: SpecItem[] | null
  cover_url: string | null
  images: string[] | null
  status: number
  is_top: number
  sort_order: number
  is_activate: number
}
export interface ProductPayload {
  category_id: number
  name: string
  series?: string | null
  product_no: string
  description?: string | null
  specs?: SpecItem[] | null
  cover_url?: string | null
  images?: string[] | null
  status?: number
  is_top?: number
  sort_order?: number
}
export const productApi = {
  list: (params: { page: number; page_size: number; category_id?: number; status?: number; keyword?: string }) =>
    request.get<PageResult<ProductItem>>('/products', { params }),
  create: (data: ProductPayload) => request.post<ProductItem>('/products', data),
  update: (id: number, data: ProductPayload) =>
    request.put<ProductItem>(`/products/${id}`, data),
  remove: (id: number) => request.delete<any>(`/products/${id}`),
  changeStatus: (id: number, status: number) =>
    request.put<any>(`/products/${id}/status`, { status }),
}

// ==================== 新闻 ====================
export interface NewsCategoryItem {
  id: number
  name: string
  sort_order: number
  is_activate: number
  article_count: number
}
export interface NewsItem {
  id: number
  category_id: number
  category_name: string | null
  title: string
  cover_url: string | null
  summary: string | null
  content: string | null
  source: string | null
  is_published: number
  is_top: number
  publish_time: string | null
  is_activate: number
}
export interface NewsPayload {
  category_id: number
  title: string
  cover_url?: string | null
  summary?: string | null
  content?: string | null
  source?: string | null
  is_published?: number
  is_top?: number
  publish_time?: string | null
}
export const newsApi = {
  categories: () => request.get<NewsCategoryItem[]>('/news/categories'),
  createCategory: (data: { name: string; sort_order?: number }) =>
    request.post<NewsCategoryItem>('/news/categories', data),
  updateCategory: (id: number, data: { name: string; sort_order?: number }) =>
    request.put<NewsCategoryItem>(`/news/categories/${id}`, data),
  removeCategory: (id: number) => request.delete<any>(`/news/categories/${id}`),
  list: (params: { page: number; page_size: number; category_id?: number; is_published?: number; keyword?: string }) =>
    request.get<PageResult<NewsItem>>('/news', { params }),
  create: (data: NewsPayload) => request.post<NewsItem>('/news', data),
  update: (id: number, data: NewsPayload) => request.put<NewsItem>(`/news/${id}`, data),
  remove: (id: number) => request.delete<any>(`/news/${id}`),
  changeStatus: (id: number, is_published: number) =>
    request.put<any>(`/news/${id}/status`, { is_published }),
}

// ==================== 内容管理 ====================
export interface PageContentItem {
  content_type: string
  title: string | null
  content: string | null
  cover_url: string | null
  is_activate: number
  updated_date: string | null
}
export interface MilestoneItem {
  id: number
  year: string
  title: string | null
  description: string | null
  sort_order: number
  is_activate: number
}
export interface FaqItem {
  id: number
  category: string | null
  question: string
  answer: string | null
  sort_order: number
  is_activate: number
}
export const contentApi = {
  getPage: (content_type: string) => request.get<PageContentItem>(`/pages/${content_type}`),
  savePage: (content_type: string, data: { title?: string; content?: string; cover_url?: string }) =>
    request.put<PageContentItem>(`/pages/${content_type}`, data),
  milestones: () => request.get<MilestoneItem[]>('/milestones'),
  createMilestone: (data: Partial<MilestoneItem>) => request.post<MilestoneItem>('/milestones', data),
  updateMilestone: (id: number, data: Partial<MilestoneItem>) =>
    request.put<MilestoneItem>(`/milestones/${id}`, data),
  removeMilestone: (id: number) => request.delete<any>(`/milestones/${id}`),
  faqs: () => request.get<FaqItem[]>('/faqs'),
  createFaq: (data: Partial<FaqItem>) => request.post<FaqItem>('/faqs', data),
  updateFaq: (id: number, data: Partial<FaqItem>) => request.put<FaqItem>(`/faqs/${id}`, data),
  removeFaq: (id: number) => request.delete<any>(`/faqs/${id}`),
}

// ==================== 首页配置（轮播/系统配置） ====================
export interface BannerItem {
  id: number
  image_url: string
  title: string | null
  subtitle: string | null
  link_url: string | null
  sort_order: number
  is_activate: number
}
export interface ConfigItem {
  config_key: string
  config_value: string | null
}
export const bannerApi = {
  list: () => request.get<BannerItem[]>('/banners'),
  create: (data: Partial<BannerItem>) => request.post<BannerItem>('/banners', data),
  update: (id: number, data: Partial<BannerItem>) => request.put<BannerItem>(`/banners/${id}`, data),
  remove: (id: number) => request.delete<any>(`/banners/${id}`),
  changeStatus: (id: number, is_activate: number) =>
    request.put<any>(`/banners/${id}/status`, { is_activate }),
}
export const configApi = {
  list: () => request.get<ConfigItem[]>('/config'),
  save: (items: ConfigItem[]) => request.put<any>('/config', { items }),
}

// ==================== 上传 ====================
// 图片上传：先传图拿 URL，再随业务表单提交（BR-19/NFR-09）
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await request.post<{ url: string; size: number }>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.url
}
