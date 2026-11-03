/**
 * OpenQASM 2.0 parser -> Circuit IR.
 *
 * Supports what qiskit.qasm2.dumps() emits: qreg/creg, every qelib1.inc gate, custom
 * `gate` definitions (inlined), parameter expressions, register broadcasting, measure,
 * reset and barrier. Classically-conditioned operations (`if`) are not supported.
 */
import type { Circuit, ClassicalRegister, Op } from './circuit'
import { CONTROLLED, SINGLE } from './gates'

export class QasmError extends Error {
  constructor(message: string, readonly line: number) {
    super(`OpenQASM line ${line}: ${message}`)
  }
}

type Tok = { kind: 'id' | 'num' | 'str' | 'sym'; value: string; line: number }

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  let line = 1
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\n') {
      line++
      i++
    } else if (/\s/.test(ch)) i++
    else if (src.startsWith('//', i)) while (i < src.length && src[i] !== '\n') i++
    else if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2)
      const chunk = src.slice(i, end < 0 ? src.length : end + 2)
      line += chunk.split('\n').length - 1
      i += chunk.length
    } else if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))![0]
      toks.push({ kind: 'id', value: m, line })
      i += m.length
    } else if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))![0]
      toks.push({ kind: 'num', value: m, line })
      i += m.length
    } else if (ch === '"') {
      const end = src.indexOf('"', i + 1)
      toks.push({ kind: 'str', value: src.slice(i + 1, end), line })
      i = end + 1
    } else if (src.startsWith('->', i) || src.startsWith('==', i)) {
      toks.push({ kind: 'sym', value: src.slice(i, i + 2), line })
      i += 2
    } else if ('{}[]();,+-*/^'.includes(ch)) {
      toks.push({ kind: 'sym', value: ch, line })
      i++
    } else throw new QasmError(`unexpected character "${ch}"`, line)
  }
  return toks
}

/** Parameter expression AST, evaluated with the gate's parameter bindings. */
type Expr = (env: Record<string, number>) => number

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  ln: Math.log,
  sqrt: Math.sqrt,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
}

interface GateDef {
  params: string[]
  qargs: string[]
  body: { name: string; params: Expr[]; args: string[]; line: number }[]
}

class Parser {
  private pos = 0
  private qregs = new Map<string, { offset: number; size: number }>()
  private cregs = new Map<string, { offset: number; size: number }>()
  private cregList: ClassicalRegister[] = []
  private numQubits = 0
  private numClbits = 0
  private gates = new Map<string, GateDef>()
  private ops: Op[] = []

  constructor(private toks: Tok[]) {}

  private peek(o = 0) {
    return this.toks[this.pos + o]
  }
  private line() {
    return (this.peek() ?? this.toks[this.toks.length - 1])?.line ?? 1
  }
  private next(): Tok {
    const t = this.toks[this.pos++]
    if (!t) throw new QasmError('unexpected end of program', this.line())
    return t
  }
  private accept(value: string) {
    if (this.peek()?.value === value) {
      this.pos++
      return true
    }
    return false
  }
  private expect(value: string) {
    const t = this.next()
    if (t.value !== value) throw new QasmError(`expected "${value}" but found "${t.value}"`, t.line)
  }
  private ident(): string {
    const t = this.next()
    if (t.kind !== 'id') throw new QasmError(`expected a name but found "${t.value}"`, t.line)
    return t.value
  }
  private int(): number {
    const t = this.next()
    if (t.kind !== 'num' || !/^\d+$/.test(t.value)) throw new QasmError(`expected an integer but found "${t.value}"`, t.line)
    return Number(t.value)
  }

  // expr := term (('+'|'-') term)* ; term := power (('*'|'/') power)* ; power := unary ('^' power)?
  private expr(): Expr {
    let left = this.term()
    while (this.peek()?.value === '+' || this.peek()?.value === '-') {
      const op = this.next().value
      const l = left, r = this.term()
      left = op === '+' ? (e) => l(e) + r(e) : (e) => l(e) - r(e)
    }
    return left
  }
  private term(): Expr {
    let left = this.power()
    while (this.peek()?.value === '*' || this.peek()?.value === '/') {
      const op = this.next().value
      const l = left, r = this.power()
      left = op === '*' ? (e) => l(e) * r(e) : (e) => l(e) / r(e)
    }
    return left
  }
  private power(): Expr {
    const base = this.unary()
    if (this.accept('^')) {
      const exp = this.power()
      return (e) => base(e) ** exp(e)
    }
    return base
  }
  private unary(): Expr {
    if (this.accept('-')) {
      const x = this.unary()
      return (e) => -x(e)
    }
    if (this.accept('+')) return this.unary()
    const t = this.next()
    if (t.kind === 'num') {
      const v = Number(t.value)
      return () => v
    }
    if (t.value === '(') {
      const x = this.expr()
      this.expect(')')
      return x
    }
    if (t.kind === 'id') {
      if (t.value === 'pi') return () => Math.PI
      const fn = FUNCS[t.value]
      if (fn) {
        this.expect('(')
        const x = this.expr()
        this.expect(')')
        return (e) => fn(x(e))
      }
      const name = t.value
      return (e) => {
        if (!(name in e)) throw new QasmError(`unknown parameter "${name}"`, t.line)
        return e[name]
      }
    }
    throw new QasmError(`unexpected "${t.value}" in expression`, t.line)
  }

  private exprList(): Expr[] {
    const list: Expr[] = []
    if (this.accept('(')) {
      if (!this.accept(')')) {
        do list.push(this.expr())
        while (this.accept(','))
        this.expect(')')
      }
    }
    return list
  }

  /** A register or an indexed bit: returns global indices (one, or the whole register). */
  private argument(kind: 'q' | 'c'): number[] {
    const t = this.peek()
    const name = this.ident()
    const reg = (kind === 'q' ? this.qregs : this.cregs).get(name)
    if (!reg) throw new QasmError(`unknown ${kind === 'q' ? 'quantum' : 'classical'} register "${name}"`, t.line)
    if (this.accept('[')) {
      const i = this.int()
      this.expect(']')
      if (i >= reg.size) throw new QasmError(`index ${i} out of range for "${name}"[${reg.size}]`, t.line)
      return [reg.offset + i]
    }
    return Array.from({ length: reg.size }, (_, i) => reg.offset + i)
  }

  /** Expand register broadcasting: h q; cx a, b (same-size registers). */
  private broadcast(args: number[][], line: number): number[][] {
    const sizes = args.filter((a) => a.length > 1).map((a) => a.length)
    const n = sizes.length ? sizes[0] : 1
    if (sizes.some((s) => s !== n)) throw new QasmError('registers in one statement must have the same size', line)
    return Array.from({ length: n }, (_, k) => args.map((a) => (a.length === 1 ? a[0] : a[k])))
  }

  private emitGate(name: string, params: number[], qubits: number[], line: number, depth = 0) {
    if (depth > 64) throw new QasmError(`gate "${name}" is defined recursively`, line)
    const def = this.gates.get(name)
    if (def) {
      if (params.length !== def.params.length || qubits.length !== def.qargs.length) {
        throw new QasmError(`gate "${name}" expects ${def.params.length} parameters and ${def.qargs.length} qubits`, line)
      }
      const env = Object.fromEntries(def.params.map((p, i) => [p, params[i]]))
      const qmap = Object.fromEntries(def.qargs.map((q, i) => [q, qubits[i]]))
      for (const g of def.body) {
        if (g.name === 'barrier') continue
        this.emitGate(g.name, g.params.map((p) => p(env)), g.args.map((a) => qmap[a]), g.line, depth + 1)
      }
      return
    }
    if (!SINGLE[name] && !CONTROLLED[name] && !['swap', 'cswap', 'rxx', 'rzz'].includes(name)) {
      throw new QasmError(`unknown gate "${name}"`, line)
    }
    if (new Set(qubits).size !== qubits.length) throw new QasmError(`gate "${name}" uses the same qubit twice`, line)
    this.ops.push({ name, qubits, params })
  }

  private gateDefinition() {
    const name = this.ident()
    const params: string[] = []
    if (this.accept('(')) {
      if (!this.accept(')')) {
        do params.push(this.ident())
        while (this.accept(','))
        this.expect(')')
      }
    }
    const qargs: string[] = []
    do qargs.push(this.ident())
    while (this.accept(','))
    this.expect('{')
    const body: GateDef['body'] = []
    while (!this.accept('}')) {
      const line = this.line()
      const g = this.ident()
      const ps = g === 'barrier' ? [] : this.exprList()
      const args: string[] = []
      do args.push(this.ident())
      while (this.accept(','))
      this.expect(';')
      body.push({ name: g, params: ps, args, line })
    }
    this.gates.set(name, { params, qargs, body })
  }

  parse(): Circuit {
    if (this.peek()?.value === 'OPENQASM') {
      this.next()
      const v = this.next()
      if (!v.value.startsWith('2')) throw new QasmError(`only OpenQASM 2 is supported (found ${v.value})`, v.line)
      this.expect(';')
    }
    while (this.peek()) {
      const t = this.next()
      const line = t.line
      switch (t.value) {
        case 'include':
          this.next()
          this.expect(';')
          break
        case 'qreg':
        case 'creg': {
          const name = this.ident()
          this.expect('[')
          const size = this.int()
          this.expect(']')
          this.expect(';')
          if (t.value === 'qreg') {
            this.qregs.set(name, { offset: this.numQubits, size })
            this.numQubits += size
          } else {
            this.cregs.set(name, { offset: this.numClbits, size })
            this.cregList.push({ name, size })
            this.numClbits += size
          }
          break
        }
        case 'gate':
          this.gateDefinition()
          break
        case 'opaque':
          throw new QasmError('opaque gates cannot be simulated', line)
        case 'if':
          throw new QasmError('classically-conditioned operations (if) are not supported yet', line)
        case 'measure': {
          const q = this.argument('q')
          this.expect('->')
          const c = this.argument('c')
          this.expect(';')
          if (q.length !== c.length) throw new QasmError('measure needs registers of the same size', line)
          q.forEach((qi, k) => this.ops.push({ name: 'measure', qubits: [qi], clbits: [c[k]], params: [] }))
          break
        }
        case 'reset': {
          const q = this.argument('q')
          this.expect(';')
          q.forEach((qi) => this.ops.push({ name: 'reset', qubits: [qi], params: [] }))
          break
        }
        case 'barrier': {
          const qs: number[] = []
          do qs.push(...this.argument('q'))
          while (this.accept(','))
          this.expect(';')
          this.ops.push({ name: 'barrier', qubits: qs, params: [] })
          break
        }
        default: {
          if (t.kind !== 'id') throw new QasmError(`unexpected "${t.value}"`, line)
          const params = this.exprList().map((e) => e({}))
          const args: number[][] = []
          do args.push(this.argument('q'))
          while (this.accept(','))
          this.expect(';')
          for (const qubits of this.broadcast(args, line)) this.emitGate(t.value, params, qubits, line)
        }
      }
    }
    return { numQubits: this.numQubits, cregs: this.cregList, ops: this.ops }
  }
}

export function parseQasm2(source: string): Circuit {
  return new Parser(tokenize(source)).parse()
}
