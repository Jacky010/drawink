import { test, expect } from '@playwright/test'

test('zooming out keeps thin strokes legible without changing stored color, alpha or export', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const board = (window as any).board
    board.loadData({ version: 1, mode: 'infinite', width: 800, height: 600, shapes: [
      { tool: 'line', width: 3, color: '#176b52', points: [{ x: 1000, y: 2000 }, { x: 7000, y: 2000 }] },
      { tool: 'pen', width: 3, color: '#176b52', opacity: .4, points: [{ x: 1000, y: 4000 }, { x: 7000, y: 4000 }] },
    ] })
    const before = board.getData().shapes
    const image = await board.exportImage({ scale: .05 })
    board.setZoom(.05, { x: 0, y: 0 })
    const canvas = document.querySelector('.drawink-layer canvas') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const ratio = canvas.width / canvas.clientWidth
    function peak(y: number) {
      const pixels = ctx.getImageData(Math.round(150 * ratio), Math.round((y - 4) * ratio), 1, Math.round(8 * ratio)).data
      let max = 0, color: number[] = []
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > max) { max = pixels[i + 3]; color = [...pixels.slice(i, i + 3)] }
      return { alpha: max, color }
    }
    return { opaque: peak(100), translucent: peak(200), unchanged: JSON.stringify(before) === JSON.stringify(board.getData().shapes), exportSame: image === await board.exportImage({ scale: .05 }) }
  })
  expect(result.opaque.alpha).toBeGreaterThanOrEqual(180)
  expect(result.translucent.alpha / result.opaque.alpha).toBeCloseTo(.4, 1)
  for (const [i, channel] of [23, 107, 82].entries()) expect(Math.abs(result.opaque.color[i] - channel)).toBeLessThanOrEqual(3)
  expect(result.unchanged).toBe(true)
  expect(result.exportSame).toBe(true)
})
