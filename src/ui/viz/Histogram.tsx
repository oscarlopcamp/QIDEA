import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_BARS = 32
const PLOT_H = 180
const LABELED = 2 // direct labels only on the highest bars

interface Bar {
  key: string
  count: number
  p: number
  other?: boolean
}

/** Smallest "nice" ceiling ≥ v, for a probability axis. */
function niceMax(v: number): number {
  for (const step of [0.05, 0.1, 0.2, 0.25, 0.5, 0.75, 1]) if (v <= step) return step
  return 1
}

const pct = (p: number) => `${(p * 100).toFixed(p >= 0.1 ? 1 : 2)}%`

export function Histogram({ counts }: { counts: Record<string, number> }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  const { bars, shots, outcomes } = useMemo(() => {
    const entries = Object.entries(counts)
    const shots = entries.reduce((n, [, c]) => n + c, 0) || 1
    let shown = entries
    let other: Bar | null = null
    if (entries.length > MAX_BARS) {
      const byCount = [...entries].sort((a, b) => b[1] - a[1])
      shown = byCount.slice(0, MAX_BARS - 1)
      const rest = byCount.slice(MAX_BARS - 1).reduce((n, [, c]) => n + c, 0)
      other = { key: t('results.other', { count: entries.length - shown.length }), count: rest, p: rest / shots, other: true }
    }
    const bars: Bar[] = shown
      .sort(([a], [b]) => (a.length === b.length ? a.localeCompare(b) : a.length - b.length))
      .map(([key, count]) => ({ key, count, p: count / shots }))
    if (other) bars.push(other)
    return { bars, shots, outcomes: entries.length }
  }, [counts, t])

  const top = new Set(
    [...bars]
      .filter((b) => !b.other)
      .sort((a, b) => b.count - a.count)
      .slice(0, LABELED)
      .map((b) => b.key),
  )
  const maxP = niceMax(Math.max(...bars.map((b) => b.p), 0.01))
  const longest = Math.max(...bars.map((b) => b.key.length))
  // Few outcomes get wide slots so labels never collide; many outcomes stay compact.
  const slot = Math.max(bars.length <= 8 ? 64 : 28, Math.min(64, longest * 8 + 12))
  const rotate = longest * 7.5 > slot - 6
  const axisW = 40
  const labelH = rotate ? Math.min(90, longest * 6 + 16) : 22
  const width = axisW + bars.length * slot + 8
  const height = PLOT_H + labelH + 18
  const y = (p: number) => 16 + PLOT_H - (p / maxP) * PLOT_H
  const barW = Math.min(24, slot * 0.6)
  // Round gridlines: every 25% for tall axes, 5% (or 2.5%) for short ones.
  const step = maxP >= 0.5 ? 0.25 : maxP > 0.05 ? 0.05 : 0.025
  const ticks = Array.from({ length: Math.round(maxP / step) + 1 }, (_, i) => i * step)
  const summary = t('results.histogramSummary', {
    shots: shots.toLocaleString('en'),
    count: outcomes,
    top: [...top].map((k) => `${k} ${pct(bars.find((b) => b.key === k)!.p)}`).join(', '),
  })

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[12px] text-muted">
        <span>
          {t('results.shots', { count: shots, formatted: shots.toLocaleString('en') })},{' '}
          {t('results.outcomes', { count: outcomes })}
        </span>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="ml-auto rounded px-1.5 py-0.5 text-text hover:bg-surface-2"
        >
          {asTable ? t('results.showChart') : t('results.showTable')}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-[260px] overflow-auto">
          <table className="w-full max-w-[420px] text-left text-[12.5px]">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-4 font-medium">{t('results.outcome')}</th>
                <th className="py-1 pr-4 text-right font-medium">{t('results.count')}</th>
                <th className="py-1 text-right font-medium">{t('results.probability')}</th>
              </tr>
            </thead>
            <tbody className="font-mono text-text">
              {[...bars].sort((a, b) => b.count - a.count).map((b) => (
                <tr key={b.key} className="border-t border-line">
                  <td className="py-1 pr-4">{b.key}</td>
                  <td className="py-1 pr-4 text-right">{b.count.toLocaleString('en')}</td>
                  <td className="py-1 text-right">{pct(b.p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <svg width={width} height={height} role="img" aria-label={summary} className="block">
            {ticks.map((tk) => (
              <g key={tk}>
                <line x1={axisW} x2={width - 4} y1={y(tk)} y2={y(tk)} stroke="var(--line)" strokeWidth={1} />
                <text x={axisW - 6} y={y(tk) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                  {Number((tk * 100).toFixed(1))}%
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const cx = axisW + i * slot + slot / 2
              const top0 = y(b.p)
              const h = Math.max(0, 16 + PLOT_H - top0)
              const r = Math.min(4, h, barW / 2)
              const x0 = cx - barW / 2
              const base = 16 + PLOT_H
              // 4px rounded data end, square at the baseline.
              const d =
                h <= 0
                  ? ''
                  : `M${x0},${base} V${top0 + r} Q${x0},${top0} ${x0 + r},${top0} H${x0 + barW - r} Q${x0 + barW},${top0} ${x0 + barW},${top0 + r} V${base} Z`
              const dim = hover !== null && hover !== i
              return (
                <g key={b.key}>
                  <path d={d} fill={b.other ? 'var(--muted)' : 'var(--lane-quantum)'} opacity={dim ? 0.45 : 1} />
                  {top.has(b.key) && (
                    <text x={cx} y={top0 - 5} textAnchor="middle" fontSize={11} fill="var(--text)">
                      {pct(b.p)}
                    </text>
                  )}
                  <text
                    x={cx}
                    y={base + 14}
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                    fill="var(--muted)"
                    textAnchor={rotate ? 'end' : 'middle'}
                    transform={rotate ? `rotate(-55 ${cx} ${base + 14})` : undefined}
                    fontStyle={b.other ? 'italic' : undefined}
                  >
                    {b.key}
                  </text>
                  {/* Hit target: the whole slot, taller than the bar. */}
                  <rect
                    x={cx - slot / 2}
                    y={0}
                    width={slot}
                    height={base}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              )
            })}
          </svg>
          {hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-lg"
              style={{
                left: Math.min(axisW + hover * slot + slot / 2 + 10, width - 150),
                top: Math.max(0, y(bars[hover].p) - 8),
              }}
            >
              <div className="font-mono text-text">{bars[hover].key}</div>
              <div className="text-muted">
                {t('results.tooltip', { count: bars[hover].count.toLocaleString('en'), pct: pct(bars[hover].p) })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
