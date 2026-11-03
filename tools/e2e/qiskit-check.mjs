// Smoke test: load every published Qiskit version in the browser and run a Bell circuit.
// Usage: node tools/e2e/qiskit-check.mjs [url] [screenshot.png]   (needs Google Chrome installed)
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:5173/'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300))
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(url)

const select = page.locator('footer select')
await select.waitFor()
const versions = await select.locator('option').evaluateAll((os) => os.map((o) => o.value))
console.log('published versions:', versions.join(', '))

let failed = false
for (const v of versions) {
  await select.selectOption(v)
  await page.getByRole('button', { name: 'Clear output' }).click()
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Run Qiskit check' }).click()
  const done = page.getByText(/^(Finished in|Error|Traceback|Could not|Checksum)/).first()
  await done.waitFor({ timeout: 240000 })
  const log = await page.getByRole('log').innerText()
  const counts = log.match(/Counts: (.*)/)?.[1]
  const runtime = log.match(/Runtime: (.*)/)?.[1]
  const ok = Boolean(counts) && runtime?.includes(`qiskit ${v}`)
  failed ||= !ok
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] Qiskit ${v} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`  counts:  ${counts}`)
  console.log(`  runtime: ${runtime}`)
  if (!ok) console.log(log)
}

if (process.argv[3]) await page.screenshot({ path: process.argv[3] })
await browser.close()
process.exit(failed ? 1 : 0)
