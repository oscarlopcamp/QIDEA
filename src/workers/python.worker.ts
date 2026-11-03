/// <reference lib="webworker" />
import type { PyodideAPI } from 'pyodide'
import type { RuntimeLock } from '@/services/runtimes/types'
import type { WorkerRequest, WorkerResponse } from './protocol'

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
  await py.runPythonAsync('import qiskit')
  const info = JSON.parse(await py.runPythonAsync(LOCK_PY)) as Omit<RuntimeLock, 'pyodide'>
  lock = { pyodide: py.version, ...info }
  loadedVersion = msg.qiskitVersion
  return lock
}

async function run(code: string) {
  if (!py || !lock) throw new Error('No runtime loaded')
  const id = currentId
  py.setStdout({ batched: (text) => post({ id, type: 'event', event: { type: 'stdout', text } }) })
  py.setStderr({ batched: (text) => post({ id, type: 'event', event: { type: 'stderr', text } }) })
  const started = performance.now()
  try {
    // Each run gets a fresh namespace so state does not leak between runs.
    const globals = py.toPy({})
    await py.runPythonAsync(code, { globals })
    globals.destroy()
    return { ok: true, lock, durationMs: performance.now() - started }
  } catch (err) {
    return { ok: false, error: String(err), lock, durationMs: performance.now() - started }
  }
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  currentId = msg.id
  try {
    if (msg.type === 'load') post({ id: msg.id, type: 'loaded', lock: await load(msg) })
    else post({ id: msg.id, type: 'ran', outcome: await run(msg.code) })
  } catch (err) {
    post({ id: msg.id, type: 'failed', error: err instanceof Error ? err.message : String(err) })
  }
}
