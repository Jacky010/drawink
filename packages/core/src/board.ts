import { positionToolbar, validateToolbarPosition } from './toolbarPosition'
import { MIN_ZOOM, MAX_ZOOM, WORLD_LIMIT, camera, clamp, validateZoom } from './view'
import { validateToolbarIcon } from './toolbarIcon'
import { applyBackground, backgroundProperties, cloneBackground, paintBackground, resolveBackground, validateBackground } from './background'
import { cloneShapes, History, intersects, moveShape, parseData, shapeBounds } from './model'
import { drawSelection, drawShape } from './renderer'
import { createToolbar } from './toolbar'
import { shapeTools, type BrushSettings, type Viewport, type BackgroundSettings, type CustomShapeDefinition, type BoardMode, type Bounds, type DrawboardOptions, type DrawingData, type ExportImageOptions, type Point, type Shape, type Tool } from './types'

const defaults = {
  mode: 'document' as BoardMode, tool: 'pen' as Tool, color: '#176b52', lineWidth: 3, opacity: 1,
  disabled: false, readOnly: false, toolbar: true, penOnly: false, autoPan: true,
}
const instances = new WeakSet<HTMLElement>()
type Options = typeof defaults & DrawboardOptions
interface Gesture {
  id: number
  start: Point
  last: Point
  before: Shape[]
  draft?: Shape
  index: number
  scrollX: number
  scrollY: number
  viewport: Point
  pointer: Point
}
function rectangle(a: Point, b: Point): Bounds {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}
function validateOptions(options: DrawboardOptions, registered: CustomShapeDefinition[] = []) {
  if (options.toolbarPosition !== undefined) validateToolbarPosition(options.toolbarPosition)
  if (options.zoom !== undefined) validateZoom(options.zoom)
  if (options.opacity !== undefined && (!Number.isFinite(options.opacity) || options.opacity < 0 || options.opacity > 1)) throw new RangeError('Opacity must be between 0 and 1')
  if (options.background !== undefined) validateBackground(options.background)
  if (options.toolbarIcons !== undefined) {
    if (!options.toolbarIcons || typeof options.toolbarIcons !== 'object' || Array.isArray(options.toolbarIcons)) throw new TypeError('toolbarIcons must be an icon map')
    Object.values(options.toolbarIcons).forEach(validateToolbarIcon)
  }
  options.toolbarItems?.forEach(item => validateToolbarIcon(item?.icon))
  const shapes = options.shapes ?? registered
  if (!Array.isArray(shapes)) throw new TypeError('shapes must be an array')
  const reserved: string[] = [...shapeTools, 'eraser', 'select', 'pan']
  const ids = new Set<string>()
  for (const shape of shapes) {
    if (!shape || typeof shape.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(shape.id) ||
        reserved.includes(shape.id) || ids.has(shape.id) ||
        typeof shape.label !== 'string' || !shape.label.trim() || typeof shape.draw !== 'function') {
      throw new TypeError('Custom shapes need a unique non-reserved id, label and draw function')
    }
    validateToolbarIcon(shape.icon)
    ids.add(shape.id)
  }
  if (options.toolbarItems !== undefined && (!Array.isArray(options.toolbarItems) ||
      options.toolbarItems.some(item => !item || !item.id || !item.label || typeof item.onClick !== 'function'))) {
    throw new TypeError('Toolbar items need id, label and onClick')
  }
  if (options.mode !== undefined && !['document', 'infinite'].includes(options.mode)) throw new TypeError('Unknown board mode')
  for (const value of [options.width, options.height, options.contentHeight, options.lineWidth]) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0 || value > 32768)) {
      throw new RangeError('Dimensions and lineWidth must be positive and at most 32768')
    }
  }
  if (options.color !== undefined && (typeof options.color !== 'string' || !options.color.trim())) {
    throw new TypeError('color must be a non-empty CSS color')
  }
  if (options.tool !== undefined && ![...shapeTools, ...shapes.map(shape => shape.id), 'eraser', 'select', 'pan'].includes(options.tool)) {
    throw new TypeError('Unknown drawing tool')
  }
}

/** Framework-independent teaching drawing surface. Creates no DOM until instantiated. */
export class Drawboard {
  private options: Options
  private shapes: Shape[] = []
  private viewport: Point = { x: 0, y: 0 }
  private zoom = 1
  private touches = new Map<number, Point>()
  private pinching = false
  private pinch?: { distance: number; zoom: number; world: Point }
  private width: number
  private height: number
  private history: History
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private layer: HTMLDivElement
  private toolbarLayer: HTMLDivElement
  private toolbar: ReturnType<typeof createToolbar>
  private observer: ResizeObserver
  private gesture: Gesture | null = null
  private selected = -1
  private destroyed = false
  private frame = 0
  private edgeFrame = 0
  private edgeTime = 0
  private savedBackground: Record<string, string>
  private backgroundApplied = false
  private defaultBackground?: BackgroundSettings
  private viewWidth = 0
  private viewHeight = 0
  private savedPosition: string
  private savedOverflow: string
  private win: Window
  private pixelRatio = 1

  constructor(private container: HTMLElement, options: DrawboardOptions = {}) {
    validateOptions(options)
    if (instances.has(container)) throw new Error('Container already owns a Drawboard')
    const data = options.data ? parseData(options.data, options.shapes?.map(shape => shape.id)) : null
    this.history = new History(options.historyLimit ?? 100)
    this.win = container.ownerDocument.defaultView!
    this.options = { ...defaults, ...options, mode: options.mode ?? data?.mode ?? 'document' }
    this.options.shapes = options.shapes?.map(shape => ({ ...shape }))
    this.defaultBackground = options.background ? cloneBackground(options.background) : undefined
    this.options.background = options.background ?? data?.background
    this.viewport = data?.viewport ? { ...data.viewport } : { x: 0, y: 0 }
    this.zoom = options.zoom ?? data?.viewport?.zoom ?? 1
    this.viewport = { x: this.viewport.x, y: this.viewport.y }
    this.width = data?.width ?? options.width ?? (container.clientWidth || 800)
    this.height = data?.height ?? (this.options.mode === 'document' ? options.contentHeight : undefined) ?? options.height ?? (container.clientHeight || 600)
    this.shapes = data?.shapes ?? []
    this.savedPosition = container.style.position
    this.savedOverflow = container.style.overflow
    this.savedBackground = Object.fromEntries(backgroundProperties.map(property => [property, container.style.getPropertyValue(property)]))
    this.canvas = container.ownerDocument.createElement('canvas')
    const context = this.canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')
    this.context = context
    if (this.win.getComputedStyle(container).position === 'static') container.style.position = 'relative'
    this.layer = container.ownerDocument.createElement('div')
    this.layer.className = 'drawink-layer'
    this.layer.style.cssText = 'position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:1'
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'
    this.canvas.setAttribute('aria-label', 'Drawing canvas')
    this.canvas.setAttribute('role', 'img')
    this.layer.append(this.canvas)
    container.append(this.layer)
    this.toolbar = createToolbar(container.ownerDocument, this)
    this.toolbarLayer = container.ownerDocument.createElement('div')
    this.toolbarLayer.className = 'drawink-toolbar-layer'
    this.toolbarLayer.style.cssText = 'position:sticky;top:0;left:0;width:100%;height:0;z-index:5;pointer-events:none'
    this.toolbar.el.style.pointerEvents = 'auto'
    this.toolbarLayer.append(this.toolbar.el)
    container.prepend(this.toolbarLayer)
    this.bind()
    this.observer = new ResizeObserver(() => this.refresh())
    this.observer.observe(container)
    this.history.reset(this.shapes)
    instances.add(container)
    this.refresh()
  }

  private get locked() { return this.options.disabled || this.options.readOnly }
  get canUndo() { return this.history.canUndo }
  get canRedo() { return this.history.canRedo }
  get tool() { return this.options.tool }
  get mode() { return this.options.mode }

  /** Merge runtime options. Logical width/height and historyLimit are construction settings. */
  setOptions(options: DrawboardOptions) {
    this.assertAlive()
    validateOptions(options, this.options.shapes)
    const zoomChanged = options.zoom !== undefined && options.zoom !== this.options.zoom
    if (options.shapes) {
      const ids = options.shapes.map(shape => shape.id)
      parseData(this.getData(), ids)
      for (const shape of this.options.shapes || []) {
        if (!ids.includes(shape.id) && this.history.usesTool(shape.id)) {
          throw new Error('Cannot remove a shape referenced by undo/redo history; load a document to reset history first')
        }
      }
    }
    const shapeChanged = options.shapes && (options.shapes.length !== (this.options.shapes || []).length || options.shapes.some((shape, i) => {
      const old = this.options.shapes?.[i]
      return !old || shape.id !== old.id || shape.label !== old.label || shape.draw !== old.draw || shape.icon !== old.icon
    }))
    if (shapeChanged) this.blur()
    const interactive = ['autoPan', 'mode', 'tool', 'color', 'lineWidth', 'opacity', 'disabled', 'readOnly', 'penOnly', 'contentHeight'] as const
    if (interactive.some(key => options[key] !== undefined && options[key] !== this.options[key])) this.blur()
    if (options.mode !== undefined && options.mode !== this.options.mode) {
      this.viewport = { x: 0, y: 0 }
      this.zoom = 1
      this.container.scrollTop = this.container.scrollLeft = 0
    }
    this.options = { ...this.options, ...options, ...(options.background ? { background: { ...this.options.background, ...options.background } } : {}) }
    if (options.shapes) this.options.shapes = options.shapes.map(shape => ({ ...shape }))
    const tools: string[] = [...shapeTools, 'eraser', 'select', 'pan', ...(this.options.shapes || []).map(shape => shape.id)]
    if (!tools.includes(this.tool)) this.options.tool = 'pen'
    if (this.mode === 'document' && options.contentHeight !== undefined) this.height = options.contentHeight
    this.refresh()
    if (zoomChanged) this.setZoom(options.zoom!)
  }
  setTool(tool: Tool) { this.setOptions({ tool }) }
  /** Apply the mode first, then notify apps managing separate documents. */
  setMode(mode: BoardMode) {
    this.assertAlive()
    if (!['document', 'infinite'].includes(mode)) throw new TypeError('Unknown board mode')
    this.setOptions({ mode })
    this.options.onModeChange?.(mode)
  }
  getBrush(): BrushSettings {
    return { color: this.options.color, lineWidth: this.options.lineWidth, opacity: this.options.opacity }
  }
  setBrush(settings: Partial<BrushSettings>) { this.setOptions(settings) }
  getViewport(): Viewport { return { ...this.viewport, zoom: this.zoom } }
  /** Anchor is in CSS pixels relative to the canvas viewport. */
  setZoom(zoom: number, anchor: Point = { x: this.viewWidth / 2, y: this.viewHeight / 2 }) {
    this.assertAlive()
    validateZoom(zoom)
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) throw new TypeError('Invalid zoom anchor')
    if (this.mode !== 'infinite' || this.options.disabled || zoom === this.zoom) return
    this.blur()
    this.viewport = camera({ x: anchor.x - (anchor.x - this.viewport.x) * zoom / this.zoom, y: anchor.y - (anchor.y - this.viewport.y) * zoom / this.zoom })
    this.zoom = zoom
    this.render(); this.updateToolbar()
    this.options.onChange?.(this.getData())
  }
  /** Fit all committed shapes, including objects outside the visible viewport. */
  fitView(padding = 32) {
    this.assertAlive()
    if (!Number.isFinite(padding) || padding < 0) throw new RangeError('Invalid fit padding')
    if (this.mode !== 'infinite' || this.options.disabled) return
    if (!this.shapes.length) { this.resetView(); return }
    this.blur()
    const area = this.exportArea()
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(Math.max(1, this.viewWidth - padding * 2) / area.width, Math.max(1, this.viewHeight - padding * 2) / area.height)))
    this.viewport = camera({ x: this.viewWidth / 2 - (area.x + area.width / 2) * this.zoom, y: this.viewHeight / 2 - (area.y + area.height / 2) * this.zoom })
    this.render(); this.updateToolbar()
    this.options.onChange?.(this.getData())
  }
  getBackground(): Required<BackgroundSettings> {
    return resolveBackground(this.mode, this.options.background)
  }
  /** Changing appearance does not erase objects or enter undo history. */
  setBackground(background: BackgroundSettings) {
    this.assertAlive()
    const before = JSON.stringify(this.getBackground())
    this.setOptions({ background })
    if (JSON.stringify(this.getBackground()) !== before) this.options.onChange?.(this.getData())
  }
  /** Add a shape to this instance only; no shared global registry. */
  registerShape(shape: CustomShapeDefinition) {
    this.setOptions({ shapes: [...(this.options.shapes || []), shape] })
  }
  /** Reset the infinite view or scroll a document back to its origin; does not erase. */
  resetView() {
    this.assertAlive()
    this.blur()
    this.viewport = { x: 0, y: 0 }
    this.zoom = 1
    this.updateToolbar()
    this.container.scrollTop = this.container.scrollLeft = 0
    this.syncToolbar()
    this.render()
    this.options.onChange?.(this.getData())
  }

  /** Return a detached snapshot; changing it never changes the visible drawing. */
  getData(): DrawingData {
    this.assertAlive()
    return {
      version: 1, width: this.width, height: this.height,
      shapes: cloneShapes(this.shapes),
      ...(this.options.background ? { background: cloneBackground(this.options.background) } : {}),
      ...(this.mode === 'infinite' ? { mode: this.mode, viewport: { ...this.viewport, ...(this.zoom !== 1 ? { zoom: this.zoom } : {}) } } : {}),
    }
  }
  /** Atomically load a validated document and reset undo history. */
  loadData(value: DrawingData | string) {
    this.assertAlive()
    const data = parseData(value, this.options.shapes?.map(shape => shape.id))
    this.blur()
    this.width = data.width
    this.height = data.height
    this.shapes = data.shapes
    this.options.mode = data.mode ?? 'document'
    const background = data.background ?? this.defaultBackground
    this.options.background = background ? cloneBackground(background) : undefined
    this.viewport = data.viewport ? { ...data.viewport } : { x: 0, y: 0 }
    this.zoom = data.viewport?.zoom ?? 1
    this.viewport = { x: this.viewport.x, y: this.viewport.y }
    this.selected = -1
    this.history.reset(this.shapes)
    this.refresh()
  }
  clear() {
    this.assertAlive()
    if (this.locked) return
    this.cancel()
    this.shapes = []
    this.commit()
  }
  undo() { return this.restore('undo') }
  redo() { return this.restore('redo') }

  private restore(direction: 'undo' | 'redo') {
    this.assertAlive()
    if (this.locked) return false
    this.cancel()
    const shapes = this.history[direction]()
    if (!shapes) return false
    this.shapes = shapes
    this.changed()
    return true
  }
  private commit() {
    this.history.push(this.shapes)
    this.changed()
  }
  private changed() {
    this.selected = -1
    this.render()
    this.updateToolbar()
    this.options.onChange?.(this.getData())
  }
  private updateToolbar() {
    this.toolbar.el.style.display = this.options.toolbar ? 'flex' : 'none'
    this.toolbar.update(this.options.tool, this.locked, this.canUndo, this.canRedo, this.mode === 'infinite', this.options.shapes, this.options.toolbarItems, this.getBackground(), this.options.toolbarIcons, this.getBrush(), this.zoom, this.options.disabled)
    this.syncToolbar()
  }

  /** Recalculate CSS viewport size without changing document coordinates. */
  refresh = () => {
    if (this.destroyed) return
    const width = this.container.clientWidth || this.options.width || 800
    const height = (this.mode === 'document' ? this.options.contentHeight : undefined) ?? (this.container.clientHeight || this.options.height || 600)
    this.viewWidth = width
    this.viewHeight = height
    this.layer.style.height = height + 'px'
    if (this.mode === 'infinite') {
      this.container.style.overflow = 'hidden'
      this.container.scrollTop = this.container.scrollLeft = 0
    }
    else if (this.options.contentHeight) this.container.style.overflow = 'auto'
    else this.container.style.overflow = this.savedOverflow
    this.pixelRatio = Math.min(this.win.devicePixelRatio || 1, 2)
    const budget = Math.sqrt(32_000_000 / (width * height))
    this.pixelRatio = Math.min(this.pixelRatio, budget)
    this.canvas.width = Math.max(1, Math.round(width * this.pixelRatio))
    this.canvas.height = Math.max(1, Math.round(height * this.pixelRatio))
    this.canvas.style.pointerEvents = this.options.disabled ? 'none' : 'auto'
    this.canvas.style.touchAction = this.options.disabled || (this.options.readOnly && this.mode === 'document' && this.tool !== 'pan') ? 'auto' : 'none'
    this.canvas.style.cursor = this.options.tool === 'pan' ? 'grab' : this.options.tool === 'select' ? 'default' : 'crosshair'
    this.updateToolbar()
    this.render()
  }

  private render = () => {
    if (this.destroyed) return
    this.updateBackground()
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.mode === 'infinite') {
      const sx = this.canvas.width / this.viewWidth
      const sy = this.canvas.height / this.viewHeight
      this.context.setTransform(sx, 0, 0, sy, 0, 0)
      this.context.translate(this.viewport.x, this.viewport.y)
      this.context.scale(this.zoom, this.zoom)
    } else this.context.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0)
    // Infinite view uses screen-pixel brush widths; world geometry and exports stay unchanged.
    const strokeZoom = this.mode === 'infinite' ? this.zoom : 0
    for (const shape of this.shapes) drawShape(this.context, shape, this.options.shapes?.find(item => item.id === shape.tool), strokeZoom)
    if (this.gesture?.draft) drawShape(this.context, this.gesture.draft, this.options.shapes?.find(item => item.id === this.gesture?.draft?.tool), strokeZoom)
    if (!this.locked && this.gesture && this.options.tool === 'eraser') {
      drawSelection(this.context, rectangle(this.gesture.start, this.gesture.last), '#b54b37')
    }
    if (this.selected >= 0 && this.shapes[this.selected]) {
      drawSelection(this.context, shapeBounds(this.shapes[this.selected]))
    }
  }
  private restoreBackground() {
    for (const property of backgroundProperties) this.container.style.setProperty(property, this.savedBackground[property])
    this.backgroundApplied = false
  }
  private updateBackground() {
    if (this.mode === 'document' && !this.options.background) {
      if (this.backgroundApplied) this.restoreBackground()
      return
    }
    applyBackground(this.container, this.getBackground(), this.viewport, this.mode, this.zoom)
    this.backgroundApplied = true
  }
  private schedule() {
    if (this.frame) return
    this.frame = this.win.requestAnimationFrame(() => { this.frame = 0; this.render() })
  }
  private point(event: Pick<PointerEvent, 'clientX' | 'clientY'>): Point {
    const rect = this.canvas.getBoundingClientRect()
    const infinite = this.mode === 'infinite'
    const zoom = infinite ? this.zoom : 1
    return {
      x: clamp(((event.clientX - rect.left) * (infinite ? this.viewWidth : this.width) / rect.width - (infinite ? this.viewport.x : 0)) / zoom, WORLD_LIMIT),
      y: clamp(((event.clientY - rect.top) * (infinite ? this.viewHeight : this.height) / rect.height - (infinite ? this.viewport.y : 0)) / zoom, WORLD_LIMIT),
    }
  }

  private down = (event: PointerEvent) => {
    if (this.touchDown(event)) return
    if (this.options.disabled || (this.options.readOnly && this.mode !== 'infinite' && this.tool !== 'pan') || this.gesture || event.button !== 0 ||
        (this.options.penOnly && event.pointerType === 'touch')) return
    event.preventDefault()
    const p = this.point(event)
    this.gesture = {
      id: event.pointerId, start: p, last: p, before: cloneShapes(this.shapes),
      index: -1, scrollX: event.clientX, scrollY: event.clientY,
      viewport: { ...this.viewport }, pointer: { x: event.clientX, y: event.clientY },
    }
    if (!this.locked && (shapeTools.includes(this.options.tool as any) || this.options.shapes?.some(shape => shape.id === this.tool))) {
      this.gesture.draft = {
        tool: this.options.tool as Shape['tool'], color: this.options.color,
        width: this.options.lineWidth, ...(this.options.opacity !== 1 ? { opacity: this.options.opacity } : {}), points: [p],
      }
      if (this.options.tool !== 'pen') this.gesture.draft.points.push(p)
    }
    if (!this.locked && this.options.tool === 'select') this.selectAt(p)
    try { this.canvas.setPointerCapture(event.pointerId) } catch { /* Synthetic or already ended pointer. */ }
    this.edgeFrame = this.win.requestAnimationFrame(this.edgePan)
    this.schedule()
  }
  private selectAt(point: Point) {
    this.selected = -1
    for (let index = this.shapes.length - 1; index >= 0; index--) {
      if (intersects(shapeBounds(this.shapes[index]), { ...point, width: 0, height: 0 })) {
        this.selected = index
        this.gesture!.index = index
        break
      }
    }
  }
  private move = (event: PointerEvent) => {
    if (this.touchMove(event)) return
    const gesture = this.gesture
    if (!gesture || event.pointerId !== gesture.id) return
    event.preventDefault()
    gesture.pointer = { x: event.clientX, y: event.clientY }
    this.updateGesturePoint(this.point(event))
    if (this.options.tool === 'pan' || this.options.readOnly) this.pan(event, gesture)
    this.schedule()
  }
  private updateGesturePoint(p: Point) {
    const gesture = this.gesture
    if (!gesture) return
    gesture.last = p
    if (gesture.draft) {
      if (this.tool === 'pen') gesture.draft.points.push(p)
      else gesture.draft.points[1] = p
    }
    if (gesture.index >= 0) {
      this.shapes[gesture.index] = moveShape(gesture.before[gesture.index], p.x - gesture.start.x, p.y - gesture.start.y)
    }
  }
  /** Advance the camera continuously while drawing or moving against an edge. */
  private edgePan = (time: number) => {
    this.edgeFrame = 0
    const gesture = this.gesture
    if (!gesture || this.locked || this.mode !== 'infinite' || !this.options.autoPan ||
        (!gesture.draft && gesture.index < 0 && this.tool !== 'eraser')) return
    const dt = Math.min(32, this.edgeTime ? time - this.edgeTime : 16) / 1000
    this.edgeTime = time
    const rect = this.canvas.getBoundingClientRect()
    const x = (gesture.pointer.x - rect.left) * this.viewWidth / rect.width
    const y = (gesture.pointer.y - rect.top) * this.viewHeight / rect.height
    const velocity = (value: number, size: number) => value < 36
      ? -600 * Math.min(1, (36 - value) / 36)
      : value > size - 36 ? 600 * Math.min(1, (value - size + 36) / 36) : 0
    const vx = velocity(x, this.viewWidth), vy = velocity(y, this.viewHeight)
    if (vx || vy) {
      this.viewport.x -= vx * dt
      this.viewport.y -= vy * dt
      this.viewport = camera(this.viewport)
      this.updateGesturePoint(this.point({ clientX: gesture.pointer.x, clientY: gesture.pointer.y }))
      this.schedule()
    }
    this.edgeFrame = this.win.requestAnimationFrame(this.edgePan)
  }
  private stopEdgePan() {
    this.win.cancelAnimationFrame(this.edgeFrame)
    this.edgeFrame = this.edgeTime = 0
  }
  private pan(event: PointerEvent, gesture: Gesture) {
    const rect = this.canvas.getBoundingClientRect()
    const sx = this.viewWidth / rect.width
    const sy = this.viewHeight / rect.height
    if (this.mode === 'infinite') {
      this.viewport.x += (event.clientX - gesture.scrollX) * sx
      this.viewport.y += (event.clientY - gesture.scrollY) * sy
      this.viewport = camera(this.viewport)
    } else {
      this.container.scrollLeft += (gesture.scrollX - event.clientX) * sx
      this.container.scrollTop += (gesture.scrollY - event.clientY) * sy
    }
    gesture.scrollX = event.clientX
    gesture.scrollY = event.clientY
  }
  private up = (event: PointerEvent) => {
    if (this.touchEnd(event)) return
    const gesture = this.gesture
    if (!gesture || event.pointerId !== gesture.id) return
    this.stopEdgePan()
    this.move(event)
    if (gesture.draft) {
      if (gesture.draft.tool === 'pen' || Math.hypot(gesture.last.x - gesture.start.x, gesture.last.y - gesture.start.y) > 1) {
        this.shapes.push(gesture.draft)
      }
    }
    if (!this.locked && this.options.tool === 'eraser') {
      const box = rectangle(gesture.start, gesture.last)
      this.shapes = this.shapes.filter(shape => !intersects(shapeBounds(shape), box))
    }
    this.gesture = null
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    if (JSON.stringify(this.shapes) !== JSON.stringify(gesture.before)) this.commit()
    else {
      this.render()
      if (this.mode === 'infinite' && (this.viewport.x !== gesture.viewport.x || this.viewport.y !== gesture.viewport.y)) {
        this.options.onChange?.(this.getData())
      }
    }
  }
  private cancel = (event?: PointerEvent) => {
    if (!this.gesture || (event && event.pointerId !== this.gesture.id)) return
    this.stopEdgePan()
    const id = this.gesture.id
    this.shapes = this.gesture.before
    this.viewport = this.gesture.viewport
    this.gesture = null
    this.selected = -1
    if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id)
    this.render()
  }
  /** Keep the toolbar anchored in the visible viewport while content scrolls. */
  private syncToolbar = () => {
    positionToolbar(this.toolbar.el, this.container, this.options.toolbarPosition)
  }
  private blur = () => {
    this.cancel()
    const ids = [...this.touches.keys()]
    this.touches.clear(); this.pinching = false; this.pinch = undefined
    for (const id of ids) {
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id)
    }
  }
  private abort = (event: PointerEvent) => { this.touchEnd(event); this.cancel(event) }
  private lostCapture = (event: PointerEvent) => {
    // A second touch may release then immediately recapture the first pointer.
    if (!this.canvas.hasPointerCapture(event.pointerId)) this.abort(event)
  }
  private screen(event: Pick<PointerEvent, 'clientX' | 'clientY'>): Point {
    const rect = this.canvas.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * this.viewWidth / rect.width, y: (event.clientY - rect.top) * this.viewHeight / rect.height }
  }
  private touchDown(event: PointerEvent) {
    if (event.pointerType !== 'touch' || this.options.disabled || this.mode !== 'infinite') return false
    this.touches.set(event.pointerId, this.screen(event))
    if (this.touches.size < 2 && !this.pinching) return false
    this.cancel()
    this.pinching = true
    const [a, b] = [...this.touches.values()]
    if (a && b) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      this.pinch = { distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), zoom: this.zoom, world: { x: (mid.x - this.viewport.x) / this.zoom, y: (mid.y - this.viewport.y) / this.zoom } }
    }
    for (const id of this.touches.keys()) { try { this.canvas.setPointerCapture(id) } catch {} }
    event.preventDefault()
    return true
  }
  private touchMove(event: PointerEvent) {
    if (!this.touches.has(event.pointerId)) return false
    this.touches.set(event.pointerId, this.screen(event))
    if (!this.pinching) return false
    event.preventDefault()
    const [a, b] = [...this.touches.values()]
    if (!a || !b || !this.pinch) return true
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.pinch.zoom * Math.hypot(b.x - a.x, b.y - a.y) / this.pinch.distance))
    this.viewport = camera({ x: (a.x + b.x) / 2 - this.pinch.world.x * this.zoom, y: (a.y + b.y) / 2 - this.pinch.world.y * this.zoom })
    this.schedule(); this.updateToolbar()
    return true
  }
  private touchEnd(event: PointerEvent) {
    this.touches.delete(event.pointerId)
    if (!this.pinching) return false
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    this.pinch = undefined
    if (!this.touches.size) {
      this.pinching = false
      this.options.onChange?.(this.getData())
    }
    return true
  }
  private wheel = (event: WheelEvent) => {
    if (this.mode !== 'infinite' || this.options.disabled) return
    event.preventDefault()
    if (this.gesture || this.pinching) return
    const factor = Math.exp(-Math.max(-500, Math.min(500, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewHeight : 1))) * .002)
    this.setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor)), this.screen(event))
  }
  private bind() {
    this.canvas.addEventListener('pointerdown', this.down)
    this.canvas.addEventListener('pointermove', this.move)
    this.canvas.addEventListener('pointerup', this.up)
    this.canvas.addEventListener('pointercancel', this.abort)
    this.canvas.addEventListener('wheel', this.wheel, { passive: false })
    this.canvas.addEventListener('lostpointercapture', this.lostCapture)
    this.win.addEventListener('blur', this.blur)

  }

  /** Include offscreen and negative-coordinate objects when exporting an infinite world. */
  private exportArea(): Bounds {
    if (this.mode !== 'infinite' || !this.shapes.length) {
      return { x: 0, y: 0, width: this.width, height: this.height }
    }
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const shape of this.shapes) {
      const box = shapeBounds(shape)
      left = Math.min(left, box.x)
      top = Math.min(top, box.y)
      right = Math.max(right, box.x + box.width)
      bottom = Math.max(bottom, box.y + box.height)
    }
    const x = Math.floor(left) - 16, y = Math.floor(top) - 16
    return { x, y, width: Math.ceil(right) + 16 - x, height: Math.ceil(bottom) + 16 - y }
  }
  /** Export only committed annotations, with transparent background by default. */
  async exportImage(options: ExportImageOptions = {}): Promise<string> {
    this.assertAlive()
    let scale = options.scale ?? 1
    const area = this.exportArea()
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Invalid export scale')
    const padding = options.fit ? 16 : 0
    if (options.fit) scale = Math.min(scale, 4064 / area.width, 4064 / area.height, Math.sqrt(16_000_000 / (area.width * area.height)))
    if (!Number.isFinite(scale) || scale <= 0 || area.width * area.height * scale * scale > 64_000_000 ||
        area.width * scale > 32768 || area.height * scale > 32768) {
      throw new RangeError('Export scale or image dimensions exceed the supported budget')
    }
    const canvas = this.container.ownerDocument.createElement('canvas')
    canvas.width = Math.max(1, Math.round(area.width * scale) + padding * 2)
    canvas.height = Math.max(1, Math.round(area.height * scale) + padding * 2)
    const ctx = canvas.getContext('2d')!
    ctx.translate(padding, padding)
    ctx.scale(scale, scale)
    if (options.includeBackground) {
      ctx.save()
      ctx.translate(-area.x, -area.y)
      paintBackground(ctx, { x: area.x - padding / scale, y: area.y - padding / scale, width: area.width + padding * 2 / scale, height: area.height + padding * 2 / scale }, { ...this.getBackground(), ...(options.background ? { color: options.background } : {}) }, scale, !!options.fit)
      ctx.restore()
    }
    else if (options.background) {
      ctx.fillStyle = options.background
      ctx.fillRect(-padding / scale, -padding / scale, area.width + padding * 2 / scale, area.height + padding * 2 / scale)
    }
    ctx.translate(-area.x, -area.y)
    for (const shape of this.shapes) drawShape(ctx, shape, this.options.shapes?.find(item => item.id === shape.tool), options.fit && this.mode === 'infinite' ? Math.min(1, scale) : 0)
    return canvas.toDataURL('image/png')
  }
  async exportBlob(options?: ExportImageOptions): Promise<Blob> {
    const url = await this.exportImage(options)
    const binary = atob(url.split(',')[1])
    return new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: 'image/png' })
  }

  /** Idempotently remove only the drawing's DOM, observers and listeners. */
  destroy() {
    if (this.destroyed) return
    this.blur()
    this.destroyed = true
    this.win.cancelAnimationFrame(this.frame)
    this.stopEdgePan()
    this.observer.disconnect()
    this.canvas.removeEventListener('pointerdown', this.down)
    this.canvas.removeEventListener('pointermove', this.move)
    this.canvas.removeEventListener('pointerup', this.up)
    this.canvas.removeEventListener('pointercancel', this.abort)
    this.canvas.removeEventListener('wheel', this.wheel)
    this.canvas.removeEventListener('lostpointercapture', this.lostCapture)
    this.win.removeEventListener('blur', this.blur)
    this.toolbarLayer.remove()
    this.toolbar.destroy()
    this.layer.remove()
    this.container.style.position = this.savedPosition
    this.container.style.overflow = this.savedOverflow
    if (this.backgroundApplied) this.restoreBackground()
    instances.delete(this.container)
  }
  private assertAlive() {
    if (this.destroyed) throw new Error('Drawboard has been destroyed')
  }
}
