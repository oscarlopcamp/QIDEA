import { parseQasm2 } from '@/core/quantum/qasm2'
import { MAX_QUBITS, simulate } from '@/core/quantum/simulate'
import type { BackendResult, BackendRunOptions, QuantumBackend } from './types'

/** QIDEA's state-vector simulator, running in the browser. */
export class LocalSimulatorBackend implements QuantumBackend {
  readonly id = 'local_simulator'
  readonly name = 'Local simulator'
  readonly capabilities = { maxQubits: MAX_QUBITS, statevector: true, hardware: false }

  async run(qasm: string, options: BackendRunOptions): Promise<BackendResult> {
    return runQasmSync(qasm, options)
  }
}

/** Synchronous variant, used where an await is not possible (the Python bridge). */
export function runQasmSync(qasm: string, { shots, seed }: BackendRunOptions): BackendResult {
  const started = performance.now()
  const circuit = parseQasm2(qasm)
  const { counts } = simulate(circuit, shots, seed)
  return { counts, shots, durationMs: performance.now() - started }
}
