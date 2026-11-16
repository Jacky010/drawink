import type { ToolbarIcon } from './types'
import { icon as builtinIcon } from './toolbarIcons'

const svgTags = new Set('svg g path circle ellipse rect line polyline polygon defs linearGradient radialGradient stop clipPath mask symbol use title desc text tspan'.split(' '))
const svgAttributes = new Set('viewBox d x y x1 y1 x2 y2 cx cy r rx ry width height fill stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset fill-rule clip-rule opacity fill-opacity stroke-opacity transform points id class offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod clip-path clipPathUnits maskUnits maskContentUnits preserveAspectRatio vector-effect font-size font-family text-anchor dx dy'.split(' '))
const svgStyles = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'opacity', 'color', 'font-size', 'font-family']
const localPaint = (value: string) => {
  if (/[\\]|\/\*|(?:var|env|expression)\s*\(/i.test(value)) return false
  return !/url\s*\(/i.test(value) || /^url\(\s*#[\w:.-]+\s*\)$/i.test(value)
}
/** Missing own keys must not resolve to Object.prototype functions. */
export function getToolbarIcon(icons: Record<string, ToolbarIcon>, key: string): ToolbarIcon | undefined {
  return Object.prototype.hasOwnProperty.call(icons, key) ? icons[key] : undefined
}

/** Validate declarative icons before a runtime options update can alter the toolbar. */
export function validateToolbarIcon(value: unknown) {
  if (value === undefined || typeof value === 'string' || typeof value === 'function') return
  if (!value || typeof value !== 'object') throw new TypeError('Invalid toolbar icon')
  const entry = value as Record<string, unknown>
  if (entry.type === 'image' && typeof entry.src === 'string' && entry.src.trim()) {
    const src = entry.src.replace(/[\u0000-\u0020]/g, '')
    const scheme = src.match(/^[a-z][a-z\d+.-]*:/i)?.[0]
    if (!scheme || /^(https?:|blob:)$/i.test(scheme) || /^data:image\/(png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(src)) return
  }
  if (entry.type === 'svg' && typeof entry.content === 'string' && entry.content.length > 0 && entry.content.length <= 65536) return
  if (entry.type === 'font' && typeof entry.className === 'string' && entry.className.trim() &&
    (entry.text === undefined || typeof entry.text === 'string')) return
  throw new TypeError('Invalid toolbar icon (expected image, svg, font, text or DOM factory)')
}

/** Inline SVG keeps drawing primitives; scripts, events and external resources are excluded. */
function inlineSvg(doc: Document, content: string): SVGElement | null {
  const Parser = doc.defaultView?.DOMParser
  if (!Parser) return null
  const parsed = new Parser().parseFromString(content, 'image/svg+xml')
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') return null
  function copy(source: Element, depth = 0): SVGElement | null {
    if (depth > 40 || !svgTags.has(source.localName)) return null
    const node = doc.createElementNS('http://www.w3.org/2000/svg', source.localName)
    for (const attribute of Array.from(source.attributes)) {
      const { name, value } = attribute
      if (attribute.localName === 'href' && /^#[\w:.-]+$/.test(value)) node.setAttribute('href', value)
      else if (svgAttributes.has(name) && localPaint(value)) node.setAttribute(name, value)
      else if (name === 'style') {
        const style = doc.createElement('span').style
        style.cssText = value
        for (const property of svgStyles) {
          const setting = style.getPropertyValue(property)
          if (setting && localPaint(setting)) node.style.setProperty(property, setting)
        }
      }
    }
    if (['title', 'desc', 'text', 'tspan'].includes(source.localName)) node.textContent = source.textContent
    else for (const child of Array.from(source.children)) { const safe = copy(child, depth + 1); if (safe) node.append(safe) }
    return node
  }
  return copy(parsed.documentElement)
}

/** One renderer for built-in overrides, user actions and custom shape icons. */
export function renderToolbarIcon(doc: Document, value?: ToolbarIcon, fallback = 'shapes'): HTMLElement {
  const wrapper = doc.createElement('span')
  wrapper.className = 'drawink-icon'
  wrapper.setAttribute('aria-hidden', 'true')
  let node: Node | null = null
  if (typeof value === 'function') {
    const result = value(doc)
    if (result && [1, 3, 11].includes(result.nodeType)) node = doc.importNode(result, true)
  } else if (typeof value === 'string') {
    const text = doc.createElement('span'); text.textContent = value; node = text
  } else if (value?.type === 'image') {
    const img = doc.createElement('img'); img.src = value.src; img.alt = ''; img.draggable = false
    node = img
  } else if (value?.type === 'svg') node = inlineSvg(doc, value.content)
  else if (value?.type === 'font') {
    const font = doc.createElement('i'); font.className = value.className; font.textContent = value.text || ''
    node = font
  }
  wrapper.append(node || builtinIcon(doc, fallback))
  return wrapper
}
