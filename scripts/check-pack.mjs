import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const output = resolve('artifacts')
mkdirSync(output, { recursive: true })

function entries(path) {
  const tar = gunzipSync(readFileSync(path))
  const files = new Map()
  for (let offset = 0; offset < tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '')
    if (!name) break
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim() || '0', 8)
    files.set(name, tar.subarray(offset + 512, offset + 512 + size))
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return files
}

for (const folder of ['core', 'vue', 'react']) {
  const cwd = resolve('packages', folder)
  const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8').replace(/^\uFEFF/, ''))
  const result = spawnSync('pnpm', ['pack', '--pack-destination', output], {
    cwd, stdio: 'inherit', shell: process.platform === 'win32',
  })
  assert.equal(result.status, 0, 'pnpm pack must succeed')
  const tarball = pkg.name.replace('@', '').replace('/', '-') + '-' + pkg.version + '.tgz'
  const files = entries(resolve(output, tarball))
  for (const name of ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts', 'LICENSE', 'README.md']) {
    assert.ok(files.has('package/' + name), pkg.name + ' missing ' + name)
  }
  assert.ok([...files.keys()].every(name => !/node_modules|\.env|\/src\//.test(name)), 'Unexpected private/source files')
  const packed = JSON.parse(files.get('package/package.json').toString())
  assert.equal(packed.license, 'MIT')
  assert.match(files.get('package/LICENSE').toString(), /^MIT License/)
  for (const doc of ['README.md', 'README.zh-CN.md']) {
    assert.ok(files.has('package/' + doc), pkg.name + ' missing ' + doc)
    assert.doesNotMatch(files.get('package/' + doc).toString(), /npm\s+(?:publish|login|adduser)|AGPL/i)
  }
  if (folder !== 'core') assert.equal(packed.dependencies['@drawink/core'], '^0.1.1')
  const esm = await import(pathToFileURL(resolve(cwd, 'dist/index.js')))
  const cjs = createRequire(resolve(cwd, 'package.json'))(resolve(cwd, 'dist/index.cjs'))
  assert.equal(typeof esm.Drawboard, folder === 'core' ? 'function' : 'object')
  assert.equal(typeof cjs.Drawboard, folder === 'core' ? 'function' : 'object')
  if (folder === 'vue') {
    const { createSSRApp, h } = await import('vue')
    const { renderToString } = await import('vue/server-renderer')
    assert.match(await renderToString(createSSRApp(() => h(esm.Drawboard, null, () => 'SSR lesson'))), /SSR lesson/)
  }
  if (folder === 'react') {
    const { createElement } = await import('react')
    const { renderToString } = await import('react-dom/server')
    assert.match(renderToString(createElement(esm.Drawboard, null, 'SSR lesson')), /SSR lesson/)
  }
  console.log('Verified package, ESM/CJS and SSR:', pkg.name)
}

