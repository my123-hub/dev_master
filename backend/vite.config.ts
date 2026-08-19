// vite.config.ts —— 后台管理前端构建配置
// 开发期将 /api 代理到后端 FastAPI（8001），免 CORS 联调（开发技术文档 §4.3）
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 路径别名：@ → src（与 tsconfig paths 保持一致，供 Vite/Rollup 解析）
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 本机构建沙箱对 fs.rmSync 做了「安全删除」包装，清空 dist 会失败；
    // 关闭自动清空，改由 CI/本地 rm 清空 dist 后再构建（生产 Docker 全新上下文不受影响）
    emptyOutDir: false,
  },
  server: {
    port: 5174,                 // 后台管理端口（前台 5173 已预留）
    proxy: {
      // 所有 /api 请求转发到后端（含 /static 静态资源由后端直接服务）
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
