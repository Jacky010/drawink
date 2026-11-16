/** Drawing tools. Eraser removes whole intersecting objects; pan scrolls the container. */
export const shapeTools = [
  'pen', 'line', 'rect', 'circle', 'ellipse', 'triangle', 'diamond',
  'trapezoid', 'parallelogram', 'cuboid', 'cylinder', 'cone',
] as const
export type BuiltinShapeTool = typeof shapeTools[number]
export type ShapeTool = BuiltinShapeTool | (string & {})
export type Tool = ShapeTool | 'eraser' | 'select' | 'pan'
export type BoardMode = 'document' | 'infinite'
export interface Point { x: number; y: number }
export interface Viewport extends Point { zoom: number }
export interface BrushSettings { color: string; lineWidth: number; opacity: number }
export interface Bounds extends Point { width: number; height: number }
/** Coordinates are logical document pixels, independent of devicePixelRatio. */
export interface Shape {
  tool: ShapeTool
  points: Point[]
  color: string
  width: number
  /** Defaults to 1 for older documents. */
  opacity?: number
}
/** Versioned portable format, deliberately independent of Fabric JSON. */
export interface DrawingData {
  version: 1
  /** Absent means the original finite document format. */
  mode?: BoardMode
  viewport?: Point & { zoom?: number }
  background?: BackgroundSettings
  width: number
  height: number
  shapes: Shape[]
}
export interface BackgroundSettings {
  color?: string
  pattern?: 'none' | 'dots' | 'grid'
  patternColor?: string
  spacing?: number
}
export type ToolbarPlacement = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
/** Custom x/y are CSS pixels from the visible container's top-left corner. */
export type ToolbarPosition = ToolbarPlacement | Point
export interface DrawboardOptions {
  toolbarPosition?: ToolbarPosition
  /** Overrides for built-in controls, shape ids and custom toolbar item ids. */
  toolbarIcons?: Record<string, ToolbarIcon>
  background?: BackgroundSettings
  /** Continue drawing/moving at viewport edges in infinite mode. Default true. */
  autoPan?: boolean
  /** Additional tools; custom shapes serialize by their registered id. */
  shapes?: CustomShapeDefinition[]
  toolbarItems?: ToolbarItem[]
  /** Optional mode-switch owner, e.g. to keep independent documents per mode. */
  onModeChange?: (mode: BoardMode) => void
  /** Document overlay (default) or an unbounded world with a fixed-size viewport. */
  mode?: BoardMode
  width?: number
  height?: number
  /** Document height in CSS pixels; enables a scrollable annotation surface. */
  contentHeight?: number
  tool?: Tool
  color?: string
  lineWidth?: number
  opacity?: number
  /** Initial infinite view scale; runtime changes anchor at viewport center. */
  zoom?: number
  disabled?: boolean
  readOnly?: boolean
  toolbar?: boolean
  historyLimit?: number
  /** Reject finger drawing while allowing mouse and pen. */
  penOnly?: boolean
  data?: DrawingData
  onChange?: (data: DrawingData) => void
}
export interface ExportImageOptions {
  scale?: number
  background?: string
  includeBackground?: boolean
  /** Automatically fit all annotations within 4096px, with screen-readable strokes. */
  fit?: boolean
}

/** A custom shape must draw within the rectangle defined by its two points. */
export interface CustomShapeDefinition {
  id: string
  label: string
  icon?: ToolbarIcon
  draw: (context: CanvasRenderingContext2D, shape: Shape) => void
}
/** Icons share one API across controls, custom shapes and toolbar actions. */
export type ToolbarIcon =
  | string
  | ((doc: Document) => Node)
  | { type: 'image'; src: string }
  | { type: 'svg'; content: string }
  | { type: 'font'; className: string; text?: string }
/** Inline SVG is sanitized; text is never interpreted as HTML. */
export interface ToolbarItem {
  id: string
  label: string
  icon?: ToolbarIcon
  onClick: (api: import('./handle').DrawboardHandle) => void
  disabled?: boolean | ((api: import('./handle').DrawboardHandle) => boolean)
}
