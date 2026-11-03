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

/** Structured output from user code (qidea.show_counts, show_circuit, plot_histogram, ...). */
export type Visual =
  | { kind: 'histogram'; title: string; counts: Record<string, number> }
  | { kind: 'circuit'; title: string; circuit: CircuitView }

/** A circuit as reported by Qiskit (high-level gates, parameters may be symbolic). */
export interface CircuitView {
  name: string
  qubits: string[]
  clbits: string[]
  ops: { name: string; qubits: number[]; clbits: number[]; params: (number | string)[] }[]
}

export type RuntimeEvent =
  | { type: 'progress'; message: string }
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'visual'; visual: Visual }

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
  /** Run `entry` (a project-relative path) with every project file importable. */
  run(files: Record<string, string>, entry: string, onEvent: (e: RuntimeEvent) => void): Promise<RunOutcome>
}
