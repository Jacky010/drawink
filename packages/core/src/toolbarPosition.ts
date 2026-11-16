import type { ToolbarPosition } from './types'
const placements = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']
export function validateToolbarPosition(value: ToolbarPosition) {
  if (typeof value === 'string' ? !placements.includes(value) : !value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError('Invalid toolbar position')
  }
}
/** Anchor in the visible host, including a scrolled document and resized containers. */
export function positionToolbar(el: HTMLElement, host: HTMLElement, value: ToolbarPosition = 'top-center') {
  const w = host.clientWidth, h = host.clientHeight
  const hostRect = host.getBoundingClientRect(), rect = el.getBoundingClientRect()
  const tw = hostRect.width ? rect.width * host.offsetWidth / hostRect.width : el.offsetWidth
  const th = hostRect.height ? rect.height * host.offsetHeight / hostRect.height : el.offsetHeight
  const custom = typeof value !== 'string'
  const bottom = custom ? value.y > h / 2 : value.startsWith('bottom')
  let x = custom ? value.x : value.endsWith('left') ? 16 : value.endsWith('right') ? w - tw - 16 : (w - tw) / 2
  let y = custom ? value.y : bottom ? h - th - 16 : 16
  x = Math.max(0, Math.min(Math.max(0, w - tw), x))
  y = Math.max(0, Math.min(Math.max(0, h - th), y))
  el.dataset.placement = bottom ? 'bottom' : 'top'
  el.style.setProperty('--drawink-panel-height', Math.max(80, bottom ? y - 10 : h - y - th - 10) + 'px')
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  el.style.transform = 'none'
}
