import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  workers: 2,
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined, baseURL: 'http://127.0.0.1:5188', viewport: { width: 1280, height: 900 } },
  webServer: { command: 'pnpm dev --port 5188 --strictPort', url: 'http://127.0.0.1:5188', reuseExistingServer: !process.env.CI },
})
