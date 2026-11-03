/**
 * Circuit intermediate representation (IR).
 * Qubit and clbit indices are global and 0-based. Conventions match Qiskit: in a measured
 * bitstring, clbit 0 is the rightmost character.
 */

export interface Op {
  /** Lower-case gate name (`h`, `cx`, `rz`, `measure`, `barrier`, `reset`, ...). */
  name: string
  qubits: number[]
  /** Numeric parameters (radians). */
  params: number[]
  /** Target clbits, for `measure`. */
  clbits?: number[]
}

export interface ClassicalRegister {
  name: string
  size: number
}

export interface Circuit {
  numQubits: number
  /** Classical registers in declaration order; clbit indices run through them in that order. */
  cregs: ClassicalRegister[]
  ops: Op[]
}

export const numClbits = (c: Circuit) => c.cregs.reduce((n, r) => n + r.size, 0)
