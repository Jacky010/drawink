import type { Bounds, Point, Shape, CustomShapeDefinition } from './types'
import { shapeBounds } from './model'

function poly(ctx: CanvasRenderingContext2D, points: number[][], close = true) {
  ctx.moveTo(points[0][0], points[0][1])
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y)
  if (close) ctx.closePath()
}

/** Local geometry fits entirely within the dragged rectangle, including 3D shapes. */
function geometry(ctx: CanvasRenderingContext2D, tool: Shape['tool'], w: number, h: number) {
  if (tool === 'rect') { ctx.rect(0, 0, w, h); return }
  if (tool === 'circle' || tool === 'ellipse') {
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    return
  }
  if (tool === 'triangle') return poly(ctx, [[w / 2, 0], [w, h], [0, h]])
  if (tool === 'diamond') return poly(ctx, [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]])
  if (tool === 'trapezoid') return poly(ctx, [[w * .25, 0], [w * .75, 0], [w, h], [0, h]])
  if (tool === 'parallelogram') return poly(ctx, [[w * .25, 0], [w, 0], [w * .75, h], [0, h]])
  if (tool === 'cuboid') {
    const d = Math.min(w, h) * .25
    ctx.rect(0, d, w - d, h - d)
    poly(ctx, [[0, d], [d, 0], [w, 0], [w, h - d], [w - d, h]], false)
    poly(ctx, [[w - d, d], [w, 0]], false)
    ctx.setLineDash([4, 4])
    poly(ctx, [[d, 0], [d, h - d], [w, h - d]], false)
    poly(ctx, [[d, h - d], [0, h]], false)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.rect(0, d, w - d, h - d)
    poly(ctx, [[0, d], [d, 0], [w, 0], [w, h - d], [w - d, h]], false)
    poly(ctx, [[w - d, d], [w, 0]], false)
    return
  }
  const ry = Math.min(h * .14, w * .16)
  const cy = h - ry
  if (tool === 'cylinder') {
    ctx.ellipse(w / 2, ry, w / 2, ry, 0, 0, Math.PI * 2)
    poly(ctx, [[0, ry], [0, cy]], false)
    poly(ctx, [[w, ry], [w, cy]], false)
  } else {
    poly(ctx, [[0, cy], [w / 2, 0], [w, cy]], false)
  }
  ctx.moveTo(w, cy)
  ctx.ellipse(w / 2, cy, w / 2, ry, 0, 0, Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.setLineDash([4, 4])
  ctx.ellipse(w / 2, cy, w / 2, ry, 0, Math.PI, Math.PI * 2)
}

function strokePath(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Render one scene object without leaking state to subsequent objects. */
export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, custom?: CustomShapeDefinition, viewZoom = 0) {
  ctx.save()
  ctx.globalAlpha = shape.opacity ?? 1
  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineWidth = viewZoom > 0 ? Math.max(1.5, shape.width) / viewZoom : shape.width
  ctx.lineCap = ctx.lineJoin = 'round'
  if (custom) { custom.draw(ctx, shape); ctx.restore(); return }
  ctx.beginPath()
  if (shape.tool === 'pen' || shape.tool === 'line') strokePath(ctx, shape.points)
  else {
    const bounds = shapeBounds(shape)
    ctx.translate(bounds.x + shape.width / 2, bounds.y + shape.width / 2)
    geometry(ctx, shape.tool, bounds.width - shape.width, bounds.height - shape.width)
  }
  ctx.stroke()
  ctx.restore()
}

/** Render selection without inserting it into the portable document. */
export function drawSelection(ctx: CanvasRenderingContext2D, bounds: Bounds, color = '#176b52') {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([5, 4])
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  ctx.restore()
}

