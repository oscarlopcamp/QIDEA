// End-to-end check of Phase 3: extensions, command palette, keyboard shortcuts.
// Usage: node tools/e2e/extensions.mjs [url] [screenshot-dir]   (needs Google Chrome installed)
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:5173/'
const shots = process.argv[3]
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}
const visible = (locator, timeout = 3000) => locator.waitFor({ timeout }).then(() => true, () => false)
const palette = page.getByRole('combobox')
const runCommand = async (text) => {
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await palette.fill(`>${text}`)
  await page.getByRole('option').first().waitFor()
  await palette.press('Enter')
  await palette.waitFor({ state: 'detached', timeout: 3000 }).catch(() => console.log('  (palette still open after Enter)'))
}

await page.goto(url)

// Extensions view lists all built-ins, all active.
await page.getByRole('button', { name: 'Extensions' }).click()
const lead = await page.getByText(/extensions installed/).innerText()
check('extensions view lists built-ins', /^9 extensions installed/.test(lead), lead)
check('no extension failed', !(await page.getByLabel('Failed to activate').count()))
if (shots) await page.screenshot({ path: `${shots}/ext-view.png` })

// Activity bar is generated from registered views (order 10..90).
const bar = await page.getByRole('navigation', { name: 'Views' }).getByRole('button').allInnerTexts()
const labels = await page.getByRole('navigation', { name: 'Views' }).getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')))
check('activity bar from view registry', labels.slice(0, 5).join(',') === 'Explorer,Project manager,Learn,Test & deploy,Extensions', labels.join(','))

// Palette: open with the shortcut and with F1, filter, Escape closes.
await page.keyboard.press('ControlOrMeta+Shift+P')
check('Ctrl/Cmd+Shift+P opens the palette', await visible(palette))
await palette.fill('>toggle theme')
const first = await page.getByRole('option').first().innerText()
check('fuzzy filter finds the command', first.includes('Toggle light/dark theme'), first)
const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme)
await page.keyboard.press('Enter')
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme)
check('Enter runs the command', themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`)
await runCommand('toggle theme')
await page.keyboard.press('F1')
check('F1 opens the palette', await visible(palette))
await page.keyboard.press('Escape')
check('Escape closes the palette', !(await visible(palette, 500)))

// Commands that need a project are hidden without one.
await page.keyboard.press('ControlOrMeta+Shift+P')
await palette.fill('>export project')
check('"when" hides project commands without a project', (await page.getByRole('option').count()) === 0)
await page.keyboard.press('Escape')

// New project through the palette.
await runCommand('new hybrid project')
await page.getByLabel('Project name').fill('Palette project')
await page.getByRole('button', { name: 'Create project' }).click()
await page.locator('.monaco-editor').waitFor({ timeout: 30000 })
check('project created from a palette command', await visible(page.getByRole('tab', { name: 'main.py' })))

// Go to file (Ctrl/Cmd+P).
await page.keyboard.press('ControlOrMeta+P')
await palette.fill('hamil')
await page.keyboard.press('Enter')
check('Ctrl/Cmd+P opens a file', await visible(page.getByRole('tab', { name: 'hamiltonian.py' })))

// Toggle panel with Ctrl/Cmd+J.
const log = page.getByRole('log')
await page.keyboard.press('ControlOrMeta+J')
await page.waitForTimeout(300)
await page.getByRole('tab', { name: 'Output' }).click().catch(() => {})
const hidden = !(await page.getByRole('tablist', { name: 'Panel' }).isVisible())
await page.keyboard.press('ControlOrMeta+J')
await page.waitForTimeout(300)
check('Ctrl/Cmd+J hides and shows the output panel', hidden && (await page.getByRole('tablist', { name: 'Panel' }).isVisible()))

// Qiskit version quick pick (from an extension, via ctx.ui.showQuickPick).
await page.getByRole('button', { name: /^Qiskit version/ }).click()
await page.getByRole('option').nth(1).waitFor()
const options = await page.getByRole('option').allInnerTexts()
check('version quick pick lists published versions', options.length >= 2, options.map((o) => o.split('\n')[0]).join(' | '))
await page.getByRole('option', { name: /Qiskit 2\.5\.2/ }).click()
check('picking a version updates the status bar', await visible(page.getByRole('button', { name: /^Qiskit version: 2\.5\.2/ })))

// Ctrl/Cmd+Enter inside Monaco runs the active file (global keybinding beats Monaco).
await page.getByRole('tab', { name: 'main.py' }).click()
await page.locator('.monaco-editor textarea').first().focus()
await page.keyboard.press('ControlOrMeta+Enter')
await page.locator('[role=log] pre').filter({ hasText: /^(Finished in \d+ ms|Traceback)/ }).last().waitFor({ state: 'attached', timeout: 240000 })
await page.getByRole('tab', { name: 'Output' }).click()
const out = await log.innerText()
check('Ctrl/Cmd+Enter in the editor runs the file on Qiskit 2.5.2', /VQE energy/.test(out) && /qiskit 2\.5\.2/.test(out))

// New file through the palette opens the inline input in the explorer.
await runCommand('new file')
check('"File: New file" starts inline creation', await visible(page.getByLabel('File name')))
await page.getByLabel('File name').press('Escape')
if (shots) await page.screenshot({ path: `${shots}/ext-final.png` })

check('no uncaught page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
