import { numClbits, type Circuit } from './circuit'
import { createRng } from './rng'
import { StateVector } from './statevector'

export const MAX_QUBITS = 22

export interface SimulationResult {
  counts: Record<string, number>
  shots: number
}

const IGNORED = new Set(['barrier', 'delay'])

/**
 * Can we simulate once and sample? True when every measurement is terminal
 * (nothing touches the qubit afterwards) and there are no resets.
 */
export function hasOnlyTerminalMeasurements(circuit: Circuit): boolean {
  const measured = new Set<number>()
  for (const op of circuit.ops) {
    if (IGNORED.has(op.name)) continue
    if (op.name === 'reset') return false
    if (op.qubits.some((q) => measured.has(q))) return false
    if (op.name === 'measure') op.qubits.forEach((q) => measured.add(q))
  }
  return true
}

function checkSize(circuit: Circuit) {
  if (circuit.numQubits > MAX_QUBITS) {
    throw new Error(`The local simulator supports up to ${MAX_QUBITS} qubits (this circuit has ${circuit.numQubits})`)
  }
}

/** Final state, ignoring measurements. For circuits without mid-circuit measurement or reset. */
export function finalState(circuit: Circuit): StateVector {
  checkSize(circuit)
  const sv = new StateVector(circuit.numQubits)
  for (const op of circuit.ops) {
    if (IGNORED.has(op.name) || op.name === 'measure') continue
    if (op.name === 'reset') throw new Error('finalState() does not support reset')
    sv.applyGate(op.name, op.qubits, op.params)
  }
  return sv
}

/**
 * Format classical bits like Qiskit's get_counts(): each register big-endian,
 * registers separated by a space, last-declared register first.
 */
function formatter(circuit: Circuit): (bits: Uint8Array) => string {
  const regs: [number, number][] = []
  let offset = 0
  for (const r of circuit.cregs) {
    regs.push([offset, r.size])
    offset += r.size
  }
  return (bits) =>
    regs
      .map(([start, size]) => {
        let s = ''
        for (let i = size - 1; i >= 0; i--) s += bits[start + i]
        return s
      })
      .reverse()
      .join(' ')
}

export function simulate(circuit: Circuit, shots: number, seed?: number): SimulationResult {
  checkSize(circuit)
  if (!Number.isInteger(shots) || shots < 1) throw new Error('shots must be a positive integer')
  const rand = createRng(seed)
  const nClbits = numClbits(circuit)
  const format = formatter(circuit)
  const counts: Record<string, number> = {}
  const add = (key: string) => (counts[key] = (counts[key] ?? 0) + 1)

  if (hasOnlyTerminalMeasurements(circuit)) {
    // Simulate once, then sample measured qubits from the final distribution.
    const probs = finalState(circuit).probabilities()
    const cumulative = new Float64Array(probs.length)
    let acc = 0
    for (let i = 0; i < probs.length; i++) cumulative[i] = acc += probs[i]
    const map: [number, number][] = [] // [qubit, clbit], later measurements overwrite earlier ones
    for (const op of circuit.ops) {
      if (op.name === 'measure') op.qubits.forEach((q, k) => map.push([q, op.clbits![k]]))
    }
    const bits = new Uint8Array(nClbits)
    for (let s = 0; s < shots; s++) {
      const r = rand() * acc
      let lo = 0, hi = cumulative.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cumulative[mid] > r) hi = mid
        else lo = mid + 1
      }
      bits.fill(0)
      for (const [q, c] of map) bits[c] = (lo >> q) & 1
      add(format(bits))
    }
    return { counts, shots }
  }

  // Mid-circuit measurement or reset: simulate every shot.
  const bits = new Uint8Array(nClbits)
  for (let s = 0; s < shots; s++) {
    const sv = new StateVector(circuit.numQubits)
    bits.fill(0)
    for (const op of circuit.ops) {
      if (IGNORED.has(op.name)) continue
      if (op.name === 'measure') op.qubits.forEach((q, k) => (bits[op.clbits![k]] = sv.measure(q, rand)))
      else if (op.name === 'reset') op.qubits.forEach((q) => sv.reset(q, rand))
      else sv.applyGate(op.name, op.qubits, op.params)
    }
    add(format(bits))
  }
  return { counts, shots }
}

/** Exact outcome probabilities of all qubits, keyed like Qiskit's Statevector.probabilities_dict(). */
export function probabilitiesDict(circuit: Circuit, threshold = 1e-12): Record<string, number> {
  const probs = finalState(circuit).probabilities()
  const out: Record<string, number> = {}
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > threshold) out[i.toString(2).padStart(circuit.numQubits, '0')] = probs[i]
  }
  return out
}
