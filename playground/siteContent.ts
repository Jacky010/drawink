export type SitePage = 'home' | 'start' | 'docs'

export const installCommands = {
  js: 'npm install @drawink/core',
  vue: 'npm install @drawink/vue',
  react: 'npm install @drawink/react',
} as const

export const integrateSamples = {
  js: `import { Drawboard } from '@drawink/core'

const board = new Drawboard(document.querySelector('#lesson')!, {
  mode: 'document',
  color: '#176b52',
  lineWidth: 3,
  toolbarPosition: 'top-center',
  onChange(data) {
    // 交给你的状态层或持久化
    console.log(data)
  },
})

board.setTool('cylinder')
const snapshot = board.getData()
board.loadData(snapshot)
board.destroy()`,
  vue: `<script setup lang="ts">
import { ref } from 'vue'
import { Drawboard, type DrawingData } from '@drawink/vue'

const data = ref<DrawingData>()
</script>

<template>
  <Drawboard
    v-model:data="data"
    :options="{ mode: 'infinite', toolbarPosition: 'bottom-center' }"
    style="width: 100%; height: 560px"
  />
</template>`,
  react: `import { useRef, useState } from 'react'
import { Drawboard, type DrawboardHandle, type DrawingData } from '@drawink/react'

export function LessonBoard() {
  const board = useRef<DrawboardHandle>(null)
  const [data, setData] = useState<DrawingData>()

  return (
    <Drawboard
      ref={board}
      data={data}
      onChange={setData}
      options={{ mode: 'infinite', toolbarPosition: 'top-right' }}
      style={{ width: '100%', height: 560 }}
    />
  )
}`,
} as const

export const docTopics = [
  {
    id: 'packages',
    title: '包与环境',
    body: [
      '`@drawink/core`：无框架依赖的 Canvas 2D 核心。',
      '`@drawink/vue`：Vue 3.3+，支持 `v-model:data`。',
      '`@drawink/react`：React 18+，支持受控数据与 ref API。',
      '浏览器需要 Canvas 2D、Pointer Events、ResizeObserver；容器需要明确高度。工具栏样式自动注入，无需另引 CSS。',
    ],
  },
  {
    id: 'modes',
    title: '文档批注与无限画板',
    body: [
      '`document`：有限文档坐标，可滚动批注网页内容；长文档用 `contentHeight`。',
      '`infinite`：可平移缩放的世界坐标，保存 `viewport`；底层普通 DOM 需业务自行管理。',
      '工具栏可切换模式；应用也可调用 `setMode()` / `setZoom()` / `fitView()` / `resetView()`。',
    ],
  },
  {
    id: 'tools',
    title: '工具与画笔',
    body: [
      '内置：画笔、直线、矩形、圆/椭圆、三角/菱形/梯形/平行四边形、长方体/圆柱/圆锥、选择、对象擦除、平移。',
      '`setBrush({ color, lineWidth, opacity })` 只影响新绘制对象；已有对象样式保存在各自 Shape 中。',
      '可用 `toolbarIcons`、`toolbarItems`、`shapes` 扩展图标、按钮与自定义几何。',
    ],
  },
  {
    id: 'data',
    title: '保存、恢复与导出',
    body: [
      '`getData()` / `loadData()` 使用版本化 JSON；`loadData` 会把新文档设为历史起点。',
      '导出：`exportImage()`、`exportBlob()`，可选透明底或包含画板背景；工具栏也可直接下载 PNG。',
      'PNG 仅包含批注与可选背景，不包含宿主 DOM 截图。',
    ],
  },
  {
    id: 'lifecycle',
    title: '输入与生命周期',
    body: [
      '`readOnly` 禁止编辑但允许浏览与导出；`disabled` 让画布不接收指针事件。',
      '`penOnly` 按 Pointer Events 区分手指与笔。',
      'Vue/React 卸载时会自动销毁；不要在适配器管理的同一 DOM 上再手动创建核心实例。',
    ],
  },
] as const
