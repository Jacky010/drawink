
import { test, expect } from '@playwright/test'
for (const framework of ['js', 'vue', 'react']) {
  test(framework + ' demo scroll tool moves the document and keeps toolbar visible', async ({ page }) => {
    await page.goto('/?framework=' + framework)
    const host = page.locator(framework === 'js' ? '#board' : '#framework-board')
    await expect(host.locator('canvas')).toHaveCount(1)
    const sizes = await host.evaluate(el => ({ content: el.scrollHeight, viewport: el.clientHeight }))
    expect(sizes.content).toBeGreaterThan(sizes.viewport)
    await host.getByRole('button', { name: '滚动', exact: true }).click()
    await host.scrollIntoViewIfNeeded()
    const box = await host.boundingBox()
    if (!box) throw new Error('Missing drawing host')
    await page.mouse.move(box.x + 250, box.y + 350)
    await page.mouse.down()
    await page.mouse.move(box.x + 250, box.y + 100, { steps: 10 })
    await page.mouse.up()
    await expect.poll(() => host.evaluate(el => el.scrollTop)).toBeGreaterThan(200)
    const toolbar = await host.locator('.drawink-toolbar').boundingBox()
    expect(toolbar).not.toBeNull()
    expect(toolbar!.y).toBeGreaterThanOrEqual(box.y)
    expect(toolbar!.y + toolbar!.height).toBeLessThan(box.y + box.height)
    await host.getByRole('button', { name: '画笔', exact: true }).click()
    await page.mouse.move(box.x + 80, box.y + 150)
    await page.mouse.down()
    await page.mouse.move(box.x + 160, box.y + 220, { steps: 5 })
    await page.mouse.up()
    if (framework === 'js') {
      const shape = await page.evaluate(() => (window as any).board.getData().shapes[0])
      expect(shape.points[0].y).toBeGreaterThan(350)
    } else await expect.poll(() => page.evaluate(() => (window as any).demoControls?.getData()?.shapes.length)).toBe(1)
  })
}
