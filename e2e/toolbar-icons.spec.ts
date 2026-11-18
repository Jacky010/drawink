import { test, expect } from '@playwright/test'
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="red"/></svg>')
test('built-in toolbar icons accept images, safe inline SVG and font classes', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).board))
  await page.addStyleTag({ content: '.test-iconfont::before{content:"X";font-family:monospace}' })
  await page.evaluate(src => {
    (window as any).board.setOptions({ toolbarIcons: {
      pen: { type: 'image', src },
      pan: { type: 'svg', content: '<svg viewBox="0 0 24 24"><path d="M2 2L20 20" stroke="currentColor" onload="window.iconXss=1"/><script>window.iconXss=1</script><foreignObject><div>bad</div></foreignObject></svg>' },
      select: { type: 'font', className: 'test-iconfont test-move', text: '\ue601' },
      background: { type: 'image', src },
      rect: { type: 'font', className: 'test-iconfont' },
    } })
  }, image)
  const pen = page.getByRole('button', { name: '画笔', exact: true })
  await expect(pen.locator('img')).toHaveCount(1)
  await expect.poll(() => pen.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  const pan = page.getByRole('button', { name: '滚动', exact: true })
  await expect(pan.locator('svg path')).toHaveCount(1)
  await expect(pan.locator('script,foreignObject')).toHaveCount(0)
  expect(await pan.locator('path').getAttribute('onload')).toBeNull()
  expect(await page.evaluate(() => (window as any).iconXss)).toBeUndefined()
  const font = page.getByRole('button', { name: '选择对象', exact: true }).locator('.test-iconfont')
  await expect(font).toHaveCount(1)
  expect(await font.evaluate(el => getComputedStyle(el, '::before').content)).toBe('"X"')
  await expect(page.getByRole('button', { name: '背景', exact: true }).locator('img')).toHaveCount(1)
  await page.getByRole('button', { name: '形状', exact: true }).click()
  await expect(page.getByRole('button', { name: '矩形', exact: true }).locator('.test-iconfont')).toHaveCount(1)
  await page.getByRole('button', { name: '矩形', exact: true }).click()
  expect(await page.evaluate(() => (window as any).board.tool)).toBe('rect')
})
test('extension icons share the same image/SVG/font API and can be changed at runtime', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).board))
  await page.evaluate(src => (window as any).board.setOptions({ toolbarItems: [{
    id: 'custom-image', label: '图片动作', icon: { type: 'image', src },
    onClick(api: any) { api.setTool('line') },
  }] }), image)
  const action = page.getByRole('button', { name: '图片动作', exact: true })
  await expect(action.locator('img')).toHaveCount(1)
  await action.click()
  expect(await page.evaluate(() => (window as any).board.tool)).toBe('line')
  await page.evaluate(() => (window as any).board.setOptions({ toolbarIcons: {
    'custom-image': { type: 'font', className: 'my-font-icon', text: '★' },
    pen: { type: 'svg', content: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>' },
  } }))
  await expect(action.locator('.my-font-icon')).toHaveText('★')
  await expect(page.getByRole('button', { name: '画笔', exact: true }).locator('svg circle')).toHaveCount(1)
})



test('invalid icon updates are rejected and shared SVG factories remain isolated across instances', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).board))
  const result = await page.evaluate(() => {
    const board = (window as any).board
    let rejected = false
    try { board.setOptions({ toolbarIcons: { pen: { type: 'image', src: 'javascript:window.iconXss=1' } } }) } catch { rejected = true }
    const shared = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    shared.setAttribute('data-shared-icon', 'yes')
    shared.setAttribute('viewBox', '0 0 24 24')
    const path = document.createElementNS(shared.namespaceURI, 'path')
    path.setAttribute('d', 'M2 2L20 20'); shared.append(path)
    const toolbarIcons = { pen: () => shared }
    board.setOptions({ toolbarIcons })
    const host = document.createElement('div')
    host.style.cssText = 'width:300px;height:200px'
    document.body.append(host)
    const other = new (window as any).Drawboard(host, { toolbarIcons })
    const count = document.querySelectorAll('[data-shared-icon=yes]').length
    other.destroy()
    return { rejected, count, remains: document.querySelectorAll('[data-shared-icon=yes]').length, originalDetached: shared.parentNode === null }
  })
  expect(result).toEqual({ rejected: true, count: 2, remains: 1, originalDetached: true })
})

test('inline SVG blocks escaped and variable-based external paint resources', async ({ page }) => {
  const requests: string[] = []
  await page.route('https://example.com/**', route => { requests.push(route.request().url()); return route.abort() })
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).board))
  await page.addStyleTag({ content: ':root{--external-paint:url(https://example.com/variable.svg#p)}' })
  await page.evaluate(() => {
    const escaped = 'u' + String.fromCharCode(92) + '72l(https://example.com/paint.svg#p)'
    ;(window as any).board.setOptions({ toolbarIcons: { pen: {
      type: 'svg', content: '<svg viewBox="0 0 24 24"><rect width="20" height="20" fill="' + escaped + '"/><circle cx="12" cy="12" r="8" stroke="var(--external-paint)"/></svg>',
    } } })
  })
  const pen = page.getByRole('button', { name: '画笔', exact: true })
  expect(await pen.locator('rect').getAttribute('fill')).toBeNull()
  expect(await pen.locator('circle').getAttribute('stroke')).toBeNull()
  await page.waitForTimeout(100)
  expect(requests).toEqual([])
})
test('extension ids matching Object prototype names do not become icon factories', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).board))
  await page.evaluate(() => (window as any).board.setOptions({
    shapes: [{ id: 'constructor', label: '构造图形', draw(ctx: CanvasRenderingContext2D) { ctx.strokeRect(10, 10, 20, 20) } }],
    toolbarItems: [{ id: 'constructor', label: '原型名称操作', onClick(api: any) { api.setTool('pen') } }],
  }))
  await expect(page.getByRole('button', { name: '原型名称操作', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '形状', exact: true }).click()
  await page.getByRole('button', { name: '构造图形', exact: true }).click()
  expect(await page.evaluate(() => (window as any).board.tool)).toBe('constructor')
  await page.getByRole('button', { name: '原型名称操作', exact: true }).click()
  expect(await page.evaluate(() => (window as any).board.tool)).toBe('pen')
})
