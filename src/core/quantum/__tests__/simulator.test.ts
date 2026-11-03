import { describe, expect, it } from 'vitest'
import { parseQasm2 } from '../qasm2'
import { finalState, probabilitiesDict, simulate } from '../simulate'

const qasm = (body: string) => parseQasm2(`OPENQASM 2.0;\ninclude "qelib1.inc";\n${body}`)

describe('state-vector simulator', () => {
  it('prepares a Bell state with 50/50 counts on 00 and 11', () => {
    const c = qasm('qreg q[2]; creg c[2]; h q[0]; cx q[0],q[1]; measure q -> c;')
    const { counts } = simulate(c, 4000, 1)
    expect(Object.keys(counts).sort()).toEqual(['00', '11'])
    expect(counts['00'] / 4000).toBeCloseTo(0.5, 1)
  })

  it('uses Qiskit bit order: qubit 0 is the rightmost character', () => {
    const c = qasm('qreg q[3]; creg c[3]; x q[0]; measure q -> c;')
    expect(simulate(c, 10, 1).counts).toEqual({ '001': 10 })
    expect(probabilitiesDict(qasm('qreg q[3]; x q[1];'))).toEqual({ '010': 1 })
  })

  it('formats several classical registers like Qiskit (last register first)', () => {
    const c = qasm('qreg q[2]; creg a[1]; creg b[1]; x q[1]; measure q[0] -> a[0]; measure q[1] -> b[0];')
    expect(simulate(c, 5, 1).counts).toEqual({ '1 0': 5 })
  })

  it('builds a GHZ state', () => {
    const p = probabilitiesDict(qasm('qreg q[4]; h q[0]; cx q[0],q[1]; cx q[1],q[2]; cx q[2],q[3];'))
    expect(Object.keys(p).sort()).toEqual(['0000', '1111'])
    expect(p['0000']).toBeCloseTo(0.5, 12)
  })

  it('applies rotations with the right angles', () => {
    // RY(θ)|0⟩ gives P(1) = sin²(θ/2).
    const p = probabilitiesDict(qasm('qreg q[1]; ry(pi/3) q[0];'))
    expect(p['1']).toBeCloseTo(Math.sin(Math.PI / 6) ** 2, 12)
    // H RZ(π) H = X up to a global phase.
    expect(probabilitiesDict(qasm('qreg q[1]; h q[0]; rz(pi) q[0]; h q[0];'))['1']).toBeCloseTo(1, 12)
    // U(θ,φ,λ) matches RY when φ=λ=0.
    const a = finalState(qasm('qreg q[1]; u(0.7,0,0) q[0];'))
    const b = finalState(qasm('qreg q[1]; ry(0.7) q[0];'))
    expect(Array.from(a.re)).toEqual(Array.from(b.re))
  })

  it('matches equivalent decompositions (cz = h·cx·h, swap = 3 cx, rzz)', () => {
    const viaCz = finalState(qasm('qreg q[2]; h q; cz q[0],q[1]; h q[1];'))
    const viaCx = finalState(qasm('qreg q[2]; h q; h q[1]; cx q[0],q[1]; h q[1]; h q[1];'))
    viaCz.re.forEach((v, i) => expect(v).toBeCloseTo(viaCx.re[i], 12))
    expect(probabilitiesDict(qasm('qreg q[2]; x q[0]; swap q[0],q[1];'))).toEqual({ '10': 1 })
    expect(probabilitiesDict(qasm('qreg q[2]; x q[0]; cx q[0],q[1]; cx q[1],q[0]; cx q[0],q[1];'))).toEqual({ '10': 1 })
    expect(probabilitiesDict(qasm('qreg q[3]; x q[0]; x q[1]; ccx q[0],q[1],q[2];'))).toEqual({ '111': 1 })
  })

  it('handles mid-circuit measurement and reset', () => {
    // Measure, then flip: the second measurement is always the opposite of the first.
    const c = qasm('qreg q[1]; creg c[2]; h q[0]; measure q[0] -> c[0]; x q[0]; measure q[0] -> c[1];')
    const { counts } = simulate(c, 2000, 3)
    expect(Object.keys(counts).sort()).toEqual(['01', '10'])
    const r = qasm('qreg q[1]; creg c[1]; x q[0]; reset q[0]; measure q[0] -> c[0];')
    expect(simulate(r, 50, 1).counts).toEqual({ '0': 50 })
  })

  it('is reproducible with a seed', () => {
    const c = qasm('qreg q[3]; creg c[3]; h q; measure q -> c;')
    expect(simulate(c, 500, 42).counts).toEqual(simulate(c, 500, 42).counts)
  })

  it('refuses circuits larger than the limit', () => {
    expect(() => simulate(qasm('qreg q[30]; creg c[1]; measure q[0] -> c[0];'), 1)).toThrow(/up to 22 qubits/)
  })
})

describe('OpenQASM 2 parser', () => {
  it('parses what qiskit.qasm2.dumps emits, including custom gates', () => {
    const src = `OPENQASM 2.0;
include "qelib1.inc";
gate rzx(param0) q0,q1 { h q1; cx q0,q1; rz(param0) q1; cx q0,q1; h q1; }
gate my_bell q0,q1 { h q0; cx q0,q1; }
qreg q[2];
creg meas[2];
my_bell q[0],q[1];
rzx(-pi/4 + 2*0.5^2) q[0],q[1];
barrier q[0],q[1];
measure q[0] -> meas[0];
measure q[1] -> meas[1];`
    const c = parseQasm2(src)
    expect(c.numQubits).toBe(2)
    expect(c.cregs).toEqual([{ name: 'meas', size: 2 }])
    expect(c.ops.map((o) => o.name)).toEqual(['h', 'cx', 'h', 'cx', 'rz', 'cx', 'h', 'barrier', 'measure', 'measure'])
    expect(c.ops[4].params[0]).toBeCloseTo(-Math.PI / 4 + 0.5, 12)
  })

  it('reports clear errors with line numbers', () => {
    expect(() => parseQasm2('qreg q[1];\nfoo q[0];')).toThrow('OpenQASM line 2: unknown gate "foo"')
    expect(() => parseQasm2('qreg q[1];\nh q[3];')).toThrow(/index 3 out of range/)
    expect(() => parseQasm2('qreg q[1]; creg c[1];\nif(c==1) x q[0];')).toThrow(/not supported/)
    expect(() => parseQasm2('OPENQASM 3.0;')).toThrow(/only OpenQASM 2/)
  })
})
