// End-to-end check of the workbench: create, run, edit, file ops, persistence, zip round trip.
// Usage: node tools/e2e/workbench.mjs [url] [screenshot-dir]   (needs Google Chrome installed)
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:5173/'
const shots = process.argv[3]
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', acceptDownloads: true })
const page = await context.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
const log = page.getByRole('log')
const explorer = page.getByRole('tree')
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}
// The run summary line (green "Finished in" or a red error) is always the last thing printed.
const waitRun = async () => {
  await page.locator('[role=log] pre').filter({ hasText: /^(Finished in \d+ ms|Traceback|PythonError)/ }).last().waitFor({ state: 'attached', timeout: 240000 })
  await page.getByRole('tab', { name: 'Output' }).click()
  return log.innerText()
}

await page.goto(url)

// 1. Create a project from the template.
await page.getByRole('button', { name: 'New hybrid project' }).first().click()
await page.getByLabel('Project name').fill('Bell to VQE')
await page.getByRole('button', { name: 'Create project' }).click()
await page.getByRole('tab', { name: 'main.py' }).waitFor()
check('project created, entry file opened', true)
await page.locator('.monaco-editor').waitFor({ timeout: 30000 })
check('Monaco editor loaded', true)
for (const lane of ['classical', 'quantum', 'integration']) {
  check(`lane folder ${lane}/ in explorer`, await explorer.getByRole('button', { name: new RegExp(`^${lane}`) }).isVisible())
}

// 2. Run the VQE (cross-lane imports).
await page.getByRole('button', { name: 'Clear output' }).click()
await page.getByRole('button', { name: 'Run', exact: true }).click()
let out = await waitRun()
const vqe = Number(out.match(/VQE energy:\s+(-?[\d.]+)/)?.[1])
const exact = Number(out.match(/Exact energy:\s+(-?[\d.]+)/)?.[1])
check('VQE runs across lanes', Number.isFinite(vqe) && Math.abs(vqe - exact) < 1e-3, `VQE ${vqe} vs exact ${exact}`)
if (shots) await page.screenshot({ path: `${shots}/wb-run.png` })

// 3. Edit a quantum-lane file and check the next run sees the change (module cache reset).
await explorer.getByRole('button', { name: 'hamiltonian.py' }).click()
await page.getByRole('tab', { name: 'hamiltonian.py' }).waitFor()
await page.evaluate(async () => {
  const { useWorkspace } = await import('/src/stores/workspace.ts')
  const s = useWorkspace.getState()
  s.updateContent('quantum/hamiltonian.py', s.entries['quantum/hamiltonian.py'].content.replace('("II", -1.0523)', '("II", -2.0523)'))
})
await page.getByRole('tab', { name: 'main.py' }).click()
await page.getByRole('button', { name: 'Clear output' }).click()
await page.getByRole('button', { name: 'Run', exact: true }).click()
out = await waitRun()
const exact2 = Number(out.match(/Exact energy:\s+(-?[\d.]+)/)?.[1])
check('edit in another file is picked up', Math.abs(exact2 - (exact - 1)) < 1e-6, `exact ${exact} -> ${exact2}`)
if (!Number.isFinite(exact2)) console.log(out)

// 4. File operations: new file, rename, delete.
await page.getByRole('button', { name: 'New file' }).click()
await page.getByLabel('File name').fill('notes.md')
await page.getByLabel('File name').press('Enter')
await page.getByRole('tab', { name: 'notes.md' }).waitFor()
check('new file created and opened', true)
const notes = explorer.getByRole('button', { name: 'notes.md' })
await notes.click()
await notes.press('F2')
await page.getByLabel('File name').fill('ideas.md')
await page.getByLabel('File name').press('Enter')
check('file renamed (tab follows)', await page.getByRole('tab', { name: 'ideas.md' }).waitFor({ timeout: 5000 }).then(() => true, () => false))
const ideas = explorer.getByRole('button', { name: 'ideas.md' })
await ideas.click()
await ideas.press('Delete')
await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
await page.waitForTimeout(300)
check('file deleted', !(await ideas.isVisible()) && !(await page.getByRole('tab', { name: 'ideas.md' }).isVisible()))

// 5. Reload: project, tabs and the edit survive.
await page.waitForTimeout(800)
await page.reload()
await page.getByRole('tab', { name: 'hamiltonian.py' }).waitFor({ timeout: 15000 })
const persisted = await page.evaluate(async () => {
  const { useWorkspace } = await import('/src/stores/workspace.ts')
  return useWorkspace.getState().entries['quantum/hamiltonian.py'].content.includes('-2.0523')
})
check('session and edits restored after reload', persisted)

// 6. Zip round trip.
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export project as zip' }).click(),
])
const zipPath = await download.path()
check('export downloads a zip', download.suggestedFilename() === 'bell-to-vqe.zip', download.suggestedFilename())
await page.getByRole('button', { name: 'Close project' }).click()
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.getByRole('button', { name: 'Import project (.zip)' }).first().click(),
])
await chooser.setFiles(zipPath)
await page.getByRole('tab', { name: 'main.py' }).waitFor({ timeout: 15000 })
const imported = await page.evaluate(async () => {
  const { useWorkspace } = await import('/src/stores/workspace.ts')
  const s = useWorkspace.getState()
  return { name: s.project?.name, n: Object.keys(s.entries).length, edited: s.entries['quantum/hamiltonian.py']?.content.includes('-2.0523') }
})
check('zip import restores the project', imported.name === 'Bell to VQE' && imported.edited, JSON.stringify(imported))
const projects = await page.evaluate(async () => {
  const { useWorkspace } = await import('/src/stores/workspace.ts')
  return useWorkspace.getState().projects.length
})
check('both projects listed', projects === 2, `${projects} projects`)
if (shots) await page.screenshot({ path: `${shots}/wb-final.png` })

await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
