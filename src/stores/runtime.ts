import { create } from 'zustand'
import { host } from '@/extensions'
import { BELL_CHECK } from '@/services/runtimes/samples'
import type { RuntimeEvent, RuntimeLock, RuntimePhase, RuntimeProvider } from '@/services/runtimes/types'

export type OutputKind = 'info' | 'stdout' | 'stderr' | 'error' | 'success'
export interface OutputLine {
  id: number
  kind: OutputKind
  text: string
}

/** The Python runtime, contributed by the `qidea.python-runtime` extension. */
const RUNTIME_ID = 'pyodide'
function runtime(): RuntimeProvider {
  const r = host.find('runtimes', RUNTIME_ID)
  if (!r) throw new Error('No Python runtime is installed (extension qidea.python-runtime)')
  return r
}
let lineId = 0

interface RuntimeState {
  phase: RuntimePhase
  versions: string[]
  selected: string | null
  loadedVersion: string | null
  lock: RuntimeLock | null
  progress: string | null
  output: OutputLine[]
  init: () => Promise<void>
  select: (version: string) => void
  ensureLoaded: () => Promise<boolean>
  runCheck: () => Promise<void>
  /** Run `entry` with the given project files. Loads the selected Qiskit version first if needed. */
  runFiles: (files: Record<string, string>, entry: string) => Promise<void>
  clearOutput: () => void
}

export const useRuntime = create<RuntimeState>((set, get) => {
  const print = (kind: OutputKind, text: string) =>
    set((s) => ({ output: [...s.output, { id: lineId++, kind, text }] }))

  const onEvent = (e: RuntimeEvent) => {
    if (e.type === 'progress') {
      set({ progress: e.message })
      print('info', e.message)
    } else print(e.type, e.text)
  }

  return {
    phase: 'idle',
    versions: [],
    selected: null,
    loadedVersion: null,
    lock: null,
    progress: null,
    output: [],

    init: async () => {
      try {
        const { versions, default: def } = await runtime().listVersions()
        set({ versions, selected: get().selected ?? def })
      } catch (err) {
        print('error', (err as Error).message)
      }
    },

    select: (version) => set({ selected: version }),

    ensureLoaded: async () => {
      const { selected, loadedVersion } = get()
      if (!selected) return false
      if (loadedVersion === selected) return true
      set({ phase: 'loading', progress: null })
      const started = performance.now()
      try {
        const lock = await runtime().load(selected, onEvent)
        const secs = ((performance.now() - started) / 1000).toFixed(1)
        set({ phase: 'ready', loadedVersion: selected, lock, progress: null })
        print('success', `Qiskit ${lock.packages.qiskit} ready in ${secs}s (Python ${lock.python}, Pyodide ${lock.pyodide})`)
        return true
      } catch (err) {
        set({ phase: 'error', progress: null })
        print('error', (err as Error).message)
        return false
      }
    },

    runCheck: () => get().runFiles({ 'bell_check.py': BELL_CHECK }, 'bell_check.py'),

    runFiles: async (files, entry) => {
      if (get().phase === 'running') return
      if (!(await get().ensureLoaded())) return
      set({ phase: 'running' })
      print('info', `$ python ${entry}`)
      try {
        const outcome = await runtime().run(files, entry, onEvent)
        if (outcome.ok) {
          const pkgs = Object.entries(outcome.lock.packages)
            .map(([k, v]) => `${k} ${v}`)
            .join(', ')
          print('success', `Finished in ${Math.round(outcome.durationMs)} ms. Runtime: ${pkgs}`)
        } else print('error', outcome.error ?? 'Run failed')
      } catch (err) {
        print('error', (err as Error).message)
      } finally {
        set({ phase: 'ready' })
      }
    },

    clearOutput: () => set({ output: [] }),
  }
})
