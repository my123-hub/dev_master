// vite.config.ts —— 前台官网构建配置
// 开发期将 /api 代理到后端 FastAPI（8001），免 CORS 联调（开发技术文档 §4.3）
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // @ 别名：src 目录（TS 侧 tsconfig paths 同步配置）
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5175, // 前台 dev server 端口（后台 5174 已占用）
    proxy: {
      // 开发期 API 代理到后端：/api/xxx → http://127.0.0.1:8001/api/xxx
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      // 静态资源（上传图片）代理
      '/static': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
