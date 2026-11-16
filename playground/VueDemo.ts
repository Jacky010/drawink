import { defineComponent, h, ref } from 'vue'
import { Drawboard, type DrawingData } from '@drawink/vue'
import { demoOptions, emptyDemoData, readDemoData, saveDemoData } from './demoState'
export const VueDemo = defineComponent({
  setup() {
    const data = ref<DrawingData>(readDemoData())
    const visible = ref(true)
    Object.assign(window, {
      demoControls: {
        getData: () => data.value,
        clear() { data.value = emptyDemoData(); saveDemoData(data.value) },
        toggle() { visible.value = !visible.value },
      }
    })
    return () => [
      visible.value ? h(Drawboard, {
        id: 'framework-board', data: data.value,
        options: demoOptions,
        onReady: (board: unknown) => Object.assign(window, { board }),
        'onUpdate:data': (value: DrawingData) => { data.value = value; saveDemoData(value) },
      }, {
        default: () => h('article', { class: 'lesson' }, [
          h('small', 'VUE / V-MODEL:DATA'), h('h2', '把思路，留在页面上。'),
          h('p', '使用 Vue 双向绑定，保存并恢复每一张画板。'),
          h('div', { class: 'formula' }, 'a² + b² = c²'),
          h('section', { class: 'scroll-exercise' }, [
            h('h2', '继续探索 · 几何证明'),
            h('p', '选择滚动，按住画板向上拖动；切回画笔可继续在这一页批注。'),
            h('div', { class: 'formula' }, 'a² = c² − b²'),
          ]),
        ])
      }) : null,

    ]
  },
})

