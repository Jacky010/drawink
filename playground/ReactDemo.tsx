import { StrictMode, useState } from 'react'
import { Drawboard, type DrawingData } from '@drawink/react'
import { demoOptions, emptyDemoData, readDemoData, saveDemoData } from './demoState'
export function ReactDemo() {
  const [data, setData] = useState<DrawingData>(readDemoData)
  const [visible, setVisible] = useState(true)
  Object.assign(window, {
    demoControls: {
      getData: () => data,
      clear() { const empty = emptyDemoData(); setData(empty); saveDemoData(empty) },
      toggle() { setVisible(value => !value) },
    }
  })
  return <StrictMode>
    {visible && <Drawboard id="framework-board" onReady={board => { Object.assign(window, { board }) }} data={data} onChange={value => { setData(value); saveDemoData(value) }} options={demoOptions}>
      <article className="lesson"><small>REACT / CONTROLLED DATA</small><h2>每一笔，都有自己的位置。</h2><p>在内容上直接批注，React 只负责数据与生命周期。</p><div className="formula">V = πr²h</div><section className="scroll-exercise"><h2>继续探索 · 展开与推导</h2><p>选择滚动，按住画板向上拖动；切回画笔可继续批注。</p><div className="formula">S侧 = 2πrh</div></section></article>
    </Drawboard>}

  </StrictMode>
}

