// End-to-end check of Phase 4: simulator vs Qiskit, Python bridge, Results panel.
// Usage: node tools/e2e/simulator.mjs [url] [screenshot-dir]   (needs Google Chrome installed)
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:5173/'
const shots = process.argv[3]
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}
const log = page.locator('[role=log]')
const runActive = async () => {
  await page.getByRole('button', { name: 'Clear output' }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.locator('[role=log] pre').filter({ hasText: /^(Finished in \d+ ms|Traceback)/ }).last().waitFor({ state: 'attached', timeout: 240000 })
  const results = (await page.getByRole('tab', { name: /Results/ }).getAttribute('aria-selected')) === 'true'
  await page.getByRole('tab', { name: 'Output' }).click()
  const text = await log.innerText()
  if (results) await page.getByRole('tab', { name: /Results/ }).click()
  return text
}
const setContent = (path, content) =>
  page.evaluate(
    async ([p, c]) => {
      const { useWorkspace } = await import('/src/stores/workspace.ts')
      const ws = useWorkspace.getState()
      if (!ws.entries[p]) await ws.createEntry('', p, 'file')
      ws.updateContent(p, c)
      ws.openFile(p)
    },
    [path, content],
  )

await page.goto(url)
await page.getByRole('button', { name: 'New hybrid project' }).first().click()
await page.getByLabel('Project name').fill('Simulator checks')
await page.getByRole('button', { name: 'Create project' }).click()
await page.locator('.monaco-editor').waitFor({ timeout: 30000 })

// 1. Cross-check: QIDEA's simulator vs Qiskit's Statevector on random circuits.
await setContent(
  'crosscheck.py',
  `import json, random
import _qidea_native
from qiskit import qasm2, transpile
from qiskit.circuit.random import random_circuit
from qiskit.quantum_info import Statevector

worst = 0.0
n = 0
for seed in range(60):
    nq = 1 + seed % 6
    qc = random_circuit(nq, depth=6, max_operands=3, seed=seed)
    # Express in gates OpenQASM 2 knows (random_circuit uses a wide gate set).
    qc = transpile(qc, basis_gates=["u", "cx", "cz", "swap", "ccx", "rzz", "rxx", "h", "rz", "ry", "rx", "p"], optimization_level=0)
    ours = json.loads(_qidea_native.probabilities(qasm2.dumps(qc)))
    ref = Statevector(qc).probabilities_dict()
    keys = set(ours) | set(ref)
    worst = max(worst, max(abs(ours.get(k, 0) - ref.get(k, 0)) for k in keys))
    n += 1
print(f"CROSSCHECK circuits={n} max_abs_diff={worst:.3e}")
`,
)
let out = await runActive()
const m = out.match(/CROSSCHECK circuits=(\d+) max_abs_diff=([\d.e+-]+)/)
check('simulator matches Qiskit Statevector on 60 random circuits', m && Number(m[2]) < 1e-9, m ? `max |Δp| = ${m[2]}` : out.slice(-600))

// 2. Bell example: Qiskit's plot_histogram and qc.draw("mpl") land in Results.
await page.getByRole('tree').getByRole('button', { name: 'bell.py' }).click()
out = await runActive()
const counts = JSON.parse((out.match(/\{'00'.*\}|\{'11'.*\}/)?.[0] ?? '{}').replaceAll("'", '"'))
check('LocalSimulator().run() returns Bell counts', Object.keys(counts).sort().join() === '00,11', JSON.stringify(counts))
check('Results tab opens by itself', (await page.getByRole('tab', { name: /Results/ }).getAttribute('aria-selected')) === 'true')
const cards = await page.getByRole('tabpanel', { name: 'Results' }).locator('section h3').allInnerTexts()
check('qc.draw("mpl") and plot_histogram() both shown', cards.join('|') === 'Bell state|Bell state', cards.join(' | '))
check('circuit diagram rendered', (await page.getByRole('img', { name: /Circuit diagram with 2 qubits/ }).count()) === 1)
check('histogram rendered', (await page.getByRole('img', { name: /Histogram of 1,024 shots over 2 outcomes/ }).count()) === 1)
await page.getByRole('img', { name: /Histogram/ }).locator('rect[fill=transparent]').first().hover()
check('hover shows a tooltip', /shots \(/.test(await page.getByRole('tooltip').innerText()))
await page.getByRole('button', { name: 'Show as table' }).click()
check('table view lists outcomes', (await page.getByRole('tabpanel', { name: 'Results' }).locator('tbody tr').count()) === 2)
await page.getByRole('button', { name: 'Show as chart' }).click()
if (shots) await page.screenshot({ path: `${shots}/sim-bell.png` })

// 3. VQE template: ansatz circuit + optimised-state histogram.
await page.getByRole('tree').getByRole('button', { name: 'main.py' }).click()
out = await runActive()
const titles = await page.getByRole('tabpanel', { name: 'Results' }).locator('section h3').allInnerTexts()
check('VQE shows the ansatz and the optimised state', titles.join('|') === 'Ansatz|Optimised state, 2,048 shots', titles.join(' | '))
check('VQE still converges', /Error:\s+\d\.\d+e-(0[5-9]|1\d)/.test(out), out.match(/Error:.*/)?.[0])
if (shots) await page.screenshot({ path: `${shots}/sim-vqe.png` })

// 4. Helpful errors from the backend.
await setContent(
  'errors.py',
  `from qiskit import QuantumCircuit
from qidea import LocalSimulator
qc = QuantumCircuit(1)
qc.h(0)
LocalSimulator().run(qc)
`,
)
out = await runActive()
check('running without measurements explains what to do', /has no measurements\. Add qc\.measure_all\(\)/.test(out))

// 5. Mid-circuit measurement and several registers through Qiskit -> QASM -> simulator.
await setContent(
  'midcircuit.py',
  `from qiskit import QuantumCircuit, ClassicalRegister, QuantumRegister
from qidea import LocalSimulator
q = QuantumRegister(1, "q"); a = ClassicalRegister(1, "a"); b = ClassicalRegister(1, "b")
qc = QuantumCircuit(q, a, b)
qc.h(0); qc.measure(0, a[0]); qc.x(0); qc.measure(0, b[0])
print("MID", dict(sorted(LocalSimulator().run(qc, shots=400, seed=1).result().get_counts().items())))
`,
)
out = await runActive()
const mid = out.match(/MID (\{.*\})/)?.[1] ?? ''
check('mid-circuit measurement with two registers', /^\{'0 1': \d+, '1 0': \d+\}$/.test(mid), mid)

check('no uncaught page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
