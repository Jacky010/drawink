import type { Point } from './types'
export const MIN_ZOOM = .00001
export const MAX_ZOOM = 8
export const WORLD_LIMIT = 1_000_000_000_000_000
export const CAMERA_LIMIT = 1_000_000_000
export const clamp = (n: number, limit: number) => Math.min(limit, Math.max(-limit, n))
export function camera(point: Point): Point { return { x: clamp(point.x, CAMERA_LIMIT), y: clamp(point.y, CAMERA_LIMIT) } }
export function validateZoom(zoom: number) {
  if (!Number.isFinite(zoom) || zoom < MIN_ZOOM || zoom > MAX_ZOOM) throw new RangeError('Zoom must be between 0.00001 and 8')
}
