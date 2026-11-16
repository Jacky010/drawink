import { createBrushPanel } from './brushPanel'
import { MIN_ZOOM, MAX_ZOOM } from './view'
import { shapeTools, type Tool, type CustomShapeDefinition, type ToolbarItem } from './types'
import type { DrawboardHandle } from './handle'
import { getToolbarIcon, renderToolbarIcon } from './toolbarIcon'
import { toolbarStyle } from './toolbarStyle'
import { createBackgroundPanel } from './backgroundPanel'
import { resolveBackground } from './background'
import type { BackgroundSettings, BrushSettings, ToolbarIcon } from './types'

export const toolLabels: Record<Tool, string> = {
  pen: '画笔', line: '直线', rect: '矩形', circle: '圆', ellipse: '椭圆',
  triangle: '三角形', diamond: '菱形', trapezoid: '梯形', parallelogram: '平行四边形',
  cuboid: '长方体', cylinder: '圆柱', cone: '圆锥',
  eraser: '对象擦除', select: '移动对象', pan: '滚动',
}
interface ToolbarActions extends DrawboardHandle {}
/** Compact floating toolbar with grouped shapes and declarative user actions. */
export function createToolbar(doc: Document, actions: ToolbarActions) {
  const el = doc.createElement('div')
  el.className = 'drawink-toolbar'
  el.setAttribute('role', 'toolbar')
  el.setAttribute('aria-label', '画板工具栏')
  const style = doc.createElement('style')
  style.textContent = toolbarStyle
  el.append(style)
  function button(label: string, name: string, run: () => void) {
    const item = doc.createElement('button')
    item.type = 'button'
    item.title = label
    item.setAttribute('aria-label', label)
    item.append(renderToolbarIcon(doc, undefined, name))
    item.onclick = run
    return item
  }
  function divider() {
    const line = doc.createElement('span')
    line.className = 'drawink-divider'
    line.setAttribute('aria-hidden', 'true')
    return line
  }
  const brush = createBrushPanel(doc, actions)
  el.append(brush.panel)
  const primary = new Map<Tool, HTMLButtonElement>()
  for (const tool of ['pen', 'pan', 'select', 'eraser'] as Tool[]) {
    const item = button(toolLabels[tool], tool, () => {
      const openBrush = tool === 'pen' && item.getAttribute('aria-pressed') === 'true' && brush.panel.hidden
      close()
      actions.setTool(tool)
      if (openBrush) { brush.panel.hidden = false; item.setAttribute('aria-expanded', 'true') }
    })
    item.setAttribute('aria-pressed', 'false')
    if (tool === 'pen') { item.setAttribute('aria-haspopup', 'dialog'); item.setAttribute('aria-expanded', 'false') }
    primary.set(tool, item)
    el.append(item)
  }
  const shapesButton = button('形状', 'shapes', () => {
    background.close(); brush.close(); exportPanel.hidden = true; exportPng.setAttribute('aria-expanded', 'false'); primary.get('pen')!.setAttribute('aria-expanded', 'false')
    menu.hidden = !menu.hidden
    shapesButton.setAttribute('aria-expanded', String(!menu.hidden))
  })
  shapesButton.setAttribute('aria-haspopup', 'dialog')
  shapesButton.setAttribute('aria-expanded', 'false')
  shapesButton.setAttribute('aria-pressed', 'false')
  el.append(shapesButton, divider())
  const clear = button('清空', 'clear', () => actions.clear())
  clear.className = 'drawink-danger'
  const undo = button('撤销', 'undo', () => actions.undo())
  const redo = button('重做', 'redo', () => actions.redo())
  el.append(clear, divider(), undo, redo, divider())
  const mode = doc.createElement('select')
  mode.className = 'drawink-mode'
  mode.setAttribute('aria-label', '画板模式')
  for (const [value, label] of [['document', '文档批注'], ['infinite', '无限画板']]) {
    const option = doc.createElement('option')
    option.value = value; option.textContent = label
    mode.append(option)
  }
  mode.onchange = () => actions.setMode(mode.value as 'document' | 'infinite')
  const reset = button('回到原点', 'reset', () => actions.resetView())
  const background = createBackgroundPanel(doc, actions, () => {
    brush.close(); exportPanel.hidden = true; exportPng.setAttribute('aria-expanded', 'false'); primary.get('pen')!.setAttribute('aria-expanded', 'false')
    menu.hidden = true
    shapesButton.setAttribute('aria-expanded', 'false')
  })
  let exporting = false
  const exportStatus = doc.createElement('div')
  exportStatus.className = 'drawink-export-status'
  exportStatus.setAttribute('role', 'alert'); exportStatus.hidden = true
  const exportPanel = doc.createElement('div')
  exportPanel.className = 'drawink-background-menu drawink-export-menu'
  exportPanel.setAttribute('role', 'dialog'); exportPanel.setAttribute('aria-label', '导出图片')
  exportPanel.hidden = true
  const exportTitle = doc.createElement('strong'); exportTitle.textContent = '导出 PNG'
  const exportHint = doc.createElement('p'); exportHint.textContent = '保存全部批注，自动适配图片尺寸。'
  const includeBackground = doc.createElement('input'); includeBackground.type = 'checkbox'
  const backgroundLabel = doc.createElement('label'); backgroundLabel.textContent = '包含背景'
  backgroundLabel.append(includeBackground)
  const exportPng = button('导出 PNG', 'export-png', () => {
    const open = exportPanel.hidden
    close(); exportStatus.hidden = true
    includeBackground.checked = false
    exportPanel.hidden = !open; exportPng.setAttribute('aria-expanded', String(open))
    if (open) includeBackground.focus()
  })
  exportPng.setAttribute('aria-haspopup', 'dialog'); exportPng.setAttribute('aria-expanded', 'false')
  const saveImage = button('保存图片', 'export-png', async () => {
    exporting = true; saveImage.disabled = exportPng.disabled = true; exportStatus.hidden = true
    try {
      const url = await actions.exportImage({ fit: true, includeBackground: includeBackground.checked })
      const link = doc.createElement('a')
      link.href = url; link.download = 'drawink.png'; link.click(); close()
    } catch (error) {
      exportStatus.textContent = '导出失败：' + (error instanceof Error ? error.message : String(error))
      exportStatus.hidden = false
    } finally { exporting = false; saveImage.disabled = exportPng.disabled = false }
  })
  saveImage.className = 'drawink-save-image'
  saveImage.append(doc.createTextNode('保存图片'))
  exportPanel.append(exportTitle, exportHint, backgroundLabel, saveImage)
  el.append(background.button, mode, reset, exportPng, background.panel, exportPanel, exportStatus)
  const zoomOut = button('缩小', 'zoom-out', () => actions.setZoom(Math.max(MIN_ZOOM, actions.getViewport().zoom / 1.2)))
  const zoomIn = button('放大', 'zoom-in', () => actions.setZoom(Math.min(MAX_ZOOM, actions.getViewport().zoom * 1.2)))
  const zoomReset = button('重置缩放', 'zoom-reset', () => actions.setZoom(1))
  const fit = button('显示全部', 'fit-view', () => actions.fitView())
  const zoomBar = doc.createElement('div')
  zoomBar.className = 'drawink-zoom-bar'
  zoomBar.append(zoomOut, zoomReset, zoomIn, fit)
  el.append(zoomBar)
  const builtinButtons = new Map<string, HTMLButtonElement>([...primary, ['shapes', shapesButton], ['clear', clear], ['undo', undo], ['redo', redo], ['reset', reset], ['background', background.button], ['export-png', exportPng], ['zoom-out', zoomOut], ['zoom-in', zoomIn], ['fit-view', fit]])
  const extensionDivider = divider()
  extensionDivider.classList.add('drawink-custom-divider')
  const extensions = doc.createElement('div')
  extensions.className = 'drawink-custom-items'
  el.append(extensionDivider, extensions)
  const menu = doc.createElement('div')
  menu.className = 'drawink-shape-menu'
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-label', '形状')
  menu.hidden = true
  el.append(menu)
  function close() {
    menu.hidden = true
    shapesButton.setAttribute('aria-expanded', 'false')
    background.close(); brush.close(); primary.get('pen')!.setAttribute('aria-expanded', 'false')
    exportPanel.hidden = true; exportPng.setAttribute('aria-expanded', 'false')
  }
  const outside = (event: Event) => { if (!el.contains(event.target as Node)) close() }
  const escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && (!menu.hidden || !background.panel.hidden || !brush.panel.hidden || !exportPanel.hidden)) {
      const trigger = !exportPanel.hidden ? exportPng : !brush.panel.hidden ? primary.get('pen')! : !background.panel.hidden ? background.button : shapesButton
      close(); trigger.focus()
    }
  }
  doc.addEventListener('pointerdown', outside)
  el.addEventListener('keydown', escape)
  function updateShapes(tool: Tool, locked: boolean, shapes: CustomShapeDefinition[], icons: Record<string, ToolbarIcon>) {
    menu.replaceChildren()
    for (const id of [...shapeTools.filter(id => id !== 'pen'), ...shapes.map(shape => shape.id)]) {
      const custom = shapes.find(shape => shape.id === id)
      const label = custom?.label || toolLabels[id]
      const item = button(label, id, () => { actions.setTool(id); close() })
      item.replaceChildren(renderToolbarIcon(doc, getToolbarIcon(icons, id) ?? custom?.icon, id))
      const text = doc.createElement('span')
      text.textContent = label
      item.append(text)
      item.disabled = locked
      item.setAttribute('aria-pressed', String(tool === id))
      menu.append(item)
    }
  }
  return {
    el,
    update(tool: Tool, locked: boolean, canUndo: boolean, canRedo: boolean,
      infinite = false, shapes: CustomShapeDefinition[] = [], items: ToolbarItem[] = [],
      appearance: Required<BackgroundSettings> = resolveBackground('document'), icons: Record<string, ToolbarIcon> = {}, brushSettings: BrushSettings = actions.getBrush(), zoom = 1, disabled = false) {
      for (const [key, button] of builtinButtons) button.replaceChildren(renderToolbarIcon(doc, getToolbarIcon(icons, key), key))
      background.update(appearance, locked)
      brush.update(brushSettings, locked)
      if (locked) { menu.hidden = true; shapesButton.setAttribute('aria-expanded', 'false'); background.close(); brush.close() }
      zoomBar.hidden = !infinite
      for (const item of [zoomOut, zoomReset, zoomIn, fit]) { item.hidden = !infinite; item.disabled = disabled }
      zoomOut.disabled = disabled || zoom <= MIN_ZOOM
      zoomIn.disabled = disabled || zoom >= MAX_ZOOM
      const customReset = getToolbarIcon(icons, 'zoom-reset')
      zoomReset.replaceChildren(...(customReset ? [renderToolbarIcon(doc, customReset, 'zoom-reset')] : [doc.createTextNode(Number((zoom * 100).toFixed(3)) + '%')]))
      zoomReset.title = '重置缩放 · ' + Number((zoom * 100).toFixed(3)) + '%'
      reset.disabled = disabled
      exportPng.disabled = disabled || exporting
      for (const [id, item] of primary) {
        item.disabled = id === 'pan' ? disabled : locked
        item.setAttribute('aria-pressed', String(id === tool))
      }
      const pan = primary.get('pan')!
      pan.title = infinite ? '平移画布' : '滚动'
      pan.setAttribute('aria-label', pan.title)
      shapesButton.disabled = locked
      shapesButton.setAttribute('aria-pressed', String(!primary.has(tool)))
      undo.disabled = locked || !canUndo
      redo.disabled = locked || !canRedo
      clear.disabled = locked
      mode.disabled = locked
      mode.value = infinite ? 'infinite' : 'document'
      reset.hidden = !infinite
      updateShapes(tool, locked, shapes, icons)
      extensions.replaceChildren()
      extensionDivider.hidden = !items.length
      for (const item of items) {
        const custom = button(item.label, '', () => item.onClick(actions))
        custom.replaceChildren(renderToolbarIcon(doc, getToolbarIcon(icons, item.id) ?? item.icon))
        custom.append(doc.createTextNode(item.label))
        custom.disabled = typeof item.disabled === 'function' ? item.disabled(actions) : !!item.disabled
        extensions.append(custom)
      }
    },
    destroy() {
      doc.removeEventListener('pointerdown', outside)
      el.removeEventListener('keydown', escape)
      mode.onchange = null
      el.remove()
    },
  }
}
