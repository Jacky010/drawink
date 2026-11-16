import type { CustomShapeDefinition, ToolbarItem } from '@drawink/core'
/** Example extension shared unchanged by JavaScript, Vue and React. */
export const exampleShapes: CustomShapeDefinition[] = [{
  id: 'star-example', label: '星形（扩展）', icon: '☆',
  draw(ctx, shape) {
    const [a, b] = shape.points
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
    const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5
      const radius = i % 2 ? .45 : 1
      const x = cx + Math.cos(angle) * rx * radius
      const y = cy + Math.sin(angle) * ry * radius
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  },
}]
export const exampleToolbarItems: ToolbarItem[] = [{
  id: 'export-json', label: '保存 JSON', icon: '↗',
  onClick(api) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(api.getData(), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'drawink.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}]
