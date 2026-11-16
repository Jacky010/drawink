import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createApp, h, nextTick } from 'vue'
import { Drawboard as ReactBoard } from '@drawink/react'
import { Drawboard as VueBoard } from '@drawink/vue'
import type { Drawboard, DrawingData } from '@drawink/core'
/** Isolated real adapter fixture; no mocking of the core or framework lifecycle. */
export async function compareInitialOptions() {
  const data: DrawingData = { version: 1, width: 400, height: 300, shapes: [], background: { color: '#0000ff' } }
  const options = { mode: 'infinite' as const, background: { color: '#ff0000' } }
  const reactHost = document.createElement('div'), vueHost = document.createElement('div')
  document.body.append(reactHost, vueHost)
  let react: Drawboard | undefined, vue: Drawboard | undefined
  const root = createRoot(reactHost)
  root.render(createElement(ReactBoard, { data, options, onReady: value => { react = value } }))
  const app = createApp({ render: () => h(VueBoard, { data, options, onReady: (value: Drawboard) => { vue = value } }) })
  app.mount(vueHost)
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 100))
  const result = {
    react: { mode: react!.mode, color: react!.getBackground().color },
    vue: { mode: vue!.mode, color: vue!.getBackground().color },
  }
  root.unmount(); app.unmount()
  reactHost.remove(); vueHost.remove()
  return result
}

/** Controlled React with inline options must retain user navigation on data echoes. */
export async function controlledZoom() {
  const { useState, StrictMode } = await import('react')
  const host = document.createElement('div'); host.style.cssText = 'width:400px;height:300px'
  document.body.append(host)
  let board: Drawboard | undefined, changes = 0
  let changeOption: (zoom: number) => void = () => {}
  function App() {
    const [data, setData] = useState<DrawingData>()
    const [zoom, setZoom] = useState(1)
    changeOption = setZoom
    return createElement(ReactBoard, {
      data, options: { mode: 'infinite', zoom },
      onChange: value => { changes++; setData(value) },
      onReady: value => { board = value },
    })
  }
  const root = createRoot(host)
  root.render(createElement(StrictMode, null, createElement(App)))
  await new Promise(resolve => setTimeout(resolve, 100))
  board!.setZoom(2)
  await new Promise(resolve => setTimeout(resolve, 100))
  const userZoom = board!.getViewport().zoom, userChanges = changes
  changeOption(3)
  await new Promise(resolve => setTimeout(resolve, 100))
  const optionZoom = board!.getViewport().zoom
  root.unmount(); host.remove()
  return { userZoom, userChanges, optionZoom }
}
