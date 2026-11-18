import { describe, expect, it } from 'vitest'
import { History, parseData, moveShape, intersects, shapeBounds, hitResizeHandle, resizeBounds, resizeShape, geometryBounds } from '../packages/core/src/model'
const shape = { tool: 'rect' as const, points: [{ x: 10, y: 20 }, { x: 110, y: 80 }], color: '#f00', width: 3 }
const data = { version: 1 as const, width: 800, height: 600, shapes: [shape] }
describe('portable lesson drawing data', () => {
  it('validates and clones imported data without sharing caller objects', () => {
    const parsed = parseData(data)
    parsed.shapes[0].points[0].x = 999
    expect(data.shapes[0].points[0].x).toBe(10)
    expect(parseData(JSON.stringify(data))).toEqual(data)
  })
  it.each([
    { ...data, version: 2 },
    { ...data, width: 0 },
    { ...data, shapes: [{ ...shape, tool: 'unknown' }] },
    { ...data, shapes: [{ ...shape, width: -1 }] },
    { ...data, shapes: [{ ...shape, points: [{ x: NaN, y: 0 }] }] },
    { ...data, shapes: [{ ...shape, color: {} }] },
  ])('rejects malformed data before replacing the drawing', value => {
    expect(() => parseData(value)).toThrow()
  })
  it('moves geometry without mutating the source', () => {
    expect(moveShape(shape, 5, -10).points).toEqual([{ x: 15, y: 10 }, { x: 115, y: 70 }])
    expect(shape.points[0]).toEqual({ x: 10, y: 20 })
  })
  it('uses the visible bounds of a reverse-drawn circle', () => {
    const bounds = shapeBounds({ ...shape, tool: 'circle', points: [{ x: 100, y: 100 }, { x: 50, y: 80 }] })
    expect(bounds).toEqual({ x: 48.5, y: 48.5, width: 53, height: 53 })
  })
  it('resizes shapes from selection handles without mutating the source', () => {
    const bounds = shapeBounds(shape)
    expect(hitResizeHandle({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, bounds, 4)).toBe('se')
    expect(hitResizeHandle({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, bounds, 4)).toBeNull()
    const next = resizeBounds(bounds, 'se', { x: bounds.x + bounds.width + 40, y: bounds.y + bounds.height + 20 }, 4)
    const resized = resizeShape(shape, geometryBounds(shape), {
      x: next.x + shape.width / 2,
      y: next.y + shape.width / 2,
      width: next.width - shape.width,
      height: next.height - shape.width,
    })
    expect(resized.points).toEqual([{ x: 10, y: 20 }, { x: 150, y: 100 }])
    expect(shape.points[1]).toEqual({ x: 110, y: 80 })
    const square = resizeBounds(bounds, 'e', { x: bounds.x + 200, y: bounds.y }, 4, true)
    expect(square.width).toBe(square.height)
  })
  it('erases objects whose bounds intersect the selection', () => {
    expect(intersects(shapeBounds(shape), { x: 109, y: 79, width: 10, height: 10 })).toBe(true)
    expect(intersects(shapeBounds(shape), { x: 200, y: 200, width: 10, height: 10 })).toBe(false)
  })
})
describe('bounded history', () => {
  it('restores snapshots, discards abandoned redo, and isolates caller data', () => {
    const history = new History(3)
    history.push([])
    history.push([shape])
    expect(history.undo()).toEqual([])
    expect(history.redo()).toEqual([shape])
    history.undo()
    history.push([{ ...shape, color: '#00f' }])
    expect(history.canRedo).toBe(false)
    const restored = history.undo()!
    restored.push(shape)
    expect(history.redo()![0].color).toBe('#00f')
  })
  it('bounds memory and ignores duplicate snapshots', () => {
    const history = new History(2)
    history.push([])
    history.push([shape])
    history.push([shape])
    history.push([{ ...shape, color: '#00f' }])
    expect(history.undo()).toEqual([shape])
    expect(history.undo()).toBeNull()
  })
})


// Regression: large imports must remain selectable/erasable without argument-spread limits.
it('computes bounds for long imported strokes without overflowing the call stack', () => {
  const points = Array.from({ length: 200000 }, (_, index) => ({ x: index % 1000, y: index % 500 }))
  const parsed = parseData({ ...data, shapes: [{ ...shape, tool: 'pen', points }] })
  expect(shapeBounds(parsed.shapes[0])).toEqual({ x: -1.5, y: -1.5, width: 1002, height: 502 })
})
it('rejects extreme finite coordinates which would produce infinite geometry', () => {
  expect(() => parseData({ ...data, shapes: [{ ...shape, points: [{ x: -Number.MAX_VALUE, y: 0 }, { x: Number.MAX_VALUE, y: 1 }] }] })).toThrow()
})


it('preserves infinite viewport metadata and rejects invalid cameras', () => {
  const infinite = { ...data, mode: 'infinite', viewport: { x: -300, y: 500 } }
  expect(parseData(infinite)).toEqual(infinite)
  expect(() => parseData({ ...infinite, viewport: { x: NaN, y: 0 } })).toThrow()
  expect(() => parseData({ ...data, mode: 'unknown' })).toThrow()
})

it('accepts only explicitly registered custom shape identifiers', () => {
  const custom = { ...data, shapes: [{ ...shape, tool: 'star' }] }
  expect(() => parseData(custom)).toThrow()
  expect(parseData(custom, ['star']).shapes[0].tool).toBe('star')
})

it('preserves background settings and rejects invalid patterns or spacing', () => {
  const background = { color: '#233344', pattern: 'grid', patternColor: '#aaaaaa', spacing: 24 }
  expect(parseData({ ...data, background }).background).toEqual(background)
  expect(() => parseData({ ...data, background: { pattern: 'invalid' } })).toThrow()
  expect(() => parseData({ ...data, background: { spacing: 0 } })).toThrow()
  expect(() => parseData({ ...data, background: { color: 'url(https://example.com)' } })).toThrow()
})

it.each(['notacolor', 'inherit', 'rgb(999999)'])('rejects a background color with inconsistent CSS/Canvas meaning: %s', color => {
  expect(() => parseData({ ...data, background: { color } })).toThrow()
})

describe('zoomed portable data and coordinate bounds', () => {
  it('roundtrips zoom and opacity while rejecting invalid numeric values', () => {
    const doc = { ...data, mode: 'infinite', viewport: { x: 50000000, y: -50000000, zoom: .01 }, shapes: [{ ...shape, opacity: .25 }] }
    expect(parseData(doc)).toEqual(doc)
    for (const zoom of [0, 9, NaN, Infinity]) expect(() => parseData({ ...doc, viewport: { ...doc.viewport, zoom } })).toThrow()
    for (const opacity of [-1, 2, NaN]) expect(() => parseData({ ...doc, shapes: [{ ...shape, opacity }] })).toThrow()
  })
  it('clamps translation as a whole so generated data remains loadable', () => {
    const moved = moveShape(shape, 2000000000000000, -2000000000000000)
    expect(moved.points[1].x - moved.points[0].x).toBe(100)
    expect(moved.points[1].y - moved.points[0].y).toBe(60)
    expect(parseData({ ...data, shapes: [moved] }).shapes).toEqual([moved])
  })
})
