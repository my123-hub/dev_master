// 统一请求层：axios 实例
// - baseURL 统一前缀 /api/admin（开发期由 Vite proxy 转发到后端，生产同域）
// - 请求拦截器注入 Authorization: Bearer <token>
// - 响应拦截器：code!=0 统一 toast 提示；401 清 token 跳登录；403 提示无权限
import axios from 'axios'
import { message } from 'antd'
import { getToken, logout } from '@/store/auth'

// axios 类型增强：响应拦截器已把 data 解包返回，故 get/post/put/delete 直接返回业务数据 T
// （而非 AxiosResponse<T>），调用方无需再 .data 取数
declare module 'axios' {
  export interface AxiosInstance {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
  }
}

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

const request = axios.create({
  baseURL: '/api/admin',
  timeout: 15000,
})

// 请求拦截：附加登录令牌
request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一处理业务错误
request.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResult
    // 业务成功
    if (res.code === 0) return res.data
    // 未认证：清理登录态并跳转登录页
    if (res.code === 40100) {
      logout()
      if (!location.pathname.startsWith('/login')) {
        message.warning('登录已过期，请重新登录')
        location.href = '/login'
      }
      return Promise.reject(new Error(res.message))
    }
    // 首次登录强制改密（BR-06）
    if (res.code === 10001) {
      message.warning(res.message)
      location.href = '/password'
      return Promise.reject(new Error(res.message))
    }
    // 其他业务错误：toast 提示后抛出
    message.error(res.message || '操作失败')
    return Promise.reject(new Error(res.message))
  },
  (error) => {
    // 网络层错误（超时/断网/500）
    const msg = error?.response?.status === 500 ? '服务器内部错误' : '网络异常，请稍后重试'
    message.error(msg)
    return Promise.reject(error)
  },
)

export default request
