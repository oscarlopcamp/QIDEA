/**
 * Quantum backend contract. v1 ships only simulators; real hardware (IBM Quantum, ...)
 * implements this same interface later. Credentials are always supplied by the user's own
 * project code, never stored by QIDEA.
 */

export interface BackendCapabilities {
  maxQubits: number
  /** Can return the full state vector (simulators only). */
  statevector: boolean
  /** Runs on real quantum hardware. */
  hardware: boolean
}

export interface BackendRunOptions {
  shots: number
  seed?: number
}

export interface BackendResult {
  counts: Record<string, number>
  shots: number
  /** Amplitudes as [re, im] pairs, when the backend supports it. */
  statevector?: [number, number][]
  durationMs: number
}

export interface QuantumBackend {
  id: string
  name: string
  capabilities: BackendCapabilities
  /** Run an OpenQASM 2/3 program. */
  run(qasm: string, options: BackendRunOptions): Promise<BackendResult>
}
