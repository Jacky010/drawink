import type { DrawboardHandle } from './handle'
import type { BrushSettings } from './types'
import { colorInputValue } from './colorInput'
/** Native controls edit the next stroke without rewriting existing objects. */
export function createBrushPanel(doc: Document, actions: DrawboardHandle) {
  const panel = doc.createElement('div')
  panel.className = 'drawink-background-menu drawink-brush-menu'
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '画笔设置')
  panel.hidden = true
  function row(label: string, input: HTMLInputElement) {
    const line = doc.createElement('label'); line.textContent = label
    input.setAttribute('aria-label', label); line.append(input); panel.append(line)
  }
  const color = doc.createElement('input'); color.type = 'color'
  color.oninput = () => actions.setBrush({ color: color.value })
  row('画笔颜色', color)
  const width = doc.createElement('input'); width.type = 'number'
  width.min = '.1'; width.max = '32768'; width.step = '.5'
  width.onchange = () => actions.setBrush({ lineWidth: Math.max(.1, Math.min(32768, Number(width.value) || 3)) })
  row('画笔粗细', width)
  const opacity = doc.createElement('input'); opacity.type = 'range'
  opacity.min = '0'; opacity.max = '100'; opacity.step = '1'
  opacity.oninput = () => actions.setBrush({ opacity: Number(opacity.value) / 100 })
  row('画笔透明度', opacity)
  const preview = doc.createElement('div'); preview.className = 'drawink-brush-preview'
  preview.setAttribute('aria-hidden', 'true'); panel.append(preview)
  return {
    panel,
    close() { panel.hidden = true },
    update(settings: BrushSettings, locked: boolean) {
      color.value = colorInputValue(doc, settings.color, '#176b52')
      width.value = String(settings.lineWidth); opacity.value = String(settings.opacity * 100)
      opacity.setAttribute('aria-valuetext', Math.round(settings.opacity * 100) + '%')
      for (const input of [color, width, opacity]) input.disabled = locked
      preview.style.backgroundColor = settings.color
      preview.style.height = Math.min(18, settings.lineWidth) + 'px'
      preview.style.opacity = String(settings.opacity)
    },
  }
}
