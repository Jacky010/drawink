import { test, expect } from '@playwright/test'

for (const zoom of [.0043, .05, 1, 2]) test('infinite brush width remains visibly adjustable at zoom ' + zoom, async ({ page }) => {
  await page.goto('/?mode=infinite')
  await page.evaluate(zoom => { const b = (window as any).board; b.setZoom(zoom, { x: 0, y: 0 }) }, zoom)
  await page.getByRole('button', { name: '画笔', exact: true }).click()
  await page.getByLabel('画笔粗细', { exact: true }).fill('15.1')
  await page.getByLabel('画笔粗细', { exact: true }).press('Tab')
  const result = await page.evaluate(() => {
    const b = (window as any).board
    const canvas = document.querySelector('.drawink-layer canvas') as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const draw = (y: number) => {
      for (const [type, x] of [['pointerdown', 200], ['pointermove', 400], ['pointerup', 400]] as const) canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: rect.left + x, clientY: rect.top + y, bubbles: true }))
    }
    draw(300); b.setBrush({ lineWidth: 3 }); draw(400)
    const ratio = canvas.width / canvas.clientWidth
    function thickness(y: number) {
      const data = canvas.getContext('2d')!.getImageData(Math.round(300 * ratio), Math.round((y - 25) * ratio), 1, Math.round(50 * ratio)).data
      let count = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] > 100) count++
      return count / ratio
    }
    return { thick: thickness(300), thin: thickness(400), widths: b.getData().shapes.map((s: any) => s.width) }
  })
  expect(result.widths).toEqual([15.1, 3])
  expect(result.thick).toBeGreaterThanOrEqual(14)
  expect(result.thin).toBeGreaterThanOrEqual(2)
  expect(result.thick).toBeGreaterThan(result.thin * 3)
})
