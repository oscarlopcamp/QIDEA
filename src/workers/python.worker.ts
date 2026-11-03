/// <reference lib="webworker" />
import type { PyodideAPI } from 'pyodide'
import type { RuntimeLock } from '@/services/runtimes/types'
import type { WorkerRequest, WorkerResponse } from './protocol'
import { parseQasm2 } from '@/core/quantum/qasm2'
import { MAX_QUBITS, probabilitiesDict } from '@/core/quantum/simulate'
import { runQasmSync } from '@/services/backends/LocalSimulatorBackend'
import type { Visual } from '@/services/runtimes/types'
import QIDEA_PY from './python/qidea.py?raw'
import { PROJECT_DIR, cleanTraceback } from './traceback'

declare const self: DedicatedWorkerGlobalScope

let py: PyodideAPI | null = null
let loadedVersion: string | null = null
let lock: RuntimeLock | null = null
let currentId = 0

const post = (msg: WorkerResponse) => self.postMessage(msg)
const progress = (message: string) => post({ id: currentId, type: 'event', event: { type: 'progress', message } })

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const LOCK_PY = `
import sys, json, importlib.metadata as md
pkgs = {}
for name in ("qiskit", "rustworkx", "numpy", "scipy", "dill", "stevedore", "sympy", "typing_extensions"):
    try:
        pkgs[name] = md.version(name)
    except md.PackageNotFoundError:
        pass
import qidea
pkgs["qidea"] = qidea.__version__
json.dumps({"python": sys.version.split()[0], "packages": pkgs})
`

async function load(msg: Extract<WorkerRequest, { type: 'load' }>): Promise<RuntimeLock> {
  if (py && loadedVersion === msg.qiskitVersion && lock) return lock
  // Python packages cannot be unloaded: switching version means a fresh interpreter.
  // The main thread terminates this worker and starts a new one for that.
  if (py) throw new Error(`Qiskit ${loadedVersion} is already loaded in this worker`)

  progress('Starting Python…')
  const { loadPyodide } = (await import(/* @vite-ignore */ `${msg.indexURL}pyodide.mjs`)) as {
    loadPyodide: (o: { indexURL: string }) => Promise<PyodideAPI>
  }
  py = await loadPyodide({ indexURL: msg.indexURL })

  const fromPyodide = Object.keys(msg.entry.pyodidePackages)
  progress(`Loading ${['micropip', ...fromPyodide].join(', ')}…`)
  await py.loadPackage(['micropip', ...fromPyodide], { messageCallback: () => {} })

  progress(`Downloading Qiskit ${msg.qiskitVersion}…`)
  const files = await Promise.all(
    msg.entry.wheels.map(async (name) => {
      const res = await fetch(`${msg.wheelsURL}${name}`)
      if (!res.ok) throw new Error(`Could not download ${name} (HTTP ${res.status})`)
      const bytes = await res.arrayBuffer()
      const expected = msg.entry.sha256[name]
      const actual = await sha256(bytes)
      if (expected && actual !== expected) throw new Error(`Checksum mismatch for ${name}`)
      return { name, bytes }
    }),
  )

  progress('Installing Qiskit…')
  py.FS.mkdirTree('/tmp/wheels')
  for (const f of files) py.FS.writeFile(`/tmp/wheels/${f.name}`, new Uint8Array(f.bytes))
  const micropip = py.pyimport('micropip')
  // deps=False: the dependency set was resolved at build time and pinned in index.json.
  await micropip.install.callKwargs(
    files.map((f) => `emfs:/tmp/wheels/${f.name}`),
    { deps: false },
  )
  micropip.destroy()

  progress('Importing qiskit…')
  installQidea(py)
  await py.runPythonAsync('import qiskit, qidea\nqidea._install_qiskit_hooks()')
  const info = JSON.parse(await py.runPythonAsync(LOCK_PY)) as Omit<RuntimeLock, 'pyodide'>
  lock = { pyodide: py.version, ...info }
  loadedVersion = msg.qiskitVersion
  return lock
}


// Reset the project directory and forget project modules imported by a previous run,
// so edits to any file are picked up and deleted files really disappear.
const PREPARE_PY = `
import os, shutil, sys
root = ${JSON.stringify(PROJECT_DIR)}
for name, mod in list(sys.modules.items()):
    f = getattr(mod, "__file__", None) or ""
    if f.startswith(root + "/"):
        del sys.modules[name]
os.chdir("/")
shutil.rmtree(root, ignore_errors=True)
os.makedirs(root, exist_ok=True)
os.chdir(root)
if root not in sys.path:
    sys.path.insert(0, root)
import importlib
importlib.invalidate_caches()
`

const QIDEA_LIB = '/home/pyodide/qidea_lib'

/**
 * Install the `qidea` Python package and its native bridge. The bridge runs QIDEA's
 * TypeScript simulator inside this worker, so Python calls it synchronously.
 */
function installQidea(py: PyodideAPI) {
  py.registerJsModule('_qidea_native', {
    max_qubits: () => MAX_QUBITS,
    run_qasm: (qasm: string, shots: number, seed: number) =>
      JSON.stringify(runQasmSync(qasm, { shots, seed: seed < 0 ? undefined : seed })),
    /** Exact probabilities (no sampling). Internal: used to cross-check against Qiskit. */
    probabilities: (qasm: string) => JSON.stringify(probabilitiesDict(parseQasm2(qasm))),
    emit: (kind: string, json: string) => {
      const visual = { kind, ...JSON.parse(json) } as Visual
      post({ id: currentId, type: 'event', event: { type: 'visual', visual } })
    },
  })
  py.FS.mkdirTree(QIDEA_LIB)
  py.FS.writeFile(`${QIDEA_LIB}/qidea.py`, QIDEA_PY)
  py.runPython(`import sys\nif ${JSON.stringify(QIDEA_LIB)} not in sys.path: sys.path.append(${JSON.stringify(QIDEA_LIB)})`)
}

async function run(files: Record<string, string>, entry: string) {
  if (!py || !lock) throw new Error('No runtime loaded')
  const id = currentId
  py.setStdout({ batched: (text) => post({ id, type: 'event', event: { type: 'stdout', text } }) })
  py.setStderr({ batched: (text) => post({ id, type: 'event', event: { type: 'stderr', text } }) })
  const started = performance.now()
  try {
    await py.runPythonAsync(PREPARE_PY)
    for (const [path, content] of Object.entries(files)) {
      const full = `${PROJECT_DIR}/${path}`
      py.FS.mkdirTree(full.slice(0, full.lastIndexOf('/')))
      py.FS.writeFile(full, content)
    }
    // Run like `python <entry>`: fresh __main__ namespace, file name in tracebacks.
    const globals = py.toPy({ __name__: '__main__', __file__: `${PROJECT_DIR}/${entry}` })
    await py.runPythonAsync(files[entry] ?? '', { globals, filename: `${PROJECT_DIR}/${entry}` })
    globals.destroy()
    return { ok: true, lock, durationMs: performance.now() - started }
  } catch (err) {
    // Show the traceback relative to the project, the way users see their files.
    const msg = cleanTraceback(String(err instanceof Error ? err.message : err))
    return { ok: false, error: msg, lock, durationMs: performance.now() - started }
  }
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  currentId = msg.id
  try {
    if (msg.type === 'load') post({ id: msg.id, type: 'loaded', lock: await load(msg) })
    else post({ id: msg.id, type: 'ran', outcome: await run(msg.files, msg.entry) })
  } catch (err) {
    post({ id: msg.id, type: 'failed', error: err instanceof Error ? err.message : String(err) })
  }
}
