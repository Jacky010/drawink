/** Small inline SVG icons; no icon runtime or external assets required. */
const paths: Record<string, string> = {
  'zoom-in': 'M10 4a6 6 0 110 12 6 6 0 010-12zm4 10l6 6M7 10h6m-3-3v6',
  'zoom-out': 'M10 4a6 6 0 110 12 6 6 0 010-12zm4 10l6 6M7 10h6',
  'fit-view': 'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6M8 8h8v8H8z',
  'export-png': 'M12 3v12m-4-4l4 4 4-4M4 16v5h16v-5',
  background: 'M12 3l9 9-9 9-9-9 9-9zm-9 9h18M12 3v18',
  pen: 'M4 16l-1 5 5-1L20 8l-4-4L4 16zm10-10l4 4M4 16l4 4',
  eraser: 'M3 14L13 4l8 8-8 8H9l-6-6zm5-5l8 8M13 20h8',
  select: 'M4 3l14 10-7 1-3 7L4 3z',
  pan: 'M8 12V6a2 2 0 014 0v6-8a2 2 0 014 0v8-6a2 2 0 014 0v9c0 5-3 8-7 8h-1c-3 0-5-2-7-5l-3-5a2 2 0 013-2l3 3',
  shapes: 'M3 4h7v7H3zM14 4l7 7h-7zM11 18a4 4 0 11-8 0 4 4 0 018 0zM15 15h6v6h-6z',
  undo: 'M8 5L3 10l5 5M3 10h10a7 7 0 017 7',
  redo: 'M16 5l5 5-5 5m5-5H11a7 7 0 00-7 7',
  clear: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7',
  reset: 'M4 10a8 8 0 111 8M4 4v6h6',
  line: 'M4 20L20 4',
  rect: 'M4 5h16v14H4z',
  circle: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0',
  ellipse: 'M22 12a10 6 0 11-20 0 10 6 0 0120 0',
  triangle: 'M12 3l10 18H2L12 3z',
  diamond: 'M12 2l10 10-10 10L2 12 12 2z',
  trapezoid: 'M7 4h10l5 16H2L7 4z',
  parallelogram: 'M7 4h15l-5 16H2L7 4z',
  cuboid: 'M3 8l6-5h12v13l-6 5H3V8zm0 0h12v13M15 8l6-5M9 3v13H3m6 0h12',
  cylinder: 'M3 6c0-5 18-5 18 0s-18 5-18 0v12c0 5 18 5 18 0V6',
  cone: 'M3 18L12 3l9 15c0 5-18 5-18 0zm0 0c0-4 18-4 18 0',
}
/** Icons are created as DOM, not unsanitized user HTML. */
export function icon(doc: Document, name: string): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '20')
  svg.setAttribute('height', '20')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.7')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const path = doc.createElementNS(svg.namespaceURI, 'path')
  path.setAttribute('d', paths[name] || paths.shapes)
  svg.append(path)
  return svg
}
