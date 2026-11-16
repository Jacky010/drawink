import type { DrawboardHandle } from './handle'
import type { BackgroundSettings } from './types'
import { colorInputValue } from './colorInput'
import { icon } from './toolbarIcons'

/** Background controls are shared by all framework adapters. */
export function createBackgroundPanel(doc: Document, actions: DrawboardHandle, onOpen: () => void) {
  const button = doc.createElement('button')
  button.type = 'button'; button.title = '背景'
  button.setAttribute('aria-label', '背景')
  button.setAttribute('aria-haspopup', 'dialog')
  button.setAttribute('aria-expanded', 'false')
  button.append(icon(doc, 'background'))
  const panel = doc.createElement('div')
  panel.className = 'drawink-background-menu'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', '背景设置')
  panel.hidden = true
  const controls: (HTMLInputElement | HTMLSelectElement | HTMLButtonElement)[] = []
  function row(label: string, input: HTMLInputElement | HTMLSelectElement) {
    const line = doc.createElement('label')
    line.textContent = label
    input.setAttribute('aria-label', label)
    line.append(input); panel.append(line); controls.push(input)
  }
  const color = doc.createElement('input'); color.type = 'color'
  color.oninput = () => actions.setBackground({ color: color.value })
  row('背景颜色', color)
  const transparent = doc.createElement('input'); transparent.type = 'checkbox'
  transparent.onchange = () => actions.setBackground({ color: transparent.checked ? 'transparent' : color.value })
  row('透明背景', transparent)
  const presets = doc.createElement('div'); presets.className = 'drawink-color-presets'
  for (const [label, value] of [['白色', '#ffffff'], ['米色', '#fffdf6'], ['浅灰', '#f3f4f6'], ['深色', '#1f2937']]) {
    const preset = doc.createElement('button')
    preset.type = 'button'; preset.title = label
    preset.setAttribute('aria-label', '背景：' + label)
    preset.style.backgroundColor = value
    preset.onclick = () => actions.setBackground({ color: value })
    presets.append(preset); controls.push(preset)
  }
  panel.append(presets)
  const pattern = doc.createElement('select')
  for (const [value, label] of [['none', '纯色'], ['dots', '点阵'], ['grid', '网格']]) {
    const option = doc.createElement('option'); option.value = value; option.textContent = label
    pattern.append(option)
  }
  pattern.onchange = () => actions.setBackground({ pattern: pattern.value as BackgroundSettings['pattern'] })
  row('背景纹理', pattern)
  const patternColor = doc.createElement('input'); patternColor.type = 'color'
  patternColor.oninput = () => actions.setBackground({ patternColor: patternColor.value })
  row('纹理颜色', patternColor)
  const spacing = doc.createElement('input')
  spacing.type = 'number'; spacing.min = '4'; spacing.max = '200'; spacing.step = '4'
  spacing.onchange = () => actions.setBackground({ spacing: Math.min(200, Math.max(4, Number(spacing.value) || 20)) })
  row('纹理间距', spacing)
  function close() { panel.hidden = true; button.setAttribute('aria-expanded', 'false') }
  button.onclick = () => {
    const open = panel.hidden
    onOpen()
    panel.hidden = !open
    button.setAttribute('aria-expanded', String(open))
  }
  return {
    button, panel, close,
    update(settings: Required<BackgroundSettings>, locked: boolean) {
      button.disabled = locked
      controls.forEach(control => { control.disabled = locked })
      color.value = colorInputValue(doc, settings.color, '#fffdf6')
      transparent.checked = settings.color === 'transparent'
      pattern.value = settings.pattern
      patternColor.value = colorInputValue(doc, settings.patternColor, '#cdd8ce')
      spacing.value = String(settings.spacing)
    },
  }
}
