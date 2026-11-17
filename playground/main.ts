import './style.css'
import './infinite.css'
import { Drawboard, type BoardMode, type ToolbarPlacement } from '@drawink/core'
import { createApp } from 'vue'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { createElement } from 'react'
import { VueDemo } from './VueDemo'
import { ReactDemo } from './ReactDemo'
import { demoMode, demoOptions, readDemoData, saveDemoData, setDemoContext, setModeHandler } from './demoState'
import { docTopics, installCommands, integrateSamples, type SitePage } from './siteContent'

const base = import.meta.env.BASE_URL
type Framework = 'js' | 'vue' | 'react'

function readPage(params = new URLSearchParams(location.search)): SitePage {
  const page = params.get('page')
  return page === 'start' || page === 'docs' ? page : 'home'
}

function readFramework(params = new URLSearchParams(location.search)): Framework {
  const framework = params.get('framework')
  return framework === 'vue' || framework === 'react' || framework === 'js' ? framework : 'js'
}

function sitePath(page: SitePage, framework: Framework, mode: BoardMode) {
  const query = new URLSearchParams()
  if (page !== 'home') query.set('page', page)
  else {
    query.set('framework', framework)
    query.set('mode', mode)
  }
  const text = query.toString()
  return text ? `${base}?${text}` : base
}

let page = readPage()
let active = readFramework()
let startFramework: Framework = active
let cleanup: (() => void) | undefined
const demo = document.querySelector('#demo') as HTMLElement
const placement = document.querySelector<HTMLSelectElement>('#toolbar-placement')!
const current = () => (window as unknown as { board?: Drawboard }).board

function setCopied(button: HTMLButtonElement) {
  const previous = button.textContent
  button.textContent = '已复制'
  window.setTimeout(() => { button.textContent = previous }, 1400)
}

async function copyText(text: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text)
    setCopied(button)
  } catch {
    button.textContent = '复制失败'
  }
}

function renderStart(framework: Framework) {
  startFramework = framework
  document.querySelectorAll<HTMLButtonElement>('[data-start-framework]').forEach(button => {
    button.classList.toggle('active', button.dataset.startFramework === framework)
  })
  document.querySelector('#install-command')!.textContent = installCommands[framework]
  document.querySelector('#integrate-sample')!.textContent = integrateSamples[framework]
}

function renderDocs() {
  const toc = document.querySelector('.docs-toc')!
  const body = document.querySelector('.docs-body')!
  toc.replaceChildren()
  body.replaceChildren()
  for (const topic of docTopics) {
    const link = document.createElement('a')
    link.href = `#${topic.id}`
    link.textContent = topic.title
    toc.append(link)

    const article = document.createElement('article')
    article.id = topic.id
    article.className = 'docs-topic'
    const title = document.createElement('h3')
    title.textContent = topic.title
    article.append(title)
    for (const line of topic.body) {
      const p = document.createElement('p')
      p.innerHTML = line.replace(/`([^`]+)`/g, '<code>$1</code>')
      article.append(p)
    }
    body.append(article)
  }
}

function applyPageVisibility(next: SitePage) {
  document.body.dataset.page = next
  document.querySelectorAll<HTMLElement>('.page-panel').forEach(panel => {
    panel.hidden = panel.id !== `page-${next}`
  })
  document.querySelectorAll<HTMLAnchorElement>('[data-page]').forEach(link => {
    link.classList.toggle('active', link.dataset.page === next)
  })
}

function showPage(next: SitePage, updateHistory = true) {
  page = next
  applyPageVisibility(next)
  if (next === 'home') mount(active, demoMode, false)
  else {
    cleanup?.()
    cleanup = undefined
    delete (window as unknown as { board?: Drawboard }).board
    document.body.classList.remove('infinite-mode')
    if (next === 'start') renderStart(startFramework)
    if (next === 'docs') renderDocs()
  }
  if (updateHistory) history.pushState(null, '', sitePath(next, active, demoMode))
  if (next !== 'home') window.scrollTo({ top: 0 })
}

function mount(framework: string, mode: BoardMode, updateHistory = true) {
  if (page !== 'home') return
  if (cleanup && mode === demoMode) saveDemoData(current()!.getData())
  cleanup?.()
  demo.replaceChildren()
  delete (window as unknown as { board?: Drawboard }).board
  active = framework as Framework
  setDemoContext(framework, mode)
  demoOptions.toolbarPosition = placement.value as ToolbarPlacement
  document.body.classList.toggle('infinite-mode', mode === 'infinite')
  document.querySelector('#status')!.textContent = ''
  if (framework === 'vue') {
    const app = createApp(VueDemo); app.mount(demo); cleanup = () => app.unmount()
  } else if (framework === 'react') {
    const app = createRoot(demo); flushSync(() => app.render(createElement(ReactDemo))); cleanup = () => app.unmount()
  } else {
    demo.innerHTML = '<div id="board"><article class="lesson"><small>SPACE & GEOMETRY / 空间与几何</small><h2>一个圆柱，藏着怎样的关系？</h2><p>选中右上角的圆柱工具，在页面上拖动绘制。<br>试着标出底面、高，以及展开后的侧面。</p><div class="formula">V = πr²h &nbsp; · &nbsp; S = 2πr(r + h)</div><div class="rule"></div><p>01 &nbsp; 画出一个圆柱，观察上下底面的关系。<br>02 &nbsp; 用画笔标记你的发现。</p><section class="scroll-exercise"><h2>继续探索 · 展开与推导</h2><p>切换到滚动，在画板内按住并向上拖动，查看下方内容。<br>再切回画笔，批注会保留在原来的文档位置。</p><div class="formula">S侧 = 2πrh</div></section></article></div>'
    const board = new Drawboard(document.querySelector('#board')!, {
      ...demoOptions, data: readDemoData(), onChange: data => saveDemoData(data),
    })
    Object.assign(window, { board, Drawboard }); cleanup = () => board.destroy()
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-framework]').forEach(link => {
    link.classList.toggle('active', link.dataset.framework === framework)
    link.href = sitePath('home', link.dataset.framework as Framework, mode)
  })
  document.querySelector('#mode-help')!.textContent = mode === 'infinite'
    ? '无限画板：拖动平移视野，滚轮或双指缩放；显示全部可找回图形，再点画笔可调颜色、粗细和透明度。'
    : '文档批注：选择滚动工具，按住画板上下拖动查看后续内容。'
  if (updateHistory) history.pushState(null, '', sitePath('home', active, mode))
}

function syncFromLocation(updateHistory = false) {
  const params = new URLSearchParams(location.search)
  active = readFramework(params)
  startFramework = active
  const next = readPage(params)
  const mode = params.get('mode') === 'infinite' ? 'infinite' : 'document'
  if (next === 'home') {
    page = 'home'
    applyPageVisibility('home')
    mount(active, mode, updateHistory)
  } else {
    showPage(next, updateHistory)
    if (next === 'start' && location.hash === '#intro-video') {
      queueMicrotask(() => document.querySelector('#intro-video')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }
}

setModeHandler(mode => mount(active, mode))
document.querySelectorAll<HTMLAnchorElement>('[data-framework]').forEach(link => {
  link.onclick = event => {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (link.dataset.framework !== active) mount(link.dataset.framework!, demoMode)
  }
})
document.querySelectorAll<HTMLAnchorElement>('[data-page]').forEach(link => {
  link.onclick = event => {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const next = link.dataset.page as SitePage
    if (next !== page) showPage(next)
  }
})
document.querySelectorAll<HTMLButtonElement>('[data-start-framework]').forEach(button => {
  button.onclick = () => renderStart(button.dataset.startFramework as Framework)
})
document.querySelector('#copy-install')!.addEventListener('click', event => {
  void copyText(installCommands[startFramework], event.currentTarget as HTMLButtonElement)
})
document.querySelector('#copy-sample')!.addEventListener('click', event => {
  void copyText(integrateSamples[startFramework], event.currentTarget as HTMLButtonElement)
})
placement.onchange = () => current()?.setOptions({ toolbarPosition: placement.value as ToolbarPlacement })
window.addEventListener('popstate', () => syncFromLocation(false))
syncFromLocation(false)
