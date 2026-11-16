import { test, expect, type Page } from '@playwright/test'
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const host = page.locator('#board')
  const box = await host.boundingBox()
  if (!box) throw new Error('No board')
  await page.mouse.move(box.x + from[0], box.y + from[1])
  await page.mouse.down()
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 8 })
  await page.mouse.up()
}
test('infinite panning preserves world coordinates without growing the canvas', async ({ page }) => {
  await page.goto('/?framework=js')
  await page.evaluate(() => (window as any).board.setOptions({ mode: 'infinite', tool: 'rect' }))
  await drag(page, [50, 100], [120, 170])
  const before = await page.evaluate(() => (window as any).board.getData().shapes)
  await page.evaluate(() => (window as any).board.setTool('pan'))
  await drag(page, [200, 200], [500, 350])
  const data = await page.evaluate(() => (window as any).board.getData())
  expect(data.viewport).toEqual({ x: 300, y: 150 })
  expect(data.shapes).toEqual(before)
  const sizes = await page.locator('#board').evaluate(el => ({ scroll: el.scrollHeight, height: el.clientHeight, canvas: el.querySelector('canvas')!.getBoundingClientRect().height }))
  expect(sizes.canvas).toBe(sizes.height)
  await page.evaluate(() => (window as any).board.setTool('line'))
  await drag(page, [40, 80], [100, 140])
  const point = await page.evaluate(() => (window as any).board.getData().shapes[1].points[0])
  expect(point).toEqual({ x: -260, y: -70 })
  const result = await page.evaluate(async () => {
    const board = (window as any).board
    const saved = board.getData()
    board.loadData(saved)
    const image = new Image()
    image.src = await board.exportImage()
    await image.decode()
    return { saved: board.getData(), width: image.width, height: image.height }
  })
  expect(result.saved.viewport).toEqual({ x: 300, y: 150 })
  expect(result.width).toBeGreaterThan(380)
  expect(result.width).toBeLessThan(450)
  expect(result.height).toBeGreaterThan(240)
  await page.evaluate(() => (window as any).board.resetView())
  expect(await page.evaluate(() => (window as any).board.getData().viewport)).toEqual({ x: 0, y: 0 })
})
for (const framework of ['js', 'vue', 'react']) {
  test(framework + ' allows choosing independent document and infinite boards', async ({ page }) => {
    await page.goto('/?framework=' + framework)
    const selector = page.getByLabel('画板模式', { exact: true })
    await expect(selector).toHaveValue('document')
    await Promise.all([page.waitForURL(url => url.searchParams.get('mode') === 'infinite'), selector.selectOption('infinite')])
    const host = page.locator(framework === 'js' ? '#board' : '#framework-board')
    await expect(page.getByLabel('画板模式', { exact: true })).toHaveValue('infinite')
    await expect(host.locator('canvas')).toHaveCount(1)
    await host.scrollIntoViewIfNeeded()
    const box = await host.boundingBox()
    if (!box) throw new Error('Missing board')
    await page.mouse.move(box.x + 60, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 160, box.y + 200, { steps: 5 })
    await page.mouse.up()
    await Promise.all([page.waitForURL(url => url.searchParams.get('mode') === 'document'), page.getByLabel('画板模式', { exact: true }).selectOption('document')])
    if (framework === 'js') expect(await page.evaluate(() => (window as any).board.getData().shapes.length)).toBe(0)
    else await expect.poll(() => page.evaluate(() => (window as any).demoControls?.getData()?.shapes.length)).toBe(0)
    await Promise.all([page.waitForURL(url => url.searchParams.get('mode') === 'infinite'), page.getByLabel('画板模式', { exact: true }).selectOption('infinite')])
    if (framework === 'js') expect(await page.evaluate(() => (window as any).board.getData().shapes.length)).toBe(1)
    else await expect.poll(() => page.evaluate(() => (window as any).demoControls?.getData()?.shapes.length)).toBe(1)
  })
}



test('loading a legacy document exits infinite mode and cancellation restores the camera', async ({ page }) => {
  await page.goto('/?framework=js&mode=infinite')
  await page.evaluate(() => (window as any).board.setTool('pan'))
  const canvas = page.locator('#board canvas')
  await canvas.dispatchEvent('pointerdown', { pointerId: 99, pointerType: 'pen', button: 0, clientX: 100, clientY: 500 })
  await canvas.dispatchEvent('pointermove', { pointerId: 99, pointerType: 'pen', clientX: 300, clientY: 600 })
  await canvas.dispatchEvent('pointercancel', { pointerId: 99, pointerType: 'pen' })
  expect(await page.evaluate(() => (window as any).board.getData().viewport)).toEqual({ x: 0, y: 0 })
  const result = await page.evaluate(() => {
    const board = (window as any).board
    board.loadData({ version: 1, width: 800, height: 1200, shapes: [] })
    return { mode: board.mode, saved: board.getData() }
  })
  expect(result.mode).toBe('document')
  expect(result.saved).toMatchObject({ version: 1, width: 800, height: 1200, shapes: [] })
})
