import { CONTROLLED, SINGLE, X, type Mat2, rz, H } from './gates'

/** n-qubit state vector. Basis index bit k is qubit k (little-endian, as in Qiskit). */
export class StateVector {
  readonly re: Float64Array
  readonly im: Float64Array

  constructor(readonly numQubits: number) {
    const dim = 2 ** numQubits
    this.re = new Float64Array(dim)
    this.im = new Float64Array(dim)
    this.re[0] = 1
  }

  get dim() {
    return this.re.length
  }

  /** Apply a 2×2 matrix to `target`, only where every control qubit is |1⟩. */
  apply(m: Mat2, target: number, controls: number[] = []) {
    const [ar, ai, br, bi, cr, ci, dr, di] = m
    const tbit = 1 << target
    let cmask = 0
    for (const c of controls) cmask |= 1 << c
    const { re, im } = this
    for (let i = 0; i < re.length; i++) {
      if (i & tbit || (i & cmask) !== cmask) continue
      const j = i | tbit
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j]
      re[i] = ar * xr - ai * xi + br * yr - bi * yi
      im[i] = ar * xi + ai * xr + br * yi + bi * yr
      re[j] = cr * xr - ci * xi + dr * yr - di * yi
      im[j] = cr * xi + ci * xr + dr * yi + di * yr
    }
  }

  /** Swap two qubits, optionally controlled. */
  swap(a: number, b: number, controls: number[] = []) {
    const ab = 1 << a, bb = 1 << b
    let cmask = 0
    for (const c of controls) cmask |= 1 << c
    const { re, im } = this
    for (let i = 0; i < re.length; i++) {
      // Visit each |..1_a..0_b..⟩ once and exchange it with |..0_a..1_b..⟩.
      if (!(i & ab) || i & bb || (i & cmask) !== cmask) continue
      const j = (i & ~ab) | bb
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  probabilityOne(q: number): number {
    const bit = 1 << q
    let p = 0
    for (let i = 0; i < this.re.length; i++) if (i & bit) p += this.re[i] ** 2 + this.im[i] ** 2
    return p
  }

  /** Projective measurement of one qubit; collapses the state. */
  measure(q: number, rand: () => number): 0 | 1 {
    const p1 = this.probabilityOne(q)
    const outcome: 0 | 1 = rand() < p1 ? 1 : 0
    const keep = outcome ? p1 : 1 - p1
    const norm = keep > 0 ? 1 / Math.sqrt(keep) : 0
    const bit = 1 << q
    for (let i = 0; i < this.re.length; i++) {
      if (((i & bit) !== 0) === (outcome === 1)) {
        this.re[i] *= norm
        this.im[i] *= norm
      } else {
        this.re[i] = 0
        this.im[i] = 0
      }
    }
    return outcome
  }

  reset(q: number, rand: () => number) {
    if (this.measure(q, rand) === 1) this.apply(X, q)
  }

  probabilities(): Float64Array {
    const p = new Float64Array(this.re.length)
    for (let i = 0; i < p.length; i++) p[i] = this.re[i] ** 2 + this.im[i] ** 2
    return p
  }

  /** Apply a named unitary gate. Throws on unknown names. */
  applyGate(name: string, qubits: number[], params: number[]) {
    const single = SINGLE[name]
    if (single) return this.apply(single(params), qubits[0])
    const controlled = CONTROLLED[name]
    if (controlled) {
      const [n, m] = controlled(params)
      return this.apply(m, qubits[n], qubits.slice(0, n))
    }
    switch (name) {
      case 'swap':
        return this.swap(qubits[0], qubits[1])
      case 'cswap':
      case 'fredkin':
        return this.swap(qubits[1], qubits[2], [qubits[0]])
      case 'rzz': {
        const [a, b] = qubits
        this.apply(X, b, [a])
        this.apply(rz(params[0]), b)
        return this.apply(X, b, [a])
      }
      case 'rxx': {
        const [a, b] = qubits
        this.apply(H, a)
        this.apply(H, b)
        this.applyGate('rzz', qubits, params)
        this.apply(H, a)
        return this.apply(H, b)
      }
      default:
        throw new Error(`Unsupported gate: ${name}`)
    }
  }
}
