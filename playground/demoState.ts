import type { BoardMode, DrawboardOptions, DrawingData } from '@drawink/core'
import { exampleShapes, exampleToolbarItems } from './extensions'
export let demoMode: BoardMode = new URLSearchParams(location.search).get('mode') === 'infinite' ? 'infinite' : 'document'
let framework = new URLSearchParams(location.search).get('framework') || 'js'
const storageKey = (mode: BoardMode) => 'drawink-demo:' + framework + ':' + mode
/** Each mode keeps its own session snapshot; switching modes never shares coordinates. */
export function emptyDemoData(): DrawingData {
  return {
    version: 1, width: 800, height: demoMode === 'infinite' ? 600 : 1200, shapes: [],
    ...(demoMode === 'infinite' ? { mode: demoMode, viewport: { x: 0, y: 0 } } : {}),
  }
}
export function readDemoData(): DrawingData {
  try {
    const raw = sessionStorage.getItem(storageKey(demoMode))
    const data = raw ? JSON.parse(raw) : emptyDemoData()
    return {
      ...data,
      ...(demoMode === 'infinite' ? { mode: 'infinite', viewport: data.viewport || { x: 0, y: 0 } } : { mode: undefined, viewport: undefined }),
    }
  }
  catch { return emptyDemoData() }
}
export function saveDemoData(data: DrawingData, mode: BoardMode = demoMode) {
  try { sessionStorage.setItem(storageKey(mode), JSON.stringify(data)) } catch { /* Drawing remains usable when browser storage is unavailable/full. */ }
}
export const demoOptions: DrawboardOptions = {
  shapes: exampleShapes, toolbarItems: exampleToolbarItems,
  background: readDemoData().background ?? { color: '#fffdf6', pattern: 'dots', patternColor: '#cdd8ce', spacing: 20 },
  onModeChange(mode) {
    document.body.classList.toggle('infinite-mode', mode === 'infinite')
    changeMode(mode)
  },
  mode: demoMode, width: 800, height: demoMode === 'infinite' ? 600 : 1200,
  ...(demoMode === 'document' ? { contentHeight: 1200 } : {}),
}

let changeMode: (mode: BoardMode) => void = () => {}
export function setModeHandler(handler: (mode: BoardMode) => void) { changeMode = handler }
export function setDemoContext(nextFramework: string, mode: BoardMode) {
  framework = nextFramework
  demoMode = mode
  demoOptions.mode = mode
  delete demoOptions.contentHeight
  if (mode === 'document') demoOptions.contentHeight = 1200
  demoOptions.height = mode === 'infinite' ? 600 : 1200
  demoOptions.background = readDemoData().background ?? { color: '#fffdf6', pattern: 'dots', patternColor: '#cdd8ce', spacing: 20 }
}
