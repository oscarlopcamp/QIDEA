import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CircuitView } from '@/services/runtimes/types'

const ROW = 46
const TOP = 22
const LEFT = 64
const BOX_H = 30
const CHAR_W = 7.4
const PAD = 14

/** Gate label shown inside boxes. */
const LABEL: Record<string, string> = {
  h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', sdg: 'S†', t: 'T', tdg: 'T†', sx: '√X', sxdg: '√X†',
  id: 'I', rx: 'Rx', ry: 'Ry', rz: 'Rz', p: 'P', u: 'U', u1: 'U1', u2: 'U2', u3: 'U3', r: 'R',
  reset: '|0⟩', rzz: 'Rzz', rxx: 'Rxx', ryy: 'Ryy', rzx: 'Rzx', ecr: 'ECR', iswap: 'iSwap',
  dcx: 'DCX', unitary: 'U', initialize: 'Init', delay: 'Delay',
}

/** Controlled gates: name -> [number of controls, base gate drawn on the target]. */
const CONTROLLED: Record<string, [number, string]> = {
  cx: [1, 'x'], cy: [1, 'y'], cz: [1, 'z'], ch: [1, 'h'], csx: [1, 'sx'], crx: [1, 'rx'], cry: [1, 'ry'],
  crz: [1, 'rz'], cp: [1, 'p'], cu1: [1, 'u1'], cu3: [1, 'u3'], cu: [1, 'u'], ccx: [2, 'x'], ccz: [2, 'z'],
  cswap: [1, 'swap'], cs: [1, 's'], csdg: [1, 'sdg'],
}

/** Show angles as multiples of π when they are simple fractions. */
export function formatParam(p: number | string): string {
  if (typeof p === 'string') return p
  if (Math.abs(p) < 1e-10) return '0'
  const r = p / Math.PI
  for (const den of [1, 2, 3, 4, 6, 8, 12, 16]) {
    const num = Math.round(r * den)
    if (num !== 0 && Math.abs(r * den - num) < 1e-8) {
      const sign = num < 0 ? '-' : ''
      const n = Math.abs(num)
      return `${sign}${n === 1 ? '' : n}π${den === 1 ? '' : `/${den}`}`
    }
  }
  return Number(p.toFixed(3)).toString()
}

type Shape =
  | { kind: 'box'; rows: number[]; label: string; w: number }
  | { kind: 'controlled'; controls: number[]; targets: number[]; base: string; label: string; w: number }
  | { kind: 'swap'; rows: number[]; controls: number[]; w: number }
  | { kind: 'measure'; row: number; clbit: number; w: number }
  | { kind: 'barrier'; rows: number[]; w: number }

function shapeFor(op: CircuitView['ops'][number]): Shape {
  const params = op.params.length ? `(${op.params.map(formatParam).join(', ')})` : ''
  const width = (text: string) => Math.max(BOX_H, text.length * CHAR_W + 16)
  if (op.name === 'measure') return { kind: 'measure', row: op.qubits[0], clbit: op.clbits[0], w: BOX_H }
  if (op.name === 'barrier') return { kind: 'barrier', rows: op.qubits, w: 12 }
  if (op.name === 'swap') return { kind: 'swap', rows: op.qubits, controls: [], w: BOX_H }
  const c = CONTROLLED[op.name] ?? (op.name === 'mcx' ? [op.qubits.length - 1, 'x'] : null)
  if (c) {
    const [n, base] = c as [number, string]
    const controls = op.qubits.slice(0, n)
    const targets = op.qubits.slice(n)
    if (base === 'swap') return { kind: 'swap', rows: targets, controls, w: BOX_H }
    const label = `${LABEL[base] ?? base.toUpperCase()}${params}`
    return { kind: 'controlled', controls, targets, base, label, w: base === 'x' || base === 'z' ? BOX_H : width(label) }
  }
  const label = `${LABEL[op.name] ?? op.name}${params}`
  return { kind: 'box', rows: op.qubits, label, w: width(label) }
}

export function CircuitDiagram({ circuit }: { circuit: CircuitView }) {
  const { t } = useTranslation()
  const nq = circuit.qubits.length
  const hasC = circuit.clbits.length > 0
  const cRow = nq // the bundled classical wire

  const layout = useMemo(() => {
    const level = new Array(nq + 1).fill(0)
    const placed: { shape: Shape; col: number }[] = []
    for (const op of circuit.ops) {
      const shape = shapeFor(op)
      const rows =
        shape.kind === 'measure'
          ? [shape.row, cRow]
          : shape.kind === 'controlled'
            ? [...shape.controls, ...shape.targets]
            : shape.kind === 'swap'
              ? [...shape.rows, ...shape.controls]
              : shape.rows
      const lo = Math.min(...rows)
      const hi = shape.kind === 'measure' ? cRow : Math.max(...rows)
      let col = 0
      for (let r = lo; r <= hi; r++) col = Math.max(col, level[r])
      for (let r = lo; r <= hi; r++) level[r] = col + 1
      placed.push({ shape, col })
    }
    const ncols = Math.max(0, ...level)
    const colW = new Array(ncols).fill(BOX_H)
    for (const { shape, col } of placed) colW[col] = Math.max(colW[col], shape.w)
    const colX: number[] = []
    let x = LEFT + PAD
    for (const w of colW) {
      colX.push(x + w / 2)
      x += w + PAD
    }
    return { placed, colX, width: x + 12 }
  }, [circuit, nq, cRow])

  const rowY = (r: number) => TOP + r * ROW
  const height = rowY(hasC ? nq : nq - 1) + 30
  const { width, placed, colX } = layout
  const gateStroke = 'var(--lane-quantum)'

  const box = (cx: number, rows: number[], label: string, w: number, key: string) => {
    const y0 = rowY(Math.min(...rows)) - BOX_H / 2
    const y1 = rowY(Math.max(...rows)) + BOX_H / 2
    return (
      <g key={key}>
        <rect x={cx - w / 2} y={y0} width={w} height={y1 - y0} rx={5} fill="var(--surface)" stroke={gateStroke} strokeWidth={1.5} />
        <text x={cx} y={(y0 + y1) / 2 + 4} textAnchor="middle" fontSize={12.5} fontFamily="var(--font-mono)" fill="var(--text)">
          {label}
        </text>
      </g>
    )
  }
  const dot = (cx: number, r: number, key: string) => <circle key={key} cx={cx} cy={rowY(r)} r={5} fill="var(--text)" />
  const cross = (cx: number, r: number, key: string) => (
    <g key={key} stroke="var(--text)" strokeWidth={2} strokeLinecap="round">
      <line x1={cx - 6} y1={rowY(r) - 6} x2={cx + 6} y2={rowY(r) + 6} />
      <line x1={cx - 6} y1={rowY(r) + 6} x2={cx + 6} y2={rowY(r) - 6} />
    </g>
  )

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={t('results.circuitSummary', { qubits: nq, ops: circuit.ops.length })}
        className="block"
      >
        {/* Wires */}
        {circuit.qubits.map((label, r) => (
          <g key={`q${r}`}>
            <text x={LEFT - 12} y={rowY(r) + 4} textAnchor="end" fontSize={12} fontFamily="var(--font-mono)" fill="var(--muted)">
              {label}
            </text>
            <line x1={LEFT} x2={width - 8} y1={rowY(r)} y2={rowY(r)} stroke="var(--muted)" strokeOpacity={0.55} strokeWidth={1.2} />
          </g>
        ))}
        {hasC && (
          <g>
            <text x={LEFT - 12} y={rowY(cRow) + 4} textAnchor="end" fontSize={12} fontFamily="var(--font-mono)" fill="var(--muted)">
              c/{circuit.clbits.length}
            </text>
            {[-2, 2].map((d) => (
              <line key={d} x1={LEFT} x2={width - 8} y1={rowY(cRow) + d} y2={rowY(cRow) + d} stroke="var(--muted)" strokeOpacity={0.55} strokeWidth={1} />
            ))}
          </g>
        )}

        {placed.map(({ shape, col }, i) => {
          const cx = colX[col]
          const key = `op${i}`
          switch (shape.kind) {
            case 'box':
              return box(cx, shape.rows, shape.label, shape.w, key)
            case 'barrier': {
              const lo = Math.min(...shape.rows), hi = Math.max(...shape.rows)
              return (
                <rect
                  key={key}
                  x={cx - 3}
                  y={rowY(lo) - ROW / 2 + 4}
                  width={6}
                  height={rowY(hi) - rowY(lo) + ROW - 8}
                  fill="var(--muted)"
                  opacity={0.18}
                />
              )
            }
            case 'controlled': {
              const all = [...shape.controls, ...shape.targets]
              const line = (
                <line key={`${key}l`} x1={cx} x2={cx} y1={rowY(Math.min(...all))} y2={rowY(Math.max(...all))} stroke="var(--text)" strokeWidth={1.5} />
              )
              const tgt =
                shape.base === 'x' ? (
                  shape.targets.map((r) => (
                    <g key={`${key}t${r}`}>
                      <circle cx={cx} cy={rowY(r)} r={11} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.5} />
                      <line x1={cx - 11} x2={cx + 11} y1={rowY(r)} y2={rowY(r)} stroke="var(--text)" strokeWidth={1.5} />
                      <line x1={cx} x2={cx} y1={rowY(r) - 11} y2={rowY(r) + 11} stroke="var(--text)" strokeWidth={1.5} />
                    </g>
                  ))
                ) : shape.base === 'z' ? (
                  shape.targets.map((r) => dot(cx, r, `${key}t${r}`))
                ) : (
                  box(cx, shape.targets, shape.label, shape.w, `${key}b`)
                )
              return (
                <g key={key}>
                  {line}
                  {shape.controls.map((r) => dot(cx, r, `${key}c${r}`))}
                  {tgt}
                </g>
              )
            }
            case 'swap': {
              const all = [...shape.rows, ...shape.controls]
              return (
                <g key={key}>
                  <line x1={cx} x2={cx} y1={rowY(Math.min(...all))} y2={rowY(Math.max(...all))} stroke="var(--text)" strokeWidth={1.5} />
                  {shape.controls.map((r) => dot(cx, r, `${key}c${r}`))}
                  {shape.rows.map((r) => cross(cx, r, `${key}x${r}`))}
                </g>
              )
            }
            case 'measure': {
              const y = rowY(shape.row)
              const yc = rowY(cRow)
              return (
                <g key={key}>
                  {[-1.8, 1.8].map((d) => (
                    <line key={d} x1={cx + d} x2={cx + d} y1={y + BOX_H / 2} y2={yc - 7} stroke="var(--muted)" strokeWidth={1} />
                  ))}
                  <path d={`M${cx - 5},${yc - 9} L${cx},${yc - 2} L${cx + 5},${yc - 9} Z`} fill="var(--muted)" />
                  <text x={cx + 6} y={yc + 15} fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--muted)">
                    {shape.clbit}
                  </text>
                  <rect x={cx - BOX_H / 2} y={y - BOX_H / 2} width={BOX_H} height={BOX_H} rx={5} fill="var(--surface)" stroke="var(--muted)" strokeWidth={1.5} />
                  {/* Meter icon */}
                  <path d={`M${cx - 9},${y + 6} A10,10 0 0 1 ${cx + 9},${y + 6}`} fill="none" stroke="var(--text)" strokeWidth={1.4} />
                  <line x1={cx} y1={y + 6} x2={cx + 6} y2={y - 6} stroke="var(--text)" strokeWidth={1.4} strokeLinecap="round" />
                </g>
              )
            }
          }
        })}
      </svg>
    </div>
  )
}
