// 认证状态管理：token 与用户信息持久化到 localStorage
// 与后端 JWT 会话配合（BR-04，7 天有效期）

export interface UserInfo {
  id: number
  username: string
  name: string | null
  role_name: string | null
  must_change_pwd: boolean
  permissions: string[]
}

const TOKEN_KEY = 'stk_admin_token'
const USER_KEY = 'stk_admin_user'

/** 读取 token（无则返回 null） */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** 保存 token */
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

/** 保存用户信息（含权限点集合） */
export function setUser(user: UserInfo) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/** 读取用户信息（解析失败返回 null） */
export function getUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

/** 判断是否已登录（有 token 即视为已登录，路由守卫用） */
export function isLoggedIn(): boolean {
  return !!getToken()
}

/** 是否有某权限点（菜单/按钮显隐，仅视觉；服务端仍强制校验 NFR-07） */
export function hasPerm(code: string): boolean {
  const user = getUser()
  return !!user && user.permissions.includes(code)
}

/** 登出：清空本地登录态 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
