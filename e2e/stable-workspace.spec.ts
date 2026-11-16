import { test, expect } from '@playwright/test'
test('framework and mode switches keep the same document without navigation', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => (window as any).documentMarker = 'keep')
  for (const framework of ['vue', 'react', 'js']) {
    await page.locator('[data-framework="' + framework + '"]').click()
    await expect(page.getByRole('toolbar')).toHaveCount(1)
    expect(await page.evaluate(() => (window as any).documentMarker)).toBe('keep')
    await page.getByLabel('画板模式', { exact: true }).selectOption('infinite')
    expect(await page.evaluate(() => (window as any).documentMarker)).toBe('keep')
    await page.getByLabel('画板模式', { exact: true }).selectOption('document')
  }
})
for (const framework of ['js', 'vue', 'react']) test(framework + ' toolbar does not move even before a scroll handler can compensate', async ({ page }) => {
  await page.goto('/?framework=' + framework)
  await page.getByLabel('工具栏位置', { exact: true }).selectOption('bottom-center')
  const deltas = await page.evaluate(() => {
    const host = document.querySelector('.drawink-layer')!.parentElement as HTMLElement
    const toolbar = host.querySelector('.drawink-toolbar')!
    const before = toolbar.getBoundingClientRect().top
    return [100, 250, 400, 50, 0].map(y => { host.scrollTop = y; return toolbar.getBoundingClientRect().top - before })
  })
  for (const delta of deltas) expect(Math.abs(delta)).toBeLessThan(.5)
})

test('decorative top border, tagline and framework badge are removed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#framework-label')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('link', { name: '快速接入' })).toBeVisible()
  await expect(page.getByRole('link', { name: '文档', exact: true })).toBeVisible()
})
