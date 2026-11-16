import type { Drawboard } from './board'
import type { BackgroundSettings, BrushSettings, Viewport, Point, BoardMode, CustomShapeDefinition, DrawboardOptions, DrawingData, ExportImageOptions, Tool } from './types'
/** Shared imperative API exposed by the Vue and React adapters. */
export interface DrawboardHandle {
  getData(): DrawingData
  loadData(data: DrawingData | string): void
  setTool(tool: Tool): void
  setMode(mode: BoardMode): void
  registerShape(shape: CustomShapeDefinition): void
  setOptions(options: DrawboardOptions): void
  getBackground(): Required<BackgroundSettings>
  setBackground(background: BackgroundSettings): void
  undo(): boolean
  redo(): boolean
  clear(): void
  refresh(): void
  resetView(): void
  getBrush(): BrushSettings
  setBrush(settings: Partial<BrushSettings>): void
  getViewport(): Viewport
  setZoom(zoom: number, anchor?: Point): void
  fitView(padding?: number): void
  exportImage(options?: ExportImageOptions): Promise<string>
  exportBlob(options?: ExportImageOptions): Promise<Blob>
}
export function createHandle(getBoard: () => Drawboard | null): DrawboardHandle {
  const board = () => {
    const instance = getBoard()
    if (!instance) throw new Error('Drawboard is not mounted')
    return instance
  }
  return {
    getData: () => board().getData(),
    loadData: data => board().loadData(data),
    setTool: tool => board().setTool(tool),
    setMode: mode => board().setMode(mode),
    registerShape: shape => board().registerShape(shape),
    setOptions: options => board().setOptions(options),
    getBackground: () => board().getBackground(),
    setBackground: background => board().setBackground(background),
    undo: () => board().undo(),
    redo: () => board().redo(),
    clear: () => board().clear(),
    refresh: () => board().refresh(),
    resetView: () => board().resetView(),
    getBrush: () => board().getBrush(),
    setBrush: settings => board().setBrush(settings),
    getViewport: () => board().getViewport(),
    setZoom: (zoom, anchor) => board().setZoom(zoom, anchor),
    fitView: padding => board().fitView(padding),
    exportImage: options => board().exportImage(options),
    exportBlob: options => board().exportBlob(options),
  }
}
