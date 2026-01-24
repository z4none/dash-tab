import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 自定义插件：注入统计脚本
    {
      name: 'inject-analytics',
      transformIndexHtml(html) {
        const analyticsUrl = process.env.VITE_ANALYTICS_URL
        const websiteId = process.env.VITE_ANALYTICS_WEBSITE_ID

        // 只在生产环境且配置了环境变量时注入
        if (process.env.NODE_ENV === 'production' && analyticsUrl && websiteId) {
          return html.replace(
            '</head>',
            `  <script defer src="${analyticsUrl}" data-website-id="${websiteId}"></script>\n  </head>`
          )
        }
        return html
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'DashTab - 个性化浏览器启动页',
        short_name: 'DashTab',
        description: '快速、美观、可定制的浏览器启动页',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
})
