import fs from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'

export async function verifyReleaseBrowser(origin, principals, directory) {
  const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)
  let executable
  for (const candidate of candidates) { try { await fs.access(candidate); executable = candidate; break } catch {} }
  if (!executable) throw new Error('Release browser verification requires Chrome/Edge; set CHROME_PATH')
  const port = await new Promise(resolve => { const listener = net.createServer(); listener.listen(0, '127.0.0.1', () => { const value = listener.address().port; listener.close(() => resolve(value)) }) })
  const chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(directory, 'browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let socket
  const exceptions = []
  try {
    let target
    for (let attempt = 0; ; attempt++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json()).find(item => item.type === 'page'); if (target) break }
      catch {}
      if (attempt >= 60 || chrome.exitCode !== null) throw new Error('Headless release browser did not start')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('Browser debugging connection failed')), { once: true }) })
    let sequence = 0
    const pending = new Map()
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data))
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') exceptions.push(message.params.args.map(argument => argument.value ?? argument.description ?? '').join(' '))
      const waiter = pending.get(message.id)
      if (waiter) { clearTimeout(waiter.timer); pending.delete(message.id); if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result) }
    })
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)) }, 30000)
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error('Browser evaluation failed: ' + result.exceptionDetails.text)
      return result.result?.value
    }
    const wait = async (condition, description) => {
      const until = Date.now() + 30000
      while (Date.now() < until) { if (await evaluate(condition)) return; await new Promise(resolve => setTimeout(resolve, 100)) }
      throw new Error('Browser assertion timed out: ' + description + '; ' + await evaluate(`JSON.stringify({url:location.href,text:document.body.innerText.slice(0,1400)})`))
    }
    const key = async (name, code, virtual, modifiers = 0) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: virtual, modifiers, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: virtual, modifiers })
    }
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await send(method)
    const cookie = principal => principal.cookie.slice(principal.cookie.indexOf('=') + 1)
    await send('Network.setCookie', { name: 'procureatlas_session', value: cookie(principals[0]), url: origin, path: '/', httpOnly: true, sameSite: 'Lax' })
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await send('Page.navigate', { url: origin + '/?view=settings' })
    const themeSelect = `document.querySelector('#appearance-theme')`
    await wait(`!!${themeSelect} && !${themeSelect}.disabled`, 'Settings theme selector is available')
    const chooseTheme = async value => { await evaluate(`${themeSelect}.value = ${JSON.stringify(value)}; ${themeSelect}.dispatchEvent(new Event('change', { bubbles: true }))`) }
    await chooseTheme('dark')
    await wait(`document.documentElement.classList.contains('dark') && localStorage.getItem('procureatlas.theme') === 'dark'`, 'dark theme applies and persists')
    if (!await evaluate(`['body', 'header', '#appearance-settings', '#appearance-theme'].every(selector => { const color = getComputedStyle(document.querySelector(selector)).backgroundColor; return color !== 'rgb(255, 255, 255)' && color !== 'rgba(0, 0, 0, 0)' })`)) throw new Error('Dark theme left Settings surfaces white or transparent')
    await fs.writeFile(path.resolve('.private/theme-dark-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false })
    await fs.writeFile(path.resolve('.private/theme-dark-desktop.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await send('Page.reload')
    await wait(`!!${themeSelect} && !${themeSelect}.disabled && ${themeSelect}.value === 'dark' && document.documentElement.classList.contains('dark')`, 'saved dark preference survives refresh')
    await chooseTheme('system')
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
    await wait(`!document.documentElement.classList.contains('dark')`, 'system theme follows light OS preference')
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
    await wait(`document.documentElement.classList.contains('dark')`, 'system theme follows live dark OS preference')
    await chooseTheme('light')
    await wait(`!document.documentElement.classList.contains('dark')`, 'explicit light preference overrides dark OS preference')
    await chooseTheme('dark')
    await wait(`document.documentElement.classList.contains('dark')`, 'dark theme restored for remaining workflow checks')
    await send('Page.navigate', { url: origin + '/?view=analytics' })
    await wait(`document.querySelector('h1')?.textContent.includes('Analytics')`, 'real analytics response renders with unknown provider costs')
    await send('Page.navigate', { url: origin + '/?view=company' })
    await wait(`document.body.innerText.includes(${JSON.stringify(principals[0].company.name)})`, 'tenant A company and client hydration')
    const menu = `document.querySelector('button[aria-label="Open module menu"]')`
    await wait(`!!${menu}`, 'mobile module menu')
    await evaluate(`${menu}.focus()`); await key('Enter', 'Enter', 13)
    await wait(`!!document.querySelector('[role="dialog"]')`, 'keyboard opened mobile menu')
    await key('Tab', 'Tab', 9)
    if (!await evaluate(`document.querySelector('[role="dialog"]').contains(document.activeElement)`)) throw new Error('Mobile menu did not trap keyboard focus')
    await key('Escape', 'Escape', 27)
    await wait(`!document.querySelector('[role="dialog"]')`, 'Escape closes module menu')
    if (!await evaluate(`document.activeElement === ${menu}`)) throw new Error('Module menu did not restore focus')
    await evaluate(`${menu}.click()`)
    await wait(`!!document.querySelector('[role="dialog"]')`, 'menu reopened')
    await evaluate(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(button => button.textContent.trim() === 'Discover').click()`)
    await wait(`new URLSearchParams(location.search).get('view') === 'discover' && !!document.querySelector('h1') && document.querySelector('h1').textContent.includes('Tender Radar')`, 'URL-backed Discover navigation')
    await send('Page.reload')
    await wait(`!!document.querySelector('h1') && document.querySelector('h1').textContent.includes('Tender Radar')`, 'refresh restores Discover')
    await evaluate('history.back()')
    await wait(`new URLSearchParams(location.search).get('view') === 'company'`, 'browser back restores Company')
    await evaluate('history.forward()')
    await wait(`new URLSearchParams(location.search).get('view') === 'discover'`, 'browser forward restores Discover')
    await wait(`!!document.querySelector('button[aria-label="Switch language"]')`, 'reactive locale control')
    await evaluate(`document.querySelector('button[aria-label="Switch language"]').click()`)
    await wait(`document.documentElement.lang === 'bn' && /[\u0980-\u09FF]/.test(document.querySelector('h1')?.textContent ?? '')`, 'Bangla view translation')
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === 'ভাষা পরিবর্তন করুন').click()`)
    await wait(`document.documentElement.lang === 'en'`, 'locale switches back')
    await send('Page.navigate', { url: origin + '/?view=company' })
    await wait(`Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Add Evidence')`, 'evidence launcher')
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Add Evidence').focus()`)
    await key('Enter', 'Enter', 13)
    await wait(`!!document.querySelector('[role="dialog"]')`, 'keyboard opens evidence dialog')
    if (!await evaluate(`getComputedStyle(document.querySelector('[role="dialog"]')).backgroundColor === 'rgb(17, 28, 47)'`)) throw new Error('Evidence dialog did not use the dark card surface')
    if (!await evaluate(`Array.from(document.querySelectorAll('[role="dialog"] input,[role="dialog"] select,[role="dialog"] textarea')).every(control => control.getAttribute('aria-label') || (control.id && document.querySelector('label[for="'+control.id+'"]'))) `)) throw new Error('Workflow dialog has an unassociated form label')
    await key('Tab', 'Tab', 9)
    if (!await evaluate(`document.querySelector('[role="dialog"]').contains(document.activeElement)`)) throw new Error('Workflow dialog did not trap focus')
    await key('Escape', 'Escape', 27)
    await wait(`!document.querySelector('[role="dialog"]')`, 'Escape closes evidence dialog')
    if (!await evaluate(`document.activeElement?.textContent.trim() === 'Add Evidence'`)) throw new Error('Workflow dialog did not restore launch focus')
    await evaluate(`document.querySelector('[role="combobox"]').focus()`)
    await send('Input.insertText', { text: 'Release procurement workflow' })
    await wait(`!!document.querySelector('#global-search-results [role="option"]')`, 'global search returns real procurement records')
    await key('ArrowDown', 'ArrowDown', 40)
    await key('Enter', 'Enter', 13)
    await wait(`new URLSearchParams(location.search).get('view') === 'tender' && !!new URLSearchParams(location.search).get('tenderId')`, 'keyboard search selection opens a shareable tender detail')
    await send('Page.reload')
    await wait(`document.querySelector('h1')?.textContent.includes('Release procurement workflow')`, 'refresh restores the searched tender detail')
    await send('Network.setCookie', { name: 'procureatlas_session', value: cookie(principals[1]), url: origin, path: '/', httpOnly: true, sameSite: 'Lax' })
    await send('Page.navigate', { url: origin + '/?view=company' })
    await wait(`document.body.innerText.includes(${JSON.stringify(principals[1].company.name)})`, 'tenant B company after session switch')
    if (await evaluate(`document.body.innerText.includes(${JSON.stringify(principals[0].company.name)})`)) throw new Error('Browser rendered another tenant company')
    if (exceptions.length) throw new Error('Browser runtime exception: ' + exceptions.join(', '))
    console.log('Browser passed: saved Light/Dark/System themes, live OS appearance, dark surfaces/dialogs, real analytics, mobile keyboard menu, history/refresh, reactive Bangla, focus trap/restoration, global search/detail links and tenant switch.')
    await send('Browser.close').catch(() => undefined)
  } finally {
    socket?.close()
    if (chrome.exitCode === null) {
      await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
      if (chrome.exitCode === null) chrome.kill()
    }
  }
}
