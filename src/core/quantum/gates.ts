/** 2×2 complex matrices as [re00, im00, re01, im01, re10, im10, re11, im11]. */
export type Mat2 = [number, number, number, number, number, number, number, number]

const { cos, sin, SQRT1_2 } = Math

const cis = (a: number): [number, number] => [cos(a), sin(a)]

export function u(theta: number, phi: number, lambda: number): Mat2 {
  const c = cos(theta / 2)
  const s = sin(theta / 2)
  const [pr, pi] = cis(phi)
  const [lr, li] = cis(lambda)
  const [plr, pli] = cis(phi + lambda)
  return [c, 0, -lr * s, -li * s, pr * s, pi * s, plr * c, pli * c]
}

export const rx = (t: number): Mat2 => [cos(t / 2), 0, 0, -sin(t / 2), 0, -sin(t / 2), cos(t / 2), 0]
export const ry = (t: number): Mat2 => [cos(t / 2), 0, -sin(t / 2), 0, sin(t / 2), 0, cos(t / 2), 0]
export const rz = (t: number): Mat2 => [cos(t / 2), -sin(t / 2), 0, 0, 0, 0, cos(t / 2), sin(t / 2)]
export const phase = (l: number): Mat2 => [1, 0, 0, 0, 0, 0, cos(l), sin(l)]

export const I: Mat2 = [1, 0, 0, 0, 0, 0, 1, 0]
export const X: Mat2 = [0, 0, 1, 0, 1, 0, 0, 0]
export const Y: Mat2 = [0, 0, 0, -1, 0, 1, 0, 0]
export const Z: Mat2 = [1, 0, 0, 0, 0, 0, -1, 0]
export const H: Mat2 = [SQRT1_2, 0, SQRT1_2, 0, SQRT1_2, 0, -SQRT1_2, 0]
export const S = phase(Math.PI / 2)
export const SDG = phase(-Math.PI / 2)
export const T = phase(Math.PI / 4)
export const TDG = phase(-Math.PI / 4)
export const SX: Mat2 = [0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5]
export const SXDG: Mat2 = [0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5]

/** Multiply a matrix by a global phase e^{iγ}. */
export function withPhase(m: Mat2, gamma: number): Mat2 {
  const [c, s] = cis(gamma)
  const out = [...m] as Mat2
  for (let i = 0; i < 8; i += 2) {
    out[i] = m[i] * c - m[i + 1] * s
    out[i + 1] = m[i] * s + m[i + 1] * c
  }
  return out
}

/** Single-qubit gates by name, given their parameters. */
export const SINGLE: Record<string, (p: number[]) => Mat2> = {
  id: () => I,
  u0: () => I,
  x: () => X,
  y: () => Y,
  z: () => Z,
  h: () => H,
  s: () => S,
  sdg: () => SDG,
  t: () => T,
  tdg: () => TDG,
  sx: () => SX,
  sxdg: () => SXDG,
  rx: ([t]) => rx(t),
  ry: ([t]) => ry(t),
  rz: ([t]) => rz(t),
  p: ([l]) => phase(l),
  u1: ([l]) => phase(l),
  u2: ([p, l]) => u(Math.PI / 2, p, l),
  u3: ([t, p, l]) => u(t, p, l),
  u: ([t, p, l]) => u(t, p, l),
}

/** Controlled gates: name -> [number of controls, target matrix]. */
export const CONTROLLED: Record<string, (p: number[]) => [number, Mat2]> = {
  cx: () => [1, X],
  cnot: () => [1, X],
  cy: () => [1, Y],
  cz: () => [1, Z],
  ch: () => [1, H],
  csx: () => [1, SX],
  crx: ([t]) => [1, rx(t)],
  cry: ([t]) => [1, ry(t)],
  crz: ([t]) => [1, rz(t)],
  cp: ([l]) => [1, phase(l)],
  cu1: ([l]) => [1, phase(l)],
  cu3: ([t, p, l]) => [1, u(t, p, l)],
  // Qiskit's cu(θ, φ, λ, γ) also applies phase γ on the control-|1⟩ subspace.
  cu: ([t, p, l, g]) => [1, withPhase(u(t, p, l), g ?? 0)],
  ccx: () => [2, X],
  toffoli: () => [2, X],
  ccz: () => [2, Z],
}
