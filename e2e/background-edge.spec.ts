import { test, expect } from '@playwright/test'
test('background controls change color and pattern, persist JSON, and preserve transparent export', async ({ page }) => {
  await page.goto('/?mode=infinite')
  await page.getByRole('button', { name: '背景', exact: true }).click()
  await page.getByLabel('背景颜色', { exact: true }).evaluate((el: HTMLInputElement) => {
    el.value = '#233344'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.getByLabel('背景纹理', { exact: true }).selectOption('grid')
  const background = await page.evaluate(() => {
    const host = document.querySelector('#board')!
    return { color: getComputedStyle(host).backgroundColor, image: getComputedStyle(host).backgroundImage, data: (window as any).board.getData().background }
  })
  expect(background.color).toBe('rgb(35, 51, 68)')
  expect(background.image).toContain('linear-gradient')
  expect(background.data.color).toBe('#233344')
  expect(background.data.pattern).toBe('grid')
  await page.reload()
  expect(await page.evaluate(() => (window as any).board.getData().background.pattern)).toBe('grid')
  const alpha = await page.evaluate(async () => {
    const board = (window as any).board
    const values = []
    for (const includeBackground of [false, true]) {
      const image = new Image()
      image.src = await board.exportImage({ includeBackground })
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width; canvas.height = image.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image, 0, 0)
      values.push(ctx.getImageData(10, 10, 1, 1).data[3])
    }
    return values
  })
  expect(alpha).toEqual([0, 255])
})
test('dragging a shape at an infinite viewport edge continuously advances the world', async ({ page }) => {
  await page.goto('/?mode=infinite')
  await page.evaluate(() => {
    const board = (window as any).board
    board.setOptions({ toolbar: false })
    board.loadData({ version: 1, mode: 'infinite', width: 800, height: 600, viewport: { x: 0, y: 0 }, shapes: [{
      tool: 'rect', points: [{ x: 100, y: 100 }, { x: 200, y: 200 }], color: '#176b52', width: 3,
    }] })
    board.setTool('select')
  })
  const host = page.locator('#board')
  await host.scrollIntoViewIfNeeded()
  const box = await host.boundingBox()
  if (!box) throw new Error('No board')
  await page.mouse.move(box.x + 150, box.y + 150)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 4, box.y + 200, { steps: 8 })
  await expect.poll(() => page.evaluate(() => (window as any).board.getData().viewport.x)).toBeLessThan(-250)
  await page.mouse.up()
  const moved = await page.evaluate(() => (window as any).board.getData())
  expect(moved.shapes[0].points[0].x).toBeGreaterThan(800)
  const dimensions = await host.locator('canvas').evaluate((el: HTMLCanvasElement) => ({ width: el.width, height: el.height }))
  const viewport = await host.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
  expect(dimensions).toEqual(viewport)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => (window as any).board.getData().viewport)).toEqual(moved.viewport)
  await page.evaluate(() => (window as any).board.undo())
  expect(await page.evaluate(() => (window as any).board.getData().shapes[0].points[0])).toEqual({ x: 100, y: 100 })
  await page.evaluate(() => (window as any).board.redo())
  expect(await page.evaluate(() => (window as any).board.getData().shapes[0].points[0])).toEqual(moved.shapes[0].points[0])
})
test('legacy snapshots under an infinite demo key cannot leave the core in document mode', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    sessionStorage.setItem('drawink-demo:js:infinite', JSON.stringify({ version: 1, width: 800, height: 1200, shapes: [] }))
  })
  await page.goto('/?framework=js&mode=infinite')
  expect(await page.evaluate(() => (window as any).board.mode)).toBe('infinite')
  await expect(page.locator('#board .lesson')).toBeHidden()
  expect(await page.locator('#board').evaluate(el => getComputedStyle(el).overflow)).toBe('hidden')
})


test('React restores old infinite-session snapshots as a consistent infinite view', async ({ page }) => {
  await page.goto('/?framework=react')
  await page.evaluate(() => sessionStorage.setItem('drawink-demo:react:infinite', JSON.stringify({ version: 1, width: 800, height: 1200, shapes: [] })))
  await page.goto('/?framework=react&mode=infinite')
  await expect(page.locator('#framework-board canvas')).toHaveCount(1)
  await expect.poll(() => page.locator('#framework-board').evaluate(el => getComputedStyle(el).overflow)).toBe('hidden')
  await expect(page.locator('#framework-board .lesson')).toBeHidden()
})

test('edge drawing supports scaled hosts and cancellation restores both the camera and draft', async ({ page }) => {
  await page.goto('/?mode=infinite')
  await page.evaluate(() => {
    const board = (window as any).board
    board.setOptions({ toolbar: false })
    board.setTool('rect')
    const host = document.querySelector('#board') as HTMLElement
    host.style.transformOrigin = 'top left'
    host.style.transform = 'scale(0.75)'
  })
  const host = page.locator('#board')
  await host.scrollIntoViewIfNeeded()
  const box = await host.boundingBox()
  if (!box) throw new Error('Missing host')
  for (const cancel of [true, false]) {
    await page.mouse.move(box.x + 100, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 3, box.y + 180, { steps: 6 })
    await expect.poll(() => page.evaluate(() => (window as any).board.getData().viewport.x)).toBeGreaterThan(150)
    if (cancel) await host.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
    await page.mouse.up()
    const saved = await page.evaluate(() => (window as any).board.getData())
    if (cancel) {
      expect(saved.viewport).toEqual({ x: 0, y: 0 })
      expect(saved.shapes).toEqual([])
    } else expect(saved.shapes[0].points[1].x).toBeLessThan(0)
  }
})

test('loading an unthemed document resets the previous document background', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const host = document.createElement('div')
    host.style.cssText = 'width:300px;height:200px;background-color:rgb(12, 34, 56)'
    document.body.append(host)
    const board = new (window as any).Drawboard(host)
    board.setBackground({ color: '#ff0000', pattern: 'grid' })
    board.loadData({ version: 1, width: 300, height: 200, shapes: [] })
    const saved = board.getData()
    const appearance = board.getBackground()
    board.destroy()
    return { saved, appearance, restored: host.style.backgroundColor }
  })
  expect(result.saved.background).toBeUndefined()
  expect(result.appearance).toMatchObject({ color: 'transparent', pattern: 'none' })
  expect(result.restored).toBe('rgb(12, 34, 56)')
})
