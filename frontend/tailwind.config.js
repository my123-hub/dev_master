// tailwind.config.js —— 墨玉翡翠设计令牌（UI-UX §2.1 设计规范）
// 深绿 #0F3D2E + 香槟金 #C9A86A；serif 标题（Noto Serif SC）；全站禁用蓝色
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ---- 墨玉翡翠品牌色板（UI-UX §2.1.1） ----
      colors: {
        // 墨玉绿：主品牌色（深绿 #0F3D2E）
        jade: {
          50: '#F0F5F2',
          100: '#DCE8E1',
          200: '#B9D1C4',
          300: '#8FB5A2',
          400: '#5F9279',
          500: '#3C7059',
          600: '#1F5A42',
          700: '#0F3D2E', // 主色：墨玉深绿（导航/按钮/标题）
          800: '#0B2F23',
          900: '#08241B',
        },
        // 香槟金：辅助色（#C9A86A，点缀/高光）
        gold: {
          300: '#E0CB9C',
          400: '#D4B87E',
          500: '#C9A86A', // 主辅助色：香槟金（点缀/强调）
          600: '#B08F4F',
          700: '#8F7240',
        },
        // 中性色：象牙白底 + 暖灰文字
        ivory: '#F7F5F0',
        warmgray: {
          100: '#F0EEE8',
          300: '#C9C4B8',
          500: '#8A8578',
          700: '#57524A',
          900: '#2E2A26',
        },
      },
      // ---- 字体：serif 标题（UI-UX §2.2） ----
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Songti SC', 'SimSun', 'serif'],
        sans: ['"Noto Sans SC"', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      // ---- 间距/圆角/阴影 ----
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(15, 61, 46, 0.08)',
        'card-hover': '0 8px 24px rgba(15, 61, 46, 0.14)',
        nav: '0 2px 16px rgba(15, 61, 46, 0.12)',
      },
      letterSpacing: {
        brand: '0.35em', // 品牌标题字距（香槟金小标题）
      },
      transitionDuration: {
        400: '400ms',
      },
    },
  },
  plugins: [],
}
