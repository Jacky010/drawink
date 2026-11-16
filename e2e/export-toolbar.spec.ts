import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
for (const framework of ['js', 'vue', 'react']) test(framework + ' exports PNG from the shared toolbar without a footer action row', async ({ page }) => {
  await page.goto('/?framework=' + framework)
  const toolbar = page.getByRole('toolbar', { name: '画板工具栏' })
  const button = toolbar.getByRole('button', { name: '导出 PNG', exact: true })
  await expect(button).toBeVisible()
  await expect(page.locator('.foot')).toHaveCount(0)
  await button.click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '保存图片', exact: true }).click()])
  expect(download.suggestedFilename()).toBe('drawink.png')
  const path = await download.path()
  const bytes = await readFile(path!)
  expect([...bytes.subarray(0, 8)]).toEqual([137,80,78,71,13,10,26,10])
})

test('toolbar reports unexpected export failures and remains usable', async ({ page }) => {
  await page.goto('/?mode=infinite')
  await page.evaluate(() => { (window as any).board.exportImage = async () => { throw new Error('模拟导出失败') } })
  const button = page.getByRole('button', { name: '导出 PNG', exact: true })
  await button.click()
  await page.getByRole('button', { name: '保存图片', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('导出失败')
  await expect(button).toBeEnabled()
})