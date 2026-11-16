import { test, expect } from '@playwright/test'

test('workspace fits a normal laptop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  const sizes = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth, view: innerHeight, viewWidth: innerWidth }))
  expect(sizes.height).toBeLessThanOrEqual(sizes.view + 1)
  expect(sizes.width).toBeLessThanOrEqual(sizes.viewWidth)
})

test('toolbar positions can be changed and stay anchored while scrolling', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board, host = document.querySelector('#board') as HTMLElement
    const toolbar = host.querySelector('.drawink-toolbar') as HTMLElement
    b.setOptions({ toolbarPosition: 'bottom-right' })
    let h = host.getBoundingClientRect(), t = toolbar.getBoundingClientRect()
    const preset = { right: h.right - t.right, bottom: h.bottom - t.bottom }
    b.setOptions({ toolbarPosition: { x: 24, y: 72 } })
    host.scrollTop = 250; host.dispatchEvent(new Event('scroll'))
    h = host.getBoundingClientRect(); t = toolbar.getBoundingClientRect()
    return { preset, custom: { x: t.left - h.left, y: t.top - h.top } }
  })
  expect(result.preset.right).toBeCloseTo(16)
  expect(result.preset.bottom).toBeCloseTo(16, 0)
  expect(result.custom).toEqual({ x: 24, y: 72 })
})

test('automatic PNG sizing exports huge infinite worlds with visible ink and optional background', async ({ page }) => {
  await page.goto('/?mode=infinite')
  const result = await page.evaluate(async () => {
    const b = (window as any).board
    b.loadData({ version: 1, mode: 'infinite', width: 800, height: 600, background: { color: '#123456', pattern: 'grid' }, shapes: [{ tool: 'line', color: '#176b52', width: 3, points: [{ x: -10000000, y: -5000000 }, { x: 10000000, y: 5000000 }] }] })
    const saved = JSON.stringify(b.getData())
    async function sample(includeBackground: boolean) {
      const img = new Image(); img.src = await b.exportImage({ fit: true, includeBackground }); await img.decode()
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0)
      return { width: img.width, height: img.height, corner: [...ctx.getImageData(0, 0, 1, 1).data], ink: ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data[3] }
    }
    return { transparent: await sample(false), background: await sample(true), unchanged: saved === JSON.stringify(b.getData()) }
  })
  expect(result.transparent.width).toBeLessThanOrEqual(4096)
  expect(result.transparent.height).toBeLessThanOrEqual(4096)
  expect(result.transparent.corner[3]).toBe(0)
  expect(result.transparent.ink).toBeGreaterThan(100)
  expect(result.background.corner[3]).toBe(255)
  expect(result.unchanged).toBe(true)
})

test('PNG export opens choices with background off by default', async ({ page }) => {
  await page.goto('/?mode=infinite')
  await page.getByRole('button', { name: '导出 PNG', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '导出图片' })).toBeVisible()
  await expect(page.getByLabel('包含背景', { exact: true })).not.toBeChecked()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '保存图片', exact: true }).click()])
  expect(download.suggestedFilename()).toBe('drawink.png')
})

for (const framework of ['js', 'vue', 'react']) {
  for (const [width, height] of [[1280, 720], [1440, 900], [390, 844]]) test(framework + ' workbench fits ' + width + 'x' + height, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?framework=' + framework + '&mode=infinite')
    await expect(page.getByRole('toolbar')).toBeVisible()
    const result = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, canvas: document.querySelector('canvas')!.getBoundingClientRect().toJSON() }))
    expect(result.width).toBeLessThanOrEqual(width)
    expect(result.height).toBeLessThanOrEqual(height + 1)
    expect(result.canvas.height).toBeGreaterThan(280)
    await page.getByLabel('工具栏位置', { exact: true }).selectOption('bottom-right')
    await page.getByRole('button', { name: '导出 PNG', exact: true }).click()
    const menu = await page.getByRole('dialog', { name: '导出图片' }).boundingBox()
    expect(menu!.y).toBeGreaterThanOrEqual(result.canvas.y)
    expect(menu!.x).toBeGreaterThanOrEqual(0)
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(width)
    expect(menu!.y + menu!.height).toBeLessThanOrEqual(height)
  })
  test(framework + ' exports a huge world with the background choice honored', async ({ page }) => {
    await page.goto('/?framework=' + framework + '&mode=infinite')
    await page.waitForFunction(() => !!(window as any).board)
    await page.evaluate(() => (window as any).board.loadData({ version: 1, mode: 'infinite', width: 800, height: 600, background: { color: '#123456', pattern: 'none' }, shapes: [{ tool: 'line', width: 5, color: '#ff0000', points: [{ x: -10000000, y: -5000000 }, { x: 10000000, y: 5000000 }] }] }))
    for (const withBackground of [false, true]) {
      await page.getByRole('button', { name: '导出 PNG', exact: true }).click()
      const checkbox = page.getByLabel('包含背景', { exact: true })
      await expect(checkbox).not.toBeChecked()
      if (withBackground) await checkbox.check()
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '保存图片', exact: true }).click()])
      const result = await page.evaluate(async url => {
        const img = new Image(); img.src = url; await img.decode()
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
        const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0)
        return { width: img.width, pixel: [...ctx.getImageData(0, 0, 1, 1).data] }
      }, download.url())
      expect(result.width).toBeLessThanOrEqual(4096)
      expect(result.pixel[3]).toBe(withBackground ? 255 : 0)
      if (withBackground) expect(result.pixel.slice(0, 3)).toEqual([18, 52, 86])
    }
  })
}
