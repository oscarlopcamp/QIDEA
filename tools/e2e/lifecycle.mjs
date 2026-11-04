// End-to-end check of Phases 5 and 6: qidea.lock, run history, reproduction, project manager.
// Usage: node tools/e2e/lifecycle.mjs [url] [screenshot-dir]   (needs Google Chrome installed)
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:5173/'
const shots = process.argv[3]
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, colorScheme: 'dark' })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}
const visible = (locator, timeout = 4000) => locator.waitFor({ timeout }).then(() => true, () => false)
const ws = (fn, arg) =>
  page.evaluate(
    async ([src, a]) => {
      const { useWorkspace } = await import('/src/stores/workspace.ts')
      // eslint-disable-next-line no-new-func
      return new Function('s', 'a', `return (${src})(s, a)`)(useWorkspace.getState(), a)
    },
    [fn.toString(), arg],
  )
const waitRun = async () => {
  await page.locator('[role=log] pre').filter({ hasText: /^(Finished in \d+ ms|Traceback)/ }).last().waitFor({ state: 'attached', timeout: 240000 })
  await page.waitForTimeout(400) // let the record and lock be written
}
const run = async () => {
  await page.getByRole('button', { name: 'Clear output' }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await waitRun()
}
const pick = async (re) => {
  await page.getByRole('option', { name: re }).click()
}

await page.goto(url)
await page.getByRole('button', { name: 'New hybrid project' }).first().click()
await page.getByLabel('Project name').fill('Lifecycle checks')
await page.getByRole('button', { name: 'Create project' }).click()
await page.locator('.monaco-editor').waitFor({ timeout: 30000 })

// ---------- Phase 5: lock + history + reproduce ----------
check('no qidea.lock before the first run', !(await ws((s) => Boolean(s.entries['qidea.lock']))))
await run() // integration/main.py, Qiskit 2.6.1 (default)
const lock = JSON.parse((await ws((s) => s.entries['qidea.lock']?.content)) ?? 'null')
check('first successful run writes qidea.lock', lock?.packages?.qiskit === '2.6.1' && lock.packages.numpy && lock.python && lock.pyodide, JSON.stringify(lock?.packages))
check('status bar shows the project is locked', await visible(page.getByText('locked', { exact: true })))
check('.qidea is hidden in the explorer', !(await page.getByRole('tree').getByRole('button', { name: '.qidea' }).count()))
const runs1 = await ws((s) => Object.keys(s.entries).filter((p) => p.startsWith('.qidea/runs/')).length)
check('the run is recorded in .qidea/runs/', runs1 === 1, `${runs1} record(s)`)

// Select another version: running asks what to do.
await page.getByRole('button', { name: /^Qiskit version/ }).click()
await pick(/Qiskit 2\.5\.2/)
check('status bar flags the mismatch', await visible(page.getByText('lock: 2.6.1')))
await page.getByRole('button', { name: 'Clear output' }).click()
await page.getByRole('button', { name: 'Run', exact: true }).click()
const options = await page.getByRole('option').allInnerTexts()
check('mismatch asks: locked / once / update', options.length === 3 && /Use Qiskit 2\.6\.1/.test(options[0]), options.map((o) => o.split('\n')[0]).join(' | '))
await pick(/Run once with Qiskit 2\.5\.2/)
await waitRun()
const out = await page.locator('[role=log]').evaluate((el) => el.textContent)
check('"run once" used 2.5.2', /qiskit 2\.5\.2/.test(out))
check('"run once" kept the lock', JSON.parse(await ws((s) => s.entries['qidea.lock'].content)).packages.qiskit === '2.6.1')

// Reproduce the first run from History.
await page.getByRole('tab', { name: 'History' }).click()
const items = page.getByRole('list', { name: 'Runs' }).getByRole('button')
check('history lists both runs', (await items.count()) === 2)
await items.nth(1).click() // the older (2.6.1) run
check('detail shows exact versions', await visible(page.getByLabel('Run details').getByText('2.6.1').first()))
if (shots) await page.screenshot({ path: `${shots}/lc-history.png` })
await page.getByRole('tab', { name: 'Output' }).click()
await page.getByRole('button', { name: 'Clear output' }).click()
await page.getByRole('tab', { name: 'History' }).click()
await page.getByRole('button', { name: 'Reproduce this run' }).click()
await waitRun()
await page.getByRole('tab', { name: 'History' }).click()
const repro = await page.getByLabel('Run details').innerText()
check('reproduction is identical (seeded VQE)', /same output and results/.test(repro), repro.split('\n').slice(0, 3).join(' / '))
check('reproduction ran on the recorded version', /Qiskit\s*2\.6\.1/.test(repro))

// Update the lock through the mismatch prompt.
await page.getByRole('button', { name: /^Qiskit version/ }).click()
await pick(/Qiskit 2\.5\.2/)
await page.getByRole('tab', { name: 'Output' }).click()
await page.getByRole('button', { name: 'Clear output' }).click()
await page.getByRole('button', { name: 'Run', exact: true }).click()
await pick(/Update qidea\.lock to Qiskit 2\.5\.2/)
await waitRun()
const lock2 = JSON.parse(await ws((s) => s.entries['qidea.lock'].content))
const manifest = JSON.parse(await ws((s) => s.entries['qidea.json'].content))
check('"update" rewrites qidea.lock and qidea.json', lock2.packages.qiskit === '2.5.2' && manifest.runtime.python.packages.qiskit === '2.5.2')

// Reopening the project picks the locked version.
await page.reload()
await page.getByRole('tab', { name: 'main.py' }).waitFor({ timeout: 15000 })
check('reload selects the locked version', await visible(page.getByRole('button', { name: /^Qiskit version: 2\.5\.2/ })))

// ---------- Phase 6: project manager ----------
await page.keyboard.press('ControlOrMeta+Shift+M')
check('Ctrl/Cmd+Shift+M opens the board', await visible(page.getByRole('grid', { name: 'Project board' })))
const headers = await page.getByRole('columnheader').evaluateAll((els) => els.map((e) => e.querySelector('span')?.firstChild?.textContent ?? '').filter(Boolean))
check('columns are the 8 generic stages', headers.join(',') === 'Requirements,Analysis,Design,Implementation,Testing,Validation,Deployment,Maintenance', headers.join(','))
const rows = await page.getByRole('rowheader').allInnerTexts()
check('rows are the three lanes', rows.map((r) => r.split('\n')[0]).join(',') === 'Classical,Quantum,Integration')
const cards = await page.getByRole('grid').getByRole('button', { pressed: false }).count()
check('template board has seeded tasks', cards >= 16, `${cards} cards`)
check('lane progress shown', await visible(page.getByRole('progressbar', { name: 'Quantum progress' })))
if (shots) await page.screenshot({ path: `${shots}/lc-board.png` })

// Card → open code at the linked line.
await page.getByRole('button', { name: /Interface: energy\(params\)/ }).click()
check('detail panel opens', await visible(page.getByRole('complementary', { name: 'Task' })))
if (shots) await page.screenshot({ path: `${shots}/lc-detail.png` })
await page.getByRole('complementary', { name: 'Task' }).getByRole('button', { name: 'Open code' }).click()
await page.locator('.monaco-editor').waitFor()
await page.waitForTimeout(500)
const sel = await page.evaluate(async () => {
  const { monaco } = await import('/src/ui/editor/monacoSetup.ts')
  const ed = monaco.editor.getEditors()[0]
  return { line: ed.getSelection()?.startLineNumber, file: ed.getModel()?.uri.path }
})
check('"Open code" jumps to the linked line in Code mode', sel.file === '/integration/main.py' && sel.line === 16, JSON.stringify(sel))

// Add a task, change status, link a file.
await page.getByRole('radio', { name: 'Manager' }).click()
const cell = page.getByRole('gridcell').nth(8 * 1 + 2) // quantum row, Design column
await cell.hover()
await cell.getByRole('button', { name: /Add a task/ }).click()
await page.getByLabel('New task title').fill('Try a deeper ansatz')
await page.getByLabel('New task title').press('Enter')
const detail = page.getByRole('complementary', { name: 'Task' })
const titleOk = await page
  .waitForFunction(() => document.querySelector('aside[aria-label="Task"] input')?.value === 'Try a deeper ansatz', null, { timeout: 4000 })
  .then(() => true, () => false)
check('new task opens in the detail panel', titleOk, await detail.getByLabel('Title').inputValue())
await detail.getByRole('button', { name: 'In progress' }).click()
await detail.getByRole('button', { name: 'Link a file' }).click()
const filePicker = page.getByRole('combobox', { name: /Choose a project file/ })
await filePicker.fill('ansatz')
await page.locator('#palette-list [role=option]').first().waitFor()
await filePicker.press('Enter')
await page.waitForTimeout(300)
const saved = await ws((s) => JSON.parse(s.entries['.qidea/manager.json'].content).items.find((i) => i.title === 'Try a deeper ansatz'))
check('task saved with status and link', saved?.status === 'doing' && saved.stageId === 'design' && saved.lane === 'quantum' && saved.links[0]?.path === 'quantum/ansatz.py', JSON.stringify(saved))

// Drag the task to Implementation / Integration.
const card = page.getByRole('button', { name: /Try a deeper ansatz/ })
const target = page.getByRole('gridcell').nth(8 * 2 + 3)
await card.dragTo(target)
await page.waitForTimeout(300)
const moved = await ws((s) => JSON.parse(s.entries['.qidea/manager.json'].content).items.find((i) => i.title === 'Try a deeper ansatz'))
check('drag and drop moves the task', moved?.stageId === 'implementation' && moved.lane === 'integration', `${moved?.stageId}/${moved?.lane}`)

// Status filter.
await page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'Done' }).click()
const doneCards = await page.getByRole('grid').locator('[draggable=true]').count()
const doneInData = await ws((s) => JSON.parse(s.entries['.qidea/manager.json'].content).items.filter((i) => i.status === 'done').length)
check('status filter shows only matching tasks', doneCards === doneInData, `${doneCards} shown, ${doneInData} done`)
await page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'All' }).click()

// Switch methodology: V-model columns, unknown stages go to Unassigned.
await page.getByLabel('Methodology').selectOption('v-model')
await page.getByRole('columnheader', { name: /Acceptance testing/ }).waitFor({ timeout: 4000 }).catch(() => {})
const vHeaders = await page.getByRole('columnheader').evaluateAll((els) => els.map((e) => e.querySelector('span')?.firstChild?.textContent ?? '').filter(Boolean))
check('V-model columns, with an Unassigned column', vHeaders[0] === 'Unassigned' && vHeaders.includes('Acceptance testing'), vHeaders.join(','))
await page.getByLabel('Methodology').selectOption('generic')

// Manager data travels in the zip.
const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('ControlOrMeta+Shift+P').then(async () => {
  const box = page.getByRole('combobox', { name: 'Type a command' })
  await box.fill('>export project')
  await page.locator('#palette-list [role=option]').first().waitFor()
  await box.press('Enter')
})])
const { default: JSZip } = await import('jszip')
const zip = await JSZip.loadAsync(await (await import('node:fs/promises')).readFile(await download.path()))
const names = Object.keys(zip.files)
check('zip includes qidea.lock, manager.json and run records', names.includes('qidea.lock') && names.includes('.qidea/manager.json') && names.some((n) => n.startsWith('.qidea/runs/')))

check('no uncaught page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
