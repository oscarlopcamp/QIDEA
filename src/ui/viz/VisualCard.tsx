import { BarChart3, Workflow } from 'lucide-react'
import type { Visual } from '@/services/runtimes/types'
import { CircuitDiagram } from './CircuitDiagram'
import { Histogram } from './Histogram'

/** One chart or circuit produced by user code. */
export function VisualCard({ visual, source }: { visual: Visual; source?: string }) {
  return (
    <section className="max-w-full min-w-[280px] rounded-lg border border-line bg-bg p-3" aria-label={visual.title}>
      <header className="mb-2 flex items-center gap-2">
        {visual.kind === 'histogram' ? (
          <BarChart3 size={14} className="text-quantum" />
        ) : (
          <Workflow size={14} className="text-quantum" />
        )}
        <h3 className="text-[13px] font-semibold text-text">{visual.title}</h3>
        {source && <span className="ml-auto truncate pl-3 text-[11.5px] text-muted">{source}</span>}
      </header>
      {visual.kind === 'histogram' ? <Histogram counts={visual.counts} /> : <CircuitDiagram circuit={visual.circuit} />}
    </section>
  )
}
