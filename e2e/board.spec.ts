import { test, expect, type Page } from '@playwright/test'
async function drag(page: Page, x = 60, y = 70) {
  const box = await page.locator('#board canvas').boundingBox()
  if (!box) throw new Error('Drawing canvas not mounted')
  await page.mouse.move(box.x + x, box.y + y)
  await page.mouse.down()
  await page.mouse.move(box.x + x + 100, box.y + y + 80, { steps: 8 })
  await page.mouse.up()
}
const count = (page: Page) => page.evaluate(() => (window as any).board.getData().shapes.length)
test.beforeEach(async ({ page }) => { await page.goto('/') })
test('all teaching tools draw and history restores committed objects', async ({ page }) => {
  for (const tool of ['pen', 'line', 'rect', 'circle', 'ellipse', 'triangle', 'diamond', 'trapezoid', 'parallelogram', 'cuboid', 'cylinder', 'cone']) {
    await page.evaluate(tool => (window as any).board.setTool(tool), tool)
    await drag(page)
  }
  expect(await count(page)).toBe(12)
  await page.evaluate(() => (window as any).board.undo())
  expect(await count(page)).toBe(11)
  await page.evaluate(() => (window as any).board.redo())
  expect(await count(page)).toBe(12)
  const pixel = await page.locator('#board canvas').evaluate((canvas: HTMLCanvasElement) =>
    Array.from(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data).some((v, i) => i % 4 === 3 && v > 0))
  expect(pixel).toBe(true)
})
test('data roundtrip and invalid import are atomic; PNG has transparent background', async ({ page }) => {
  await drag(page)
  const result = await page.evaluate(async () => {
    const board = (window as any).board
    const saved = board.getData()
    board.clear()
    board.loadData(saved)
    try { board.loadData({ ...saved, shapes: [{ tool: 'bad' }] }) } catch {}
    const image = new Image()
    image.src = await board.exportImage()
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    return { count: board.getData().shapes.length, width: image.width, alpha: ctx.getImageData(799, 599, 1, 1).data[3] }
  })
  expect(result).toEqual({ count: 1, width: 800, alpha: 0 })
})
test('pointer cancellation rolls back and readOnly prevents edits', async ({ page }) => {
  await page.locator('#board canvas').dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'pen', button: 0, clientX: 80, clientY: 160 })
  await page.locator('#board canvas').dispatchEvent('pointermove', { pointerId: 7, pointerType: 'pen', clientX: 180, clientY: 240 })
  await page.locator('#board canvas').dispatchEvent('pointercancel', { pointerId: 7 })
  expect(await count(page)).toBe(0)
  await page.evaluate(() => (window as any).board.setOptions({ readOnly: true }))
  await drag(page)
  expect(await count(page)).toBe(0)
})
test('object eraser, selection move, and disable are independent of rendering', async ({ page }) => {
  await page.evaluate(() => (window as any).board.setTool('rect'))
  await drag(page)
  await page.evaluate(() => (window as any).board.setTool('select'))
  await drag(page, 100, 100)
  const first = await page.evaluate(() => (window as any).board.getData().shapes[0].points[0])
  expect(first.x).toBeGreaterThan(100)
  await page.evaluate(() => (window as any).board.setTool('eraser'))
  await drag(page, 150, 150)
  expect(await count(page)).toBe(0)
  await page.evaluate(() => { (window as any).board.setOptions({ disabled: true }); (window as any).board.setTool('pen') })
  await drag(page)
  expect(await count(page)).toBe(0)
})
test('two instances isolate history and destroying restores the host', async ({ page }) => {
  const result = await page.evaluate(() => {
    const host = document.querySelector('#second') as HTMLElement
    host.style.cssText = 'width:300px;height:200px;position:static'
    const content = document.createElement('p')
    content.textContent = 'keep me'
    host.appendChild(content)
    const other = new (window as any).Drawboard(host)
    other.loadData({ version: 1, width: 300, height: 200, shapes: [{ tool: 'line', points: [{ x: 1, y: 1 }, { x: 30, y: 30 }], color: '#000', width: 2 }] })
    const length = (window as any).board.getData().shapes.length
    other.destroy()
    other.destroy()
    return { length, canvases: host.querySelectorAll('canvas').length, content: host.textContent, position: host.style.position }
  })
  expect(result).toEqual({ length: 0, canvases: 0, content: 'keep me', position: 'static' })
})
test('scroll coordinates stay in document space and CSS scaling does not change data units', async ({ page }) => {
  await page.evaluate(() => {
    const board = (window as any).board
    board.setOptions({ contentHeight: 1200 })
    board.setTool('line')
    const host = document.querySelector('#board') as HTMLElement
    host.style.transformOrigin = 'top left'
    host.style.transform = 'scale(0.75)'
    host.scrollTop = 300
  })
  const host = await page.locator('#board').boundingBox()
  if (!host) throw new Error('Host missing')
  await page.mouse.move(host.x + 75, host.y + 75)
  await page.mouse.down()
  await page.mouse.move(host.x + 150, host.y + 150)
  await page.mouse.up()
  const p = await page.evaluate(() => (window as any).board.getData().shapes[0].points[0])
  const expectedX = await page.evaluate(() => 100 * (window as any).board.getData().width / (document.querySelector('#board') as HTMLElement).clientWidth)
  expect(p.x).toBeCloseTo(expectedX, 0)
  expect(Math.abs(p.y - 400)).toBeLessThan(5)
})


test('equal option updates do not discard an in-progress pen stroke', async ({ page }) => {
  const box = await page.locator('#board canvas').boundingBox()
  if (!box) throw new Error('Missing canvas')
  await page.mouse.move(box.x + 50, box.y + 80)
  await page.mouse.down()
  await page.mouse.move(box.x + 90, box.y + 100)
  await page.evaluate(() => (window as any).board.setOptions({ tool: 'pen', color: '#176b52', onChange: () => {} }))
  await page.mouse.move(box.x + 150, box.y + 120)
  await page.mouse.up()
  expect(await count(page)).toBe(1)
})
test('penOnly rejects finger input and permits pen input', async ({ page }) => {
  await page.evaluate(() => (window as any).board.setOptions({ penOnly: true }))
  for (const pointerType of ['touch', 'pen']) {
    await page.locator('#board canvas').dispatchEvent('pointerdown', { pointerId: 17, pointerType, button: 0, clientX: 100, clientY: 500 })
    await page.locator('#board canvas').dispatchEvent('pointerup', { pointerId: 17, pointerType, clientX: 120, clientY: 520 })
  }
  expect(await count(page)).toBe(1)
})

