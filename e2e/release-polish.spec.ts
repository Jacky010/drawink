import { test, expect } from '@playwright/test'
test('background export work scales with output resolution instead of world area', async ({ page }) => {
  await page.goto('/?mode=infinite')
  const result = await page.evaluate(async () => {
    const b = (window as any).board
    b.loadData({ version: 1, mode: 'infinite', width: 800, height: 600, background: { color: '#fffdf6', pattern: 'dots', spacing: 4 }, shapes: [{ tool: 'line', color: '#000', width: 2, points: [{ x: 0, y: 0 }, { x: 2000, y: 2000 }] }] })
    const original = CanvasRenderingContext2D.prototype.fillRect
    let calls = 0
    CanvasRenderingContext2D.prototype.fillRect = function(...args) { calls++; return original.apply(this, args) }
    try {
      const image = new Image()
      image.src = await b.exportImage({ scale: .01, includeBackground: true })
      await image.decode()
      return { calls, width: image.width }
    } finally { CanvasRenderingContext2D.prototype.fillRect = original }
  })
  expect(result.width).toBeLessThan(30)
  expect(result.calls).toBeLessThan(2000)
})
test('React and Vue apply the same explicit initial options before watching later data updates', async ({ page }) => {
  await page.goto('/')
  const url = '/@fs/' + process.cwd().replace(/\\/g, '/') + '/e2e/fixtures/adapterOptions.ts'
  const result = await page.evaluate(async path => (await import(path)).compareInitialOptions(), url)
  expect(result).toEqual({
    react: { mode: 'infinite', color: '#ff0000' },
    vue: { mode: 'infinite', color: '#ff0000' },
  })
})
test('mutating the caller shape array cannot silently invalidate undo history', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board
    const definitions = [{ id: 'audit-shape', label: 'Audit', draw(ctx: CanvasRenderingContext2D) { ctx.strokeRect(0, 0, 10, 10) } }]
    b.setOptions({ shapes: definitions })
    b.loadData({ version: 1, width: 800, height: 600, shapes: [{ tool: 'audit-shape', color: '#000', width: 2, points: [{ x: 10, y: 10 }, { x: 100, y: 100 }] }] })
    b.clear()
    definitions.splice(0, 1)
    let rejected = false
    try { b.setOptions({ shapes: definitions }) } catch { rejected = true }
    b.undo()
    const saved = b.getData()
    b.loadData(saved)
    return { rejected, type: b.getData().shapes[0].tool }
  })
  expect(result).toEqual({ rejected: true, type: 'audit-shape' })
})

test('brush settings affect future shapes and survive JSON roundtrip', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board
    b.setBrush({ color: '#123', lineWidth: 8, opacity: .35 })
    const canvas = document.querySelector('.drawink-layer canvas')!
    const rect = canvas.getBoundingClientRect()
    for (const [type, x] of [['pointerdown', 150], ['pointermove', 230], ['pointerup', 230]] as const) canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: rect.left + x, clientY: rect.top + 200, bubbles: true }))
    const saved = b.getData(); b.loadData(saved)
    return { brush: b.getBrush(), shape: b.getData().shapes[0] }
  })
  expect(result.brush).toEqual({ color: '#123', lineWidth: 8, opacity: .35 })
  expect(result.shape).toMatchObject({ color: '#123', width: 8, opacity: .35 })
  await page.getByRole('button', { name: '画笔', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '画笔设置' })).toBeVisible()
  await expect(page.getByLabel('画笔颜色', { exact: true })).toHaveValue('#112233')
})
test('zoom anchors world coordinates, drawing, read-only navigation and JSON', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board
    b.setOptions({ mode: 'infinite' }); b.setZoom(2, { x: 100, y: 100 })
    const view = b.getViewport()
    const canvas = document.querySelector('.drawink-layer canvas')!
    const rect = canvas.getBoundingClientRect()
    for (const [type, x] of [['pointerdown', 100], ['pointermove', 200], ['pointerup', 200]] as const) canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: rect.left + x, clientY: rect.top + 200, bubbles: true }))
    const shape = b.getData().shapes[0]
    b.loadData(b.getData()); const restored = b.getViewport()
    b.setOptions({ readOnly: true }); b.setZoom(3)
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: rect.left + 150, clientY: rect.top + 150, cancelable: true }))
    return { view, restored, shape, readOnlyZoom: b.getViewport().zoom, count: b.getData().shapes.length }
  })
  expect(result.view).toEqual({ x: -100, y: -100, zoom: 2 })
  expect(result.restored).toEqual(result.view)
  expect(result.shape.points[0]).toEqual({ x: 100, y: 150 })
  expect(result.shape.points.at(-1)).toEqual({ x: 150, y: 150 })
  expect(result.readOnlyZoom).toBeLessThan(3)
  expect(result.count).toBe(1)
})
test('touch pinch cancels the draft and scales around the midpoint', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board; b.setOptions({ mode: 'infinite' })
    const canvas = document.querySelector('.drawink-layer canvas')!
    const rect = canvas.getBoundingClientRect()
    const send = (type: string, id: number, x: number) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, clientX: rect.left + x, clientY: rect.top + 220, bubbles: true }))
    send('pointerdown', 1, 100); send('pointerdown', 2, 200)
    send('pointermove', 2, 300); send('pointerup', 2, 300); send('pointerup', 1, 100)
    return { view: b.getViewport(), shapes: b.getData().shapes }
  })
  expect(result.view.zoom).toBeCloseTo(2)
  expect(result.shapes).toHaveLength(0)
})

test('disabling during a pinch stops subsequent touch camera changes', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board; b.setOptions({ mode: 'infinite' })
    const canvas = document.querySelector('.drawink-layer canvas')!
    const rect = canvas.getBoundingClientRect()
    const send = (type: string, id: number, x: number) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, clientX: rect.left + x, clientY: rect.top + 220, bubbles: true }))
    send('pointerdown', 1, 100); send('pointerdown', 2, 200)
    b.setOptions({ disabled: true }); const before = b.getViewport()
    send('pointermove', 2, 300)
    return { before, after: b.getViewport() }
  })
  expect(result.after).toEqual(result.before)
})
test('fit, zoomed selection and export preserve world geometry', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const b = (window as any).board
    b.loadData({ version: 1, mode: 'infinite', width: 800, height: 600, shapes: [{ tool: 'rect', width: 2, color: '#000', points: [{ x: -100, y: -80 }, { x: -50, y: -30 }] }] })
    const image = await b.exportImage()
    b.fitView(); const fitted = b.getViewport(); const afterFit = b.getData().shapes
    b.resetView(); b.setZoom(2, { x: 0, y: 0 }); b.setTool('select')
    // Move into positive space using panning, then drag the visible object at 2x.
    const canvas = document.querySelector('.drawink-layer canvas')!
    const rect = canvas.getBoundingClientRect()
    b.setTool('pan')
    const send = (type: string, x: number, y: number) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: rect.left + x, clientY: rect.top + y, bubbles: true }))
    send('pointerdown', 200, 200); send('pointermove', 500, 500); send('pointerup', 500, 500)
    b.setTool('select'); send('pointerdown', 150, 190); send('pointermove', 190, 230); send('pointerup', 190, 230)
    const moved = b.getData().shapes[0]
    return { fitted, afterFit, moved, exportSame: image === await (async () => { b.loadData({ version: 1, mode: 'infinite', width: 800, height: 600, viewport: { x: 500, y: 500, zoom: 4 }, shapes: afterFit }); return b.exportImage() })() }
  })
  expect(result.fitted.zoom).toBeGreaterThan(1)
  expect(result.afterFit[0].points[0]).toEqual({ x: -100, y: -80 })
  expect(result.exportSame).toBe(true)
  expect(result.moved.points).toEqual([{ x: -80, y: -60 }, { x: -30, y: -10 }])
})
test('short background hex is represented correctly in native color controls', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => (window as any).board.setBackground({ color: '#123a', patternColor: '#abcf' }))
  await page.getByRole('button', { name: '背景', exact: true }).click()
  await expect(page.getByLabel('背景颜色', { exact: true })).toHaveValue('#112233')
  await expect(page.getByLabel('纹理颜色', { exact: true })).toHaveValue('#aabbcc')
})

test('lost touch capture clears navigation bookkeeping before the next stroke', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board; b.setOptions({ mode: 'infinite' })
    const canvas = document.querySelector('.drawink-layer canvas')!
    const rect = canvas.getBoundingClientRect()
    const send = (type: string, id: number, x: number) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, clientX: rect.left + x, clientY: rect.top + 220, bubbles: true }))
    send('pointerdown', 1, 100); send('pointermove', 1, 150); send('lostpointercapture', 1, 150)
    send('pointerdown', 2, 200); send('pointermove', 2, 250); send('pointerup', 2, 250)
    return b.getData().shapes.length
  })
  expect(result).toBe(1)
})

test('controlled React with inline options retains user zoom and applies changed zoom options', async ({ page }) => {
  await page.goto('/')
  const url = '/@fs/' + process.cwd().replace(/\\/g, '/') + '/e2e/fixtures/adapterOptions.ts'
  const result = await page.evaluate(async path => (await import(path)).controlledZoom(), url)
  expect(result).toEqual({ userZoom: 2, userChanges: 1, optionZoom: 3 })
})

test('brush preview treats a color as color rather than a CSS background resource', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(() => {
    const b = (window as any).board
    b.setBrush({ color: 'url(https://example.invalid/paint.png)' })
    return (document.querySelector('.drawink-brush-preview') as HTMLElement).style.backgroundImage
  })
  expect(result).toBe('')
})
