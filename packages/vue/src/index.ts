import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { Drawboard as CoreDrawboard, createHandle, type DrawboardOptions, type DrawingData } from '@drawink/core'
export type { ToolbarPosition, ToolbarPlacement, ExportImageOptions, BrushSettings, Viewport, Point, ToolbarIcon, BackgroundSettings, CustomShapeDefinition, ToolbarItem, BoardMode, DrawboardHandle, DrawboardOptions, DrawingData, Tool, Shape } from '@drawink/core'
export type AdapterOptions = Omit<DrawboardOptions, 'data' | 'onChange'>

/** Vue 3 component; drawing data uses v-model:data and options remain framework-neutral. */
export const Drawboard = defineComponent({
  name: 'Drawink',
  props: {
    data: Object as PropType<DrawingData>,
    options: { type: Object as PropType<AdapterOptions>, default: () => ({}) },
  },
  emits: {
    'update:data': (_data: DrawingData) => true,
    change: (_data: DrawingData) => true,
    ready: (_board: CoreDrawboard) => true,
  },
  setup(props, { emit, slots, expose }) {
    const host = ref<HTMLElement | null>(null)
    let board: CoreDrawboard | null = null
    const onChange = (data: DrawingData) => {
      emit('update:data', data)
      emit('change', data)
    }
    expose(createHandle(() => board))
    onMounted(() => {
      board = new CoreDrawboard(host.value!, { ...props.options, data: props.data, onChange })
      emit('ready', board)
    })
    watch(() => props.options, options => board?.setOptions({ ...options, onChange }), { deep: true })
    watch(() => props.data, data => {
      if (data && board && JSON.stringify(data) !== JSON.stringify(board.getData())) board.loadData(data)
    }, { deep: true })
    onBeforeUnmount(() => { board?.destroy(); board = null })
    return () => h('div', {
      ref: host, style: { position: 'relative', minHeight: '300px' },
    }, slots.default?.())
  },
})
