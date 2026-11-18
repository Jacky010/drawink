import { test, expect } from '@playwright/test'
test('toolbar exposes primary tools and groups geometry in a shapes popover', async ({ page }) => {
  await page.goto('/')
  const toolbar = page.getByRole('toolbar', { name: '画板工具栏' })
  await expect(toolbar).toBeVisible()
  for (const name of ['画笔', '对象擦除', '选择对象', '滚动', '形状']) {
    await expect(toolbar.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await expect(toolbar.getByLabel('画板模式', { exact: true })).toHaveValue('document')
  await toolbar.getByRole('button', { name: '形状', exact: true }).click()
  await page.getByRole('button', { name: '圆柱', exact: true }).click()
  await expect(toolbar.getByRole('button', { name: '形状', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('dialog', { name: '形状' })).toBeHidden()
  await toolbar.getByRole('button', { name: '画笔', exact: true }).click()
  await expect(toolbar.getByRole('button', { name: '画笔', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
test('custom toolbar actions and registered shapes use the shared drawing API', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    (window as any).board.setOptions({
      shapes: [{
        id: 'star', label: '五角星',
        draw(ctx: CanvasRenderingContext2D, shape: any) {
          const [a, b] = shape.points
          const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
          const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2
          ctx.beginPath()
          for (let i = 0; i < 10; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .45 : 1
            const x = cx + Math.cos(angle) * rx * r, y = cy + Math.sin(angle) * ry * r
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          }
          ctx.closePath(); ctx.stroke()
        },
      }],
      toolbarItems: [{
        id: 'save-example', label: '自定义保存', icon: '↓',
        onClick(api: any) { (window as any).pluginSaved = api.getData() },
      }],
    })
  })
  await page.getByRole('button', { name: '形状', exact: true }).click()
  await page.getByRole('button', { name: '五角星', exact: true }).click()
  const box = await page.locator('#board').boundingBox()
  if (!box) throw new Error('No host')
  await page.mouse.move(box.x + 90, box.y + 150)
  await page.mouse.down()
  await page.mouse.move(box.x + 190, box.y + 250, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('button', { name: '自定义保存', exact: true }).click()
  expect(await page.evaluate(() => (window as any).pluginSaved.shapes[0].tool)).toBe('star')
  const restored = await page.evaluate(async () => {
    const board = (window as any).board
    board.loadData(JSON.stringify(board.getData()))
    return { tool: board.getData().shapes[0].tool, image: (await board.exportImage()).startsWith('data:image/png') }
  })
  expect(restored).toEqual({ tool: 'star', image: true })
})


test('removing custom shapes protects history and falls back to a usable pen', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const board = (window as any).board
    board.registerShape({ id: 'example', label: '扩展图形', draw(ctx: CanvasRenderingContext2D, shape: any) {
      const [a, b] = shape.points
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
    } })
    board.setTool('example')
  })
  const box = await page.locator('#board').boundingBox()
  if (!box) throw new Error('No board')
  await page.mouse.move(box.x + 80, box.y + 120)
  await page.mouse.down()
  await page.mouse.move(box.x + 180, box.y + 220, { steps: 5 })
  await page.mouse.up()
  const rejected = await page.evaluate(() => {
    const board = (window as any).board
    board.clear()
    try { board.setOptions({ shapes: [] }); return false } catch { return true }
  })
  expect(rejected).toBe(true)
  const result = await page.evaluate(() => {
    const board = (window as any).board
    board.undo()
    const saved = board.getData()
    board.loadData(saved)
    board.loadData({ version: 1, width: 800, height: 1200, shapes: [] })
    board.setOptions({ shapes: [] })
    return { restored: saved.shapes[0].tool, tool: board.tool }
  })
  expect(result).toEqual({ restored: 'example', tool: 'pen' })
})
