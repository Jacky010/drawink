/** Native color controls need opaque six-digit hex, even for short/alpha CSS colors. */
export function colorInputValue(doc: Document, color: string, fallback: string): string {
  const hex = color.match(/^#([\da-f]{3,4}|[\da-f]{6}(?:[\da-f]{2})?)$/i)?.[1]
  if (hex) return '#' + (hex.length < 5 ? hex.slice(0, 3).split('').map(c => c + c).join('') : hex.slice(0, 6))
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = fallback; ctx.fillStyle = color
  const normalized = String(ctx.fillStyle)
  if (/^#[\da-f]{6}$/i.test(normalized)) return normalized
  ctx.fillRect(0, 0, 1, 1)
  return '#' + [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('')
}
