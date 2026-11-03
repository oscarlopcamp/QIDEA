/**
 * Runtime contracts. A runtime is a versioned Python environment (Pyodide + Qiskit + deps).
 * Today it runs in a browser Web Worker; a future server implementation can satisfy the
 * same `RuntimeProvider` interface.
 */

/** One selectable Qiskit version, as published in public/runtimes/index.json. */
export interface QiskitRuntimeEntry {
  /** Wheel file names under runtimes/wheels/, dependencies first, Qiskit last. */
  wheels: string[]
  /** Packages loaded from Pyodide's own distribution, with the version Pyodide ships. */
  pyodidePackages: Record<string, string>
  sha256: Record<string, string>
}

export interface RuntimeIndex {
  schemaVersion: 1
  pyodide: { version: string; indexURL: string }
  default: string
  qiskit: Record<string, QiskitRuntimeEntry>
}

/**
 * Exact versions a run used. Written to qidea.lock on the first successful hybrid run
 * and stored in every RunRecord, so a run can be reproduced later.
 */
export interface RuntimeLock {
  pyodide: string
  python: string
  packages: Record<string, string>
}

export type RuntimePhase = 'idle' | 'loading' | 'ready' | 'running' | 'error'

export type RuntimeEvent =
  | { type: 'progress'; message: string }
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }

export interface RunOutcome {
  ok: boolean
  error?: string
  lock: RuntimeLock
  durationMs: number
}

export interface RuntimeProvider {
  readonly id: string
  listVersions(): Promise<{ versions: string[]; default: string }>
  /** Load (or switch to) a Qiskit version. Resolves with the exact environment. */
  load(qiskitVersion: string, onEvent: (e: RuntimeEvent) => void): Promise<RuntimeLock>
  run(code: string, onEvent: (e: RuntimeEvent) => void): Promise<RunOutcome>
}
