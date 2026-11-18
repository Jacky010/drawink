import { CAMERA_LIMIT, WORLD_LIMIT, validateZoom } from './view'
import { validateBackground, cloneBackground } from './background'
import { shapeTools, type Bounds, type DrawingData, type Point, type Shape } from './types'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const handleOrder: ResizeHandle[] = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']
const finiteCoord = (n: number) => Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, n))

const positive = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 32768
const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= WORLD_LIMIT

/** Clone snapshots so consumers cannot mutate history by retaining a reference. */
export function cloneShapes(shapes: Shape[]): Shape[] {
  return shapes.map(shape => ({
    ...shape, points: shape.points.map(point => ({ ...point })),
  }))
}

/** Validate the complete document before the caller replaces any visible state. */
export function parseData(value: unknown, registeredTools: readonly string[] = []): DrawingData {
  const data = typeof value === 'string' ? JSON.parse(value) : value
  if (!data || data.version !== 1 || !positive(data.width) ||
      !positive(data.height) || !Array.isArray(data.shapes)) {
    throw new TypeError('Invalid drawing document (expected version 1)')
  }
  if (data.mode !== undefined && !['document', 'infinite'].includes(data.mode)) {
    throw new TypeError('Invalid drawing mode')
  }
  if (data.viewport !== undefined && (!data.viewport ||
      !Number.isFinite(data.viewport.x) || Math.abs(data.viewport.x) > CAMERA_LIMIT || !Number.isFinite(data.viewport.y) || Math.abs(data.viewport.y) > CAMERA_LIMIT)) {
    throw new TypeError('Invalid drawing viewport')
  }
  if (data.viewport?.zoom !== undefined) validateZoom(data.viewport.zoom)
  if (data.background !== undefined) validateBackground(data.background)
  for (const shape of data.shapes) {
    if (shape?.opacity !== undefined && (!Number.isFinite(shape.opacity) || shape.opacity < 0 || shape.opacity > 1)) throw new TypeError('Invalid shape opacity')
    if (!shape || (!shapeTools.includes(shape.tool) && !registeredTools.includes(shape.tool)) || !positive(shape.width) ||
        typeof shape.color !== 'string' || !shape.color.trim() ||
        !Array.isArray(shape.points) || !shape.points.length ||
        (shape.tool !== 'pen' && shape.points.length !== 2)) {
      throw new TypeError('Invalid drawing shape')
    }
    if (shape.points.some((p: unknown) =>
      !p || typeof p !== 'object' || !finite((p as any).x) || !finite((p as any).y))) {
      throw new TypeError('Invalid drawing coordinates')
    }
  }
  return {
    version: 1, width: data.width, height: data.height,
    ...(data.mode ? { mode: data.mode } : {}),
    ...(data.viewport ? { viewport: { x: data.viewport.x, y: data.viewport.y, ...(data.viewport.zoom !== undefined ? { zoom: data.viewport.zoom } : {}) } } : {}),
    ...(data.background ? { background: cloneBackground(data.background) } : {}),
    shapes: cloneShapes(data.shapes),
  }
}

/** Translate without modifying the original object or its points. */
export function moveShape(shape: Shape, dx: number, dy: number): Shape {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of shape.points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  dx = Math.max(-WORLD_LIMIT - minX, Math.min(WORLD_LIMIT - maxX, dx))
  dy = Math.max(-WORLD_LIMIT - minY, Math.min(WORLD_LIMIT - maxY, dy))
  return { ...shape, points: shape.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
}

/** Geometry bounds without stroke padding. Circle uses the longer drag edge. */
export function geometryBounds(shape: Shape): Bounds {
  let x = Infinity
  let y = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const point of shape.points) {
    x = Math.min(x, point.x)
    y = Math.min(y, point.y)
    right = Math.max(right, point.x)
    bottom = Math.max(bottom, point.y)
  }
  let width = right - x
  let height = bottom - y
  if (shape.tool === 'circle') {
    const [a, b] = shape.points
    const size = Math.max(width, height)
    x = b.x < a.x ? a.x - size : a.x
    y = b.y < a.y ? a.y - size : a.y
    width = height = size
  }
  return { x, y, width, height }
}

/** Visible shape bounds, including stroke thickness. Circle uses the longer drag edge. */
export function shapeBounds(shape: Shape): Bounds {
  const box = geometryBounds(shape)
  const pad = shape.width / 2
  return { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 }
}

/** Eight selection handles on a bounding box, corners first for hit-testing. */
export function resizeHandles(bounds: Bounds): Record<ResizeHandle, Point> {
  const mx = bounds.x + bounds.width / 2
  const my = bounds.y + bounds.height / 2
  return {
    nw: { x: bounds.x, y: bounds.y },
    n: { x: mx, y: bounds.y },
    ne: { x: bounds.x + bounds.width, y: bounds.y },
    e: { x: bounds.x + bounds.width, y: my },
    se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    s: { x: mx, y: bounds.y + bounds.height },
    sw: { x: bounds.x, y: bounds.y + bounds.height },
    w: { x: bounds.x, y: my },
  }
}

/** Hit-test selection handles in world space. */
export function hitResizeHandle(point: Point, bounds: Bounds, radius: number): ResizeHandle | null {
  if (!(radius > 0) || !(bounds.width >= 0) || !(bounds.height >= 0)) return null
  const handles = resizeHandles(bounds)
  for (const id of handleOrder) {
    const handle = handles[id]
    if (Math.abs(point.x - handle.x) <= radius && Math.abs(point.y - handle.y) <= radius) return id
  }
  return null
}

/** Adjust a box from the active handle while keeping a minimum size. */
export function resizeBounds(bounds: Bounds, handle: ResizeHandle, point: Point, minSize = 4, lockRatio = false): Bounds {
  let left = bounds.x
  let top = bounds.y
  let right = bounds.x + bounds.width
  let bottom = bounds.y + bounds.height
  const moveX = handle === 'nw' || handle === 'w' || handle === 'sw'
  const moveY = handle === 'nw' || handle === 'n' || handle === 'ne'
  const growX = handle === 'ne' || handle === 'e' || handle === 'se'
  const growY = handle === 'se' || handle === 's' || handle === 'sw'
  if (moveX) left = point.x
  if (growX) right = point.x
  if (moveY) top = point.y
  if (growY) bottom = point.y
  if (right < left + minSize) {
    if (moveX) left = right - minSize
    else right = left + minSize
  }
  if (bottom < top + minSize) {
    if (moveY) top = bottom - minSize
    else bottom = top + minSize
  }
  let width = right - left
  let height = bottom - top
  if (lockRatio) {
    const size = Math.max(width, height, minSize)
    if (moveX) left = right - size
    else if (growX) right = left + size
    else {
      const mid = (left + right) / 2
      left = mid - size / 2
      right = mid + size / 2
    }
    if (moveY) top = bottom - size
    else if (growY) bottom = top + size
    else {
      const mid = (top + bottom) / 2
      top = mid - size / 2
      bottom = mid + size / 2
    }
    width = height = size
  }
  left = finiteCoord(left)
  top = finiteCoord(top)
  right = finiteCoord(right)
  bottom = finiteCoord(bottom)
  return { x: left, y: top, width: Math.max(minSize, right - left), height: Math.max(minSize, bottom - top) }
}

/** Scale shape geometry into a new box without mutating the source. */
export function resizeShape(shape: Shape, from: Bounds, to: Bounds): Shape {
  if (shape.tool !== 'pen') {
    return {
      ...shape,
      points: [
        { x: finiteCoord(to.x), y: finiteCoord(to.y) },
        { x: finiteCoord(to.x + to.width), y: finiteCoord(to.y + to.height) },
      ],
    }
  }
  const sx = from.width === 0 ? 1 : to.width / from.width
  const sy = from.height === 0 ? 1 : to.height / from.height
  return {
    ...shape,
    points: shape.points.map(point => ({
      x: finiteCoord(from.width === 0 ? to.x : to.x + (point.x - from.x) * sx),
      y: finiteCoord(from.height === 0 ? to.y : to.y + (point.y - from.y) * sy),
    })),
  }
}

/** Inclusive bounding-box intersection used by object erasing and selection. */
export function intersects(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x &&
    a.y <= b.y + b.height && a.y + a.height >= b.y
}

/** Bounded, branching undo history. Entries are never exposed by reference. */
export class History {
  private entries: string[] = []
  private index = -1
  constructor(private limit = 100) {
    if (!Number.isInteger(limit) || limit < 2) throw new RangeError('historyLimit must be at least 2')
  }
  push(shapes: Shape[]) {
    const snapshot = JSON.stringify(shapes)
    if (this.entries[this.index] === snapshot) return
    this.entries = this.entries.slice(0, this.index + 1)
    this.entries.push(snapshot)
    if (this.entries.length > this.limit) this.entries.shift()
    this.index = this.entries.length - 1
  }
  undo(): Shape[] | null {
    return this.canUndo ? JSON.parse(this.entries[--this.index]) : null
  }
  redo(): Shape[] | null {
    return this.canRedo ? JSON.parse(this.entries[++this.index]) : null
  }
  /** Definitions needed by either undo or redo must remain registered. */
  usesTool(tool: string): boolean {
    return this.entries.some(entry => (JSON.parse(entry) as Shape[]).some(shape => shape.tool === tool))
  }
  get canUndo() { return this.index > 0 }
  get canRedo() { return this.index < this.entries.length - 1 }
  reset(shapes: Shape[]) {
    this.entries = []
    this.index = -1
    this.push(shapes)
  }
}
