import { test, expect } from '@playwright/test'
for (const framework of ['js', 'vue', 'react']) {
  test(framework + ' can draw across the viewport at minimum zoom and reload its data', async ({ page }) => {
    await page.goto('/?framework=' + framework + '&mode=infinite')
    await page.waitForFunction(() => !!(window as any).board)
    const result = await page.evaluate(() => {
      const b = (window as any).board
      b.setOptions({ autoPan: false }); b.setZoom(.00001)
      const view = b.getViewport()
      const canvas = document.querySelector('.drawink-layer canvas')!
      const rect = canvas.getBoundingClientRect()
      for (const [type, x, y] of [['pointerdown', 80, 450], ['pointermove', 200, 520], ['pointerup', 200, 520]] as const) canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: rect.left + x, clientY: rect.top + y, bubbles: true }))
      const saved = b.getData(); b.loadData(saved)
      const points = b.getData().shapes[0].points
      return { start: { x: points[0].x * view.zoom + view.x, y: points[0].y * view.zoom + view.y }, end: { x: points.at(-1).x * view.zoom + view.x, y: points.at(-1).y * view.zoom + view.y } }
    })
    expect(result.start.x).toBeCloseTo(80)
    expect(result.start.y).toBeCloseTo(450)
    expect(result.end.x).toBeCloseTo(200)
    expect(result.end.y).toBeCloseTo(520)
  })
  test(framework + ' background controls remain visible and persist at minimum zoom', async ({ page }) => {
    await page.goto('/?framework=' + framework + '&mode=infinite')
    await page.waitForFunction(() => !!(window as any).board)
    await page.evaluate(() => (window as any).board.setZoom(.00001))
    await page.getByRole('button', { name: '背景', exact: true }).click()
    await page.getByLabel('背景颜色', { exact: true }).fill('#123456')
    await page.getByLabel('背景纹理', { exact: true }).selectOption('grid')
    await page.getByLabel('纹理颜色', { exact: true }).fill('#abcdef')
    const result = await page.evaluate(() => {
      const b = (window as any).board
      const host = document.querySelector('.drawink-layer')!.parentElement!
      return { settings: b.getBackground(), image: host.style.backgroundImage, gap: parseFloat(host.style.backgroundSize), color: getComputedStyle(host).backgroundColor }
    })
    expect(result.settings).toMatchObject({ color: '#123456', pattern: 'grid', patternColor: '#abcdef' })
    expect(result.color).toBe('rgb(18, 52, 86)')
    expect(result.image).toContain('linear-gradient')
    expect(result.gap).toBeGreaterThanOrEqual(12)
  })
}
