import { test, expect } from '@playwright/test'
for (const framework of ['vue', 'react']) {
  test(framework + ' syncs controlled data and cleans up after remount', async ({ page }) => {
    await page.goto('/?framework=' + framework)
    await expect(page.locator('#framework-board canvas')).toHaveCount(1)
    const box = await page.locator('#framework-board canvas').boundingBox()
    if (!box) throw new Error('Adapter did not mount')
    await page.mouse.move(box.x + 40, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 170, { steps: 6 })
    await page.mouse.up()
    await expect.poll(() => page.evaluate(() => (window as any).demoControls?.getData()?.shapes.length)).toBe(1)
    await page.evaluate(() => (window as any).demoControls.clear())
    await expect.poll(() => page.evaluate(() => (window as any).demoControls?.getData()?.shapes.length)).toBe(0)
    await page.evaluate(() => (window as any).demoControls.toggle())
    await expect(page.locator('#framework-board canvas')).toHaveCount(0)
    await page.evaluate(() => (window as any).demoControls.toggle())
    await expect(page.locator('#framework-board canvas')).toHaveCount(1)
    await expect(page.locator('#framework-board .drawink-toolbar')).toHaveCount(1)
  })
}

