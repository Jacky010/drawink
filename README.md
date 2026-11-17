# drawink

**Draw the idea. Keep the lesson.**

drawink is a Canvas 2D drawing and annotation library for teaching, geometry demonstrations, page markup and handwritten explanations. It provides a framework-independent JavaScript core with zero runtime dependencies, plus Vue 3 and React adapters.

**Website & live demo: <https://jacky010.github.io/drawink/>**

[简体中文完整文档](./README.zh-CN.md) · [MIT License](./LICENSE)

### Feature walkthrough

<video src="./media/drawink-intro.mp4" controls width="100%" playsinline>
  Play inline on GitHub or locally. If the player is unavailable, open
  <a href="./media/drawink-intro.mp4">drawink-intro.mp4</a>.
</video>

## Contents

- [Features](#features)
- [Packages and requirements](#packages-and-requirements)
- [Run the local playground](#run-the-local-playground)
- [JavaScript](#javascript)
- [Vue 3](#vue-3)
- [React](#react)
- [Document and infinite modes](#document-and-infinite-modes)
- [Tools and brush settings](#tools-and-brush-settings)
- [Toolbar placement](#toolbar-placement)
- [Backgrounds](#backgrounds)
- [Save and restore](#save-and-restore)
- [PNG export](#png-export)
- [Options reference](#options-reference)
- [Methods reference](#methods-reference)
- [Custom icons](#custom-icons)
- [Toolbar actions and custom shapes](#toolbar-actions-and-custom-shapes)
- [Input and lifecycle](#input-and-lifecycle)
- [Troubleshooting and limitations](#troubleshooting-and-limitations)
- [Repository and development checks](#repository-and-development-checks)
- [License](#license)

## Features

| Capability | Behavior |
| --- | --- |
| Page annotations | Keep existing host DOM and draw on a separate transparent layer |
| Teaching geometry | Plane shapes and cuboid/cylinder/cone tools with dashed construction edges |
| Freehand drawing | Brush color, width and opacity |
| Object editing | Bounding-box selection/movement, object erasing, clear, undo and redo |
| Two modes | Finite document annotation or an infinite world with pan and zoom |
| Portable documents | Versioned JSON independent of frameworks and backend services |
| Image output | PNG Data URL or Blob, with optional board background |
| Extensibility | Custom icons, toolbar placement, toolbar actions and shape definitions |
| Pointer input | Mouse, touch and pen; two-finger navigation in infinite mode |

The library does not include accounts, uploads, classroom synchronization or a collaboration backend. Your application owns persistence and any business services.

## Packages and requirements

| Package | Purpose | Peer requirements |
| --- | --- | --- |
| `@drawink/core` | JavaScript/TypeScript Canvas core | No framework |
| `@drawink/vue` | Vue component with `v-model:data` | Vue 3.3+ |
| `@drawink/react` | React component with controlled data and imperative ref | React / React DOM 18+ |

Adapters depend on the core and re-export commonly used public types. All three entry points share the same document format, tool names and core options. Toolbar styles are injected automatically; no additional CSS import is required.

The browser must support Canvas 2D, Pointer Events and ResizeObserver. Give the host a visible, definite height.

Dependency installation examples below require the packages to be available through your configured registry or local dependency setup. This repository already connects its packages through pnpm workspace, so its playground does not require these additional installs.

```bash
# JavaScript / TypeScript
npm install @drawink/core

# Choose the adapter for your application:
npm install @drawink/vue
npm install @drawink/react
```

## Run the local playground

Repository development uses pnpm 10 and Node.js `^20.19.0 || >=22.12.0`.

```bash
cd drawink
pnpm install
pnpm dev
```

Open the address printed by Vite. To use a fixed port:

```bash
pnpm dev --port 5188 --strictPort
```

An example URL is `http://127.0.0.1:5188/?framework=react&mode=infinite`. `framework` accepts `js`, `vue` or `react`; `mode` accepts `document` or `infinite`.

Framework and mode switches update the playground in place without reloading the page. Browser back/forward navigation is supported. Each framework/mode combination has separate session data. Switching remounts the board, so undo history is local to the current instance. These storage choices belong to the playground, not a mandatory library storage contract.

## JavaScript

```html
<div id="lesson" style="position:relative;width:100%;height:560px">
  <h2>Cylinder volume</h2>
  <p>V = πr²h</p>
</div>
```

```ts
import { Drawboard } from '@drawink/core'

const board = new Drawboard(document.querySelector<HTMLElement>('#lesson')!, {
  mode: 'document',
  color: '#176b52',
  lineWidth: 3,
  opacity: 1,
  toolbarPosition: 'top-center',
  onChange(data) {
    console.log(data) // Send to your own state or persistence layer.
  },
})

board.setTool('cylinder')
board.setBrush({ color: '#d9485f', lineWidth: 5, opacity: 0.7 })
const saved = board.getData()
board.loadData(saved)

// When the host leaves the page:
board.destroy()
```

Only one live instance may own a host. Destruction removes the instance's DOM, observers and event listeners, restores managed host styles, and preserves original content. Repeated `destroy()` calls are safe.

## Vue 3

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  Drawboard,
  type DrawboardHandle,
  type DrawboardOptions,
  type DrawingData,
} from '@drawink/vue'

const board = ref<DrawboardHandle>()
const data = ref<DrawingData>()
const options: DrawboardOptions = {
  mode: 'infinite',
  toolbarPosition: 'bottom-center',
}
</script>

<template>
  <Drawboard ref="board" v-model:data="data" :options="options"
    style="width:100%;height:560px" />
  <button @click="board?.undo()">Undo</button>
</template>
```

| Entry point | Meaning |
| --- | --- |
| `data` / `v-model:data` | Drawing document |
| `options` | Core options; the component owns data/change bindings |
| `update:data` | Two-way document binding |
| `change(data)` | Drawing, appearance or view changes |
| `ready(instance)` | Receives the actual core instance after mounting |
| Default slot | Underlying document content |
| Component ref | Shared `DrawboardHandle` methods |

Unmounting destroys the core automatically. Use a blank host for infinite mode unless your application separately manages the underlying DOM position.

## React

```tsx
import { useRef, useState } from 'react'
import {
  Drawboard,
  type DrawboardHandle,
  type DrawboardOptions,
  type DrawingData,
} from '@drawink/react'

const options: DrawboardOptions = {
  mode: 'infinite',
  toolbarPosition: 'top-right',
}

export function LessonBoard() {
  const board = useRef<DrawboardHandle>(null)
  const [data, setData] = useState<DrawingData>()
  return <>
    <Drawboard ref={board} data={data} onChange={setData} options={options}
      style={{ width: '100%', height: 560 }} />
    <button onClick={() => board.current?.undo()}>Undo</button>
  </>
}
```

Use `data` with `onChange` for controlled drawing, or omit `data` for internal document ownership. `onReady(instance)`, `children`, common div attributes and `style` are supported. Keep stable options outside the component or use `useMemo` to avoid unnecessary option updates.

The adapter supports StrictMode cleanup. Both framework modules can be imported in SSR environments: server rendering creates only the host/content, and the actual canvas is initialized after client mounting. Framework unmounting owns destruction.

## Document and infinite modes

| Behavior | `document` | `infinite` |
| --- | --- | --- |
| Default | Yes | No |
| Coordinates | Finite logical document | World coordinates, including negatives |
| Navigation | Native wheel scrolling and drag-to-scroll with `pan` | Pan, pointer-anchored wheel zoom and two-finger navigation |
| Long content | `contentHeight` | Fixed-size viewport bitmap |
| Existing DOM | Annotate directly over the content | DOM does not automatically follow the camera |
| Saved view | Container scroll is not serialized | `viewport.x/y/zoom` |

```ts
const documentBoard = new Drawboard(host, {
  mode: 'document', width: 800, height: 1200, contentHeight: 1200,
})
documentBoard.setTool('pan')
```

For an infinite instance:

```ts
board.setZoom(2) // Center-anchored 200% view.
board.setZoom(1.5, { x: 120, y: 160 }) // Viewport CSS-pixel anchor.
board.fitView(32)
board.getViewport() // { x, y, zoom }
board.resetView() // Origin and 100%, without removing objects.
```

Zoom ranges from `0.00001` to `8` (`0.001%–800%`). Camera changes do not rewrite shape endpoints or enter stroke undo history. Infinite-view stroke widths use screen CSS pixels with a 1.5px minimum, preventing subpixel fading. Stored `Shape.width` is unchanged.

`autoPan: true` advances the world while drawing, moving or erasing at viewport edges. Set it to `false` to disable that behavior.

`setMode()` changes the core mode and then calls `onModeChange`. An application callback may remount the board; use the new instance afterward. Without an owning callback, the same document is retained while changing modes. Separate documents per mode are an application choice.

## Tools and brush settings

| Tool | Meaning |
| --- | --- |
| `pen` | Freehand point sequence |
| `line` | Straight line |
| `rect` | Rectangle |
| `circle` | Circle using the longer drag axis as diameter |
| `ellipse` | Ellipse |
| `triangle` | Triangle |
| `diamond` | Diamond |
| `trapezoid` | Trapezoid |
| `parallelogram` | Parallelogram |
| `cuboid` | Cuboid |
| `cylinder` | Cylinder |
| `cone` | Cone |
| `select` | Move the topmost matching bounding-box object |
| `eraser` | Remove objects intersecting a dragged rectangle |
| `pan` | Scroll the document or pan the infinite camera |

The eraser removes whole objects, not pixels. Selection does not currently provide resize handles, rotation or grouping.

```ts
board.setTool('pen')
board.setBrush({ color: '#176b52', lineWidth: 8, opacity: 0.5 })
board.getBrush() // { color, lineWidth, opacity }
```

Click the already-active pen again to open its settings. Changes affect future strokes and shapes, not existing objects. Legacy shapes without `opacity` render at 1.

## Toolbar placement

```ts
const board = new Drawboard(host, { toolbarPosition: 'bottom-right' })
board.setOptions({ toolbarPosition: { x: 24, y: 72 } })
```

Presets: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`. The default is `top-center`. Custom x/y are CSS pixels from the visible host's top-left corner and are clamped inside it.

A native non-scrolling toolbar layer keeps the toolbar stationary during document scrolling, without asynchronous scroll compensation. Bottom menus open upward; container resizing updates placement. Position is UI configuration and is not included in drawing JSON.

Popovers close on outside clicks or Escape. Use `toolbar: false` to build a completely custom interface with the public API. Playground framework navigation and its position selector are demo UI, not extra page elements injected by the library.

## Backgrounds

```ts
board.setBackground({
  color: '#fffdf6', pattern: 'grid', patternColor: '#cdd8ce', spacing: 24,
})
board.getBackground()
```

| Field | Document default | Infinite default | Accepted values |
| --- | --- | --- | --- |
| `color` | `transparent` | `#fffdf6` | `transparent` or 3/4/6/8-digit hexadecimal colors |
| `pattern` | `none` | `dots` | `none`, `dots`, `grid` |
| `patternColor` | `#cdd8ce` | `#cdd8ce` | Same color format restriction |
| `spacing` | `20` | `20` | `4–200` |

Background CSS remains behind host content. Document mode without explicit background options preserves the host's original appearance. Background setters merge fields; `getBackground()` fills in defaults.

Infinite-view patterns use coarser world-grid levels when zoomed out, keeping dots/grid visible. Serialized spacing remains unchanged. Saving a background in JSON does not automatically include it in PNG output.

## Save and restore

```ts
const saved = board.getData()
const json = JSON.stringify(saved)
board.loadData(json)
```

```ts
interface DrawingData {
  version: 1
  mode?: 'document' | 'infinite'
  viewport?: { x: number; y: number; zoom?: number }
  background?: {
    color?: string
    pattern?: 'none' | 'dots' | 'grid'
    patternColor?: string
    spacing?: number
  }
  width: number
  height: number
  shapes: {
    tool: string
    points: { x: number; y: number }[]
    color: string
    width: number
    opacity?: number
  }[]
}
```

- Missing `mode` means document mode; missing viewport zoom means 1.
- Ordinary shapes contain two endpoints; `pen` stores a point sequence.
- `getData()` returns detached shape/point data; a new in-progress stroke is excluded.
- `loadData()` validates before replacing the document. Invalid input leaves the current document intact; successful loading resets history.
- Loading does not emit change, avoiding controlled-data loops. Brush-only changes do not create drawing data immediately.
- JSON stores no callbacks, DOM factories, custom draw functions or undo snapshots, and is not Fabric JSON.
- Explicit initial `options.mode/background/zoom` override corresponding initial data values. Later loading or controlled data updates restore the new document.

Your application owns storage and underlying document layout reconstruction.

## PNG export

The toolbar PNG button opens an export panel. **Include background is unchecked on every open.** Save downloads `drawink.png` containing all annotations, including offscreen and negative-coordinate objects. Automatic sizing keeps each image side within 4096px with readable strokes and padding.

```ts
const transparent = await board.exportImage({ fit: true })
const withBackground = await board.exportImage({ fit: true, includeBackground: true })
const blob = await board.exportBlob({ fit: true })
const originalScale = await board.exportImage({ scale: 1 })
```

| Option | Default | Meaning |
| --- | --- | --- |
| `fit` | `false` | Bound output size; infinite-mode strokes remain readable, with extra padding |
| `scale` | `1` | Logical export multiplier; fitting may reduce it further |
| `includeBackground` | `false` | Include current background color and pattern |
| `background` | Unset | Explicit output color; when including patterns, overrides their base color |

`exportImage()` resolves to a PNG Data URL; `exportBlob()` resolves to a PNG Blob. Output excludes underlying DOM, toolbar and new uncommitted stroke drafts.

Without `fit`, document export uses logical document dimensions and infinite export uses all shape bounds plus 16 logical pixels of padding. This path uses stored logical stroke widths, independent of camera zoom, and rejects output beyond approximately 64 million pixels or 32768px per side.

Fitting never rewrites JSON. Included backgrounds use readable texture levels; strict non-fit exports may omit patterns with less than 4 output pixels per cell. A transparent configured background stays transparent even when inclusion is selected.

```ts
const blob = await board.exportBlob({ fit: true })
const url = URL.createObjectURL(blob)
const link = document.createElement('a')
link.href = url
link.download = 'lesson.png'
link.click()
setTimeout(() => URL.revokeObjectURL(url), 1000)
```

## Options reference

`DrawboardOptions` is shared by core and adapters. Framework components use top-level document/change bindings instead of `options.data/onChange`.

| Option | Default | Meaning |
| --- | --- | --- |
| `mode` | `document` | `document` or `infinite` |
| `width`, `height` | Initial host size; 800/600 fallback | Initial logical dimensions; initial document dimensions take precedence |
| `contentHeight` | Unset | Document CSS content height for scrolling |
| `tool` | `pen` | Built-in tool or registered shape id |
| `color` | `#176b52` | Valid CSS color for future objects |
| `lineWidth` | `3` | Positive, at most 32768; logical width, displayed as screen width in infinite mode |
| `opacity` | `1` | Future object opacity, 0–1 |
| `zoom` | `1` | Initial infinite scale, 0.00001–8 |
| `toolbar` | `true` | Show default toolbar |
| `toolbarPosition` | `top-center` | Preset or `{ x, y }` |
| `toolbarIcons` | Unset | Icon overrides by control/shape/action id |
| `toolbarItems` | Empty | Custom actions |
| `shapes` | Empty | Custom shape definitions |
| `background` | Mode defaults | Appearance configuration |
| `autoPan` | `true` | Infinite edge navigation during drawing/moving/erasing |
| `disabled` | `false` | Canvas ignores pointers so underlying DOM can be used |
| `readOnly` | `false` | Prevent editing/history operations; retain navigation |
| `penOnly` | `false` | Reject finger drawing, retain mouse/pen and two-finger infinite navigation |
| `historyLimit` | `100` | Maximum history states, integer >= 2; construction-only |
| `data` | Empty | Core initial document; adapters use their top-level data prop |
| `onChange` | Unset | Core change callback; adapters use events/top-level callback |
| `onModeChange` | Unset | Notify the application after a mode change |

Runtime options are merged. Backgrounds merge by field; icon maps and action/shape arrays are replaced. Logical dimensions and history limit are construction settings. Use `loadData()` to change an existing document's dimensions and synchronize DOM/content height as appropriate.

## Methods reference

Core and framework refs share these `DrawboardHandle` methods:

| Method | Result | Behavior |
| --- | --- | --- |
| `getData()` | `DrawingData` | Current shape snapshot, excluding a new stroke draft |
| `loadData(dataOrJson)` | `void` | Validate, restore and reset history |
| `setTool(tool)` | `void` | Select a tool |
| `setMode(mode)` | `void` | Change mode and invoke its callback |
| `setOptions(options)` | `void` | Merge runtime configuration |
| `getBrush()` | `BrushSettings` | Current color, width, opacity |
| `setBrush(partial)` | `void` | Update future object styling |
| `getBackground()` | Complete settings | Resolve background defaults |
| `setBackground(partial)` | `void` | Merge appearance and notify changes |
| `getViewport()` | `{ x, y, zoom }` | Infinite view state |
| `setZoom(zoom, anchor?)` | `void` | Infinite zoom; center anchor by default |
| `fitView(padding = 32)` | `void` | Frame all objects; reset an empty view |
| `resetView()` | `void` | Reset camera/zoom or document scroll |
| `registerShape(definition)` | `void` | Add an instance-local shape tool |
| `undo()`, `redo()` | `boolean` | Whether a history state was restored |
| `clear()` | `void` | Undoable clear; blocked while read-only/disabled |
| `refresh()` | `void` | Refresh viewport size; ResizeObserver normally does this |
| `exportImage(options?)` | `Promise<string>` | PNG Data URL |
| `exportBlob(options?)` | `Promise<Blob>` | PNG Blob |

Core instances additionally expose `canUndo`, `canRedo`, `tool`, `mode` and `destroy()`. History availability is separate from editing permission. Framework handles rely on framework lifecycle for destruction and must be used after mounting.

`fitView()` changes the on-screen camera; `exportImage({ fit: true })` fits output dimensions. They serve different purposes.

## Custom icons

Controls, custom actions and custom shapes share `ToolbarIcon`. Override precedence is `toolbarIcons[id]`, the definition's own `icon`, then the built-in icon.

```ts
board.setOptions({
  toolbarIcons: {
    pen: { type: 'image', src: '/icons/pen.png' },
    eraser: {
      type: 'svg',
      content: '<svg viewBox="0 0 24 24"><path d="M4 14 14 4l6 6-10 10H8Z" fill="none" stroke="currentColor"/></svg>',
    },
    pan: { type: 'font', className: 'iconfont icon-hand' },
    'export-png': { type: 'font', className: 'iconfont', text: '\ue600' },
    reset: '↺',
  },
})
```

A `(doc) => Node` factory is also supported; returned nodes are cloned for instance isolation. Use the supplied Document to construct them.

Keys include `pen`, `pan`, `select`, `eraser`, `shapes`, `clear`, `undo`, `redo`, `background`, `reset`, `export-png`, `zoom-in`, `zoom-out`, `zoom-reset`, `fit-view`, shape ids and extension ids. The native mode select is not an icon key.

Strings render as text, not HTML. Inline SVG uses the `svg` descriptor and allow-list filtering of scripts, events and external references. Images accept relative paths, HTTP(S), Blob and permitted image data URLs. Applications load fonticon CSS/fonts themselves. DOM factories execute trusted application code.

## Toolbar actions and custom shapes

```ts
import type { ToolbarItem, CustomShapeDefinition } from '@drawink/core'

const actions: ToolbarItem[] = [{
  id: 'save-document',
  label: 'Save document',
  icon: '↗',
  disabled: api => api.getData().shapes.length === 0,
  onClick(api) { console.log(api.getData()) },
}]

const badge: CustomShapeDefinition = {
  id: 'badge', label: 'Badge', icon: '▧',
  draw(ctx, shape) {
    const [a, b] = shape.points
    ctx.beginPath()
    ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y),
      Math.abs(b.x - a.x), Math.abs(b.y - a.y))
    ctx.stroke()
  },
}

board.setOptions({ toolbarItems: actions })
board.registerShape(badge)
board.setTool('badge')
```

Actions receive the shared handle. Their `disabled` value/function owns the extension's availability policy; synchronize application read-only rules when needed. Your application handles any business operations in callbacks.

Shapes can also be passed through `shapes` at construction. IDs must match `^[a-z][a-z0-9-]*$`, be unique and not use reserved tool names. Drawing receives world coordinates and preconfigured color, alpha and rendered line width. Normally retain the supplied `ctx.lineWidth` so infinite-view scaling remains consistent. Geometry must stay inside the rectangle defined by the two endpoints for accurate bounds, movement, erasing and export.

Definitions are instance-local. JSON stores their IDs, not functions; register matching definitions before loading. A definition referenced by current shapes or undo/redo history cannot be removed. Load a document without that type to reset history before replacing definitions. Removing an unused active custom tool falls back to the pen.

## Input and lifecycle

- Pointer cancellation, lost capture and blur stop incomplete ordinary gestures. Cancelling a drawing/move restores its prior shapes and camera.
- Two-finger infinite navigation cancels a pending finger stroke; single-finger drawing resumes after all fingers lift.
- `penOnly` uses pointer device types; it is not hardware palm rejection.
- `readOnly` blocks object editing, clear and history changes but permits view navigation and export.
- `disabled` makes the canvas pass pointer interaction to underlying DOM. Custom toolbar actions still use application-defined disabling rules.
- Host resizing refreshes automatically; text reflow and image loading do not automatically re-anchor annotations.
- Do not manually create another core on a framework adapter's host. Do not reuse a destroyed instance.

## Troubleshooting and limitations

| Symptom or question | Explanation |
| --- | --- |
| No visible canvas | Ensure the host is mounted, has visible dimensions and is not hidden by an ancestor |
| Long document will not scroll | Set a document `contentHeight` larger than its viewport and align logical height with the underlying fixed layout |
| DOM does not follow infinite pan | The camera transforms annotations only; manage DOM separately or use document mode |
| Brush changes do not restyle old ink | Existing shapes retain their own styles |
| Cannot undo into a previous loaded document | Loading resets history; history is not serialized |
| Huge original-scale export fails | Use toolbar export or `fit: true` to stay inside output budgets |
| PNG lacks page text/images | Export is an annotation layer, not a DOM screenshot |
| Unknown custom shape fails to load | Register the same id before importing its data |
| Arbitrary CSS transforms | Axis-aligned scaling is supported; rotate/skew are not |

Logical dimensions and stroke widths are limited to 32768. Shape points are bounded to ±1,000,000,000,000,000 and camera positions to ±1,000,000,000. Generated coordinates are constrained so documents can round-trip. Interactive bitmaps use an approximately 32-million-pixel budget and at most 2x device pixel ratio.

Rendering currently traverses the scene. History stores full state snapshots; `historyLimit` is a count, not a byte budget. Very large stroke collections, mobile WebViews and actual pen hardware need target-device validation. Spatial indexing, stroke compression, chunk storage, object resize/rotation and collaboration are not currently provided.

## Repository and development checks

```text
packages/core/src/   Core, renderer, model, toolbar and public types
packages/vue/src/    Vue adapter
packages/react/src/  React adapter
playground/         Shared local workbench
tests/              Model unit tests
e2e/                Browser interactions, layouts and actual downloads
scripts/            Local package verification
```

```bash
pnpm test          # Unit tests
pnpm typecheck     # TypeScript
pnpm test:e2e      # Playwright browser regressions
pnpm build         # ESM, CJS and declarations for all packages
pnpm check:pack    # Local package, license, module and SSR checks
```

The browser suite uses the configured Playwright browser. To use installed Chrome on PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e
```

`check:pack` creates local archives in `artifacts/` and verifies their contents/imports. SSR checks verify host/content rendering without creating a server-side canvas.

### Publishing

Versioning uses [changesets](https://github.com/changesets/changesets); all three packages share one version.

1. Run `pnpm changeset` on a feature branch, describe the change and commit it.
2. After merging to `master`, the Release workflow opens a Version Packages PR.
3. Merging that PR publishes to npm via Trusted Publishing — no token needed (each package must list `Jacky010/drawink` / `release.yml` as a Trusted Publisher in its npm settings).

To publish manually: `pnpm version-packages && pnpm release`.

## License

[MIT License](./LICENSE). Retain the copyright and permission notice as required by the license. Third-party dependencies retain their own licenses.
