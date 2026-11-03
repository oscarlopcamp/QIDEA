import type { WorkerRequest, WorkerRequestBody, WorkerResponse } from '@/workers/protocol'
import type { RuntimeEvent, RuntimeIndex, RuntimeLock, RuntimeProvider, RunOutcome } from './types'

type Pending = {
  resolve: (v: never) => void
  reject: (e: Error) => void
  onEvent: (e: RuntimeEvent) => void
}

/** Qiskit in Pyodide, in a dedicated Web Worker. Wheels are served from this site. */
export class PyodideRuntime implements RuntimeProvider {
  readonly id = 'pyodide'
  private worker: Worker | null = null
  private loadedVersion: string | null = null
  private index: Promise<RuntimeIndex> | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor(private readonly baseURL: string = import.meta.env.BASE_URL) {}

  private getIndex(): Promise<RuntimeIndex> {
    this.index ??= fetch(`${this.baseURL}runtimes/index.json`, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`No Qiskit runtimes published (runtimes/index.json: HTTP ${r.status})`)
      return r.json() as Promise<RuntimeIndex>
    })
    return this.index
  }

  async listVersions() {
    const idx = await this.getIndex()
    return { versions: Object.keys(idx.qiskit), default: idx.default }
  }

  private spawn(): Worker {
    const w = new Worker(new URL('../../workers/python.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data
      const p = this.pending.get(msg.id)
      if (!p) return
      if (msg.type === 'event') return p.onEvent(msg.event)
      this.pending.delete(msg.id)
      if (msg.type === 'failed') p.reject(new Error(msg.error))
      else p.resolve((msg.type === 'loaded' ? msg.lock : msg.outcome) as never)
    }
    w.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'Python worker crashed'))
      this.pending.clear()
    }
    return w
  }

  private request<T>(req: WorkerRequestBody, onEvent: (e: RuntimeEvent) => void): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: never) => void, reject, onEvent })
      this.worker!.postMessage({ ...req, id } as WorkerRequest)
    })
  }

  async load(qiskitVersion: string, onEvent: (e: RuntimeEvent) => void): Promise<RuntimeLock> {
    const idx = await this.getIndex()
    const entry = idx.qiskit[qiskitVersion]
    if (!entry) throw new Error(`Qiskit ${qiskitVersion} is not available`)
    // A Python interpreter cannot unload packages, so a version switch needs a new worker.
    if (this.worker && this.loadedVersion !== qiskitVersion) {
      this.worker.terminate()
      this.worker = null
    }
    this.worker ??= this.spawn()
    const lock = await this.request<RuntimeLock>(
      {
        type: 'load',
        indexURL: idx.pyodide.indexURL,
        wheelsURL: new URL(`${this.baseURL}runtimes/wheels/`, location.href).href,
        qiskitVersion,
        entry,
      },
      onEvent,
    )
    this.loadedVersion = qiskitVersion
    return lock
  }

  run(files: Record<string, string>, entry: string, onEvent: (e: RuntimeEvent) => void): Promise<RunOutcome> {
    if (!this.worker) return Promise.reject(new Error('Load a Qiskit version first'))
    return this.request<RunOutcome>({ type: 'run', files, entry }, onEvent)
  }
}
