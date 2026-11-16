import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => ({
  root: 'playground',
  base: mode === 'pages' ? '/drawink/' : '/',
  build: {
    outDir: fileURLToPath(new URL('./site-dist', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [vue(), react()],
  resolve: {
    alias: Object.fromEntries([
      ['@drawink/vue', './packages/vue/src/index.ts'],
      ['@drawink/react', './packages/react/src/index.tsx'],
      ['@drawink/core', './packages/core/src/index.ts'],
    ].map(([name, path]) => [name, fileURLToPath(new URL(path, import.meta.url))])),
  },
}))
