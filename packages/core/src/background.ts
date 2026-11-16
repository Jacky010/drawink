import type { BackgroundSettings, BoardMode, Bounds, Point } from './types'
export const backgroundProperties = [
  'background-color', 'background-image', 'background-size',
  'background-position', 'background-attachment', 'background-repeat',
] as const
const colorPattern = /^(#[\da-f]{3,4}|#[\da-f]{6}([\da-f]{2})?|transparent)$/i

/** Keep serialized colors as colors, never arbitrary CSS resource expressions. */
export function validateBackground(value: unknown): asserts value is BackgroundSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid background')
  const settings = value as BackgroundSettings
  for (const color of [settings.color, settings.patternColor]) {
    if (color !== undefined && (typeof color !== 'string' || !colorPattern.test(color))) throw new TypeError('Invalid background color')
  }
  if (settings.pattern !== undefined && !['none', 'dots', 'grid'].includes(settings.pattern)) throw new TypeError('Invalid background pattern')
  if (settings.spacing !== undefined && (!Number.isFinite(settings.spacing) || settings.spacing < 4 || settings.spacing > 200)) {
    throw new RangeError('Background spacing must be between 4 and 200')
  }
}
/** Copy only portable public fields, without sharing caller objects. */
export function cloneBackground(value: BackgroundSettings): BackgroundSettings {
  const result: BackgroundSettings = {}
  if (value.color !== undefined) result.color = value.color
  if (value.pattern !== undefined) result.pattern = value.pattern
  if (value.patternColor !== undefined) result.patternColor = value.patternColor
  if (value.spacing !== undefined) result.spacing = value.spacing
  return result
}
export function resolveBackground(mode: BoardMode, value?: BackgroundSettings): Required<BackgroundSettings> {
  return {
    color: mode === 'infinite' ? '#fffdf6' : 'transparent',
    pattern: mode === 'infinite' ? 'dots' : 'none',
    patternColor: '#cdd8ce', spacing: 20, ...cloneBackground(value || {}),
  }
}
/** Host CSS stays behind the document; an opaque color never covers its text. */
export function applyBackground(host: HTMLElement, settings: Required<BackgroundSettings>, viewport: Point, mode: BoardMode, zoom = 1) {
  const { color, pattern, patternColor, spacing } = settings
  host.style.backgroundColor = color
  const scale = mode === 'infinite' ? zoom : 1
  // Show coarser world-grid levels rather than hiding the user's selected texture.
  const baseGap = spacing * scale
  const gap = mode === 'infinite' && baseGap < 12
    ? baseGap * 2 ** Math.ceil(Math.log2(12 / baseGap)) : baseGap
  const thickness = mode === 'infinite' ? Math.max(1, Math.min(2, scale)) : 1
  const texture = pattern
  host.style.backgroundImage = texture === 'dots'
    ? 'radial-gradient(circle, ' + patternColor + ' ' + thickness + 'px, transparent ' + thickness + 'px)'
    : texture === 'grid'
      ? 'linear-gradient(to right, ' + patternColor + ' ' + thickness + 'px, transparent ' + thickness + 'px), linear-gradient(to bottom, ' + patternColor + ' ' + thickness + 'px, transparent ' + thickness + 'px)'
      : 'none'
  host.style.backgroundSize = gap + 'px ' + gap + 'px'
  host.style.backgroundPosition = mode === 'infinite' ? viewport.x + 'px ' + viewport.y + 'px' : '0px 0px'
  host.style.backgroundAttachment = mode === 'document' ? 'local' : 'scroll'
  host.style.backgroundRepeat = 'repeat'
}
/** Optional exported background uses world coordinates, including negative regions. */
export function paintBackground(ctx: CanvasRenderingContext2D, area: Bounds, settings: Required<BackgroundSettings>, scale = 1, adaptive = false) {
  ctx.fillStyle = settings.color
  ctx.fillRect(area.x, area.y, area.width, area.height)
  if (settings.pattern === 'none') return
  const gap = adaptive && settings.spacing * scale < 12
    ? settings.spacing * 2 ** Math.ceil(Math.log2(12 / (settings.spacing * scale))) : settings.spacing
  if (gap * scale < 4) return
  const tile = ctx.canvas.ownerDocument.createElement('canvas')
  const pixels = Math.max(1, Math.ceil(gap * Math.min(scale, 4)))
  tile.width = tile.height = pixels
  const brush = tile.getContext('2d')!
  const unit = pixels / gap
  const stroke = adaptive ? Math.max(1, unit) : unit
  brush.fillStyle = settings.patternColor
  if (settings.pattern === 'dots') {
    brush.beginPath()
    brush.arc(pixels / 2, pixels / 2, stroke, 0, Math.PI * 2)
    brush.fill()
  } else {
    brush.fillRect(0, 0, pixels, stroke)
    brush.fillRect(0, 0, stroke, pixels)
  }
  const pattern = ctx.createPattern(tile, 'repeat')!
  pattern.setTransform({ a: 1 / unit, d: 1 / unit })
  ctx.fillStyle = pattern
  ctx.fillRect(area.x, area.y, area.width, area.height)
}
