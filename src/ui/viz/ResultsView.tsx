import { BarChart3, Workflow } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRuntime } from '@/stores/runtime'
import { CircuitDiagram } from './CircuitDiagram'
import { Histogram } from './Histogram'

/** Visual results of the latest run: histograms and circuits, in the order the code produced them. */
export function ResultsView() {
  const { t } = useTranslation()
  const results = useRuntime((s) => s.results)

  if (!results.length) {
    return (
      <div className="px-4 py-3 text-[13px] leading-relaxed text-muted">
        <p>{t('results.empty')}</p>
        <pre className="mt-2 font-mono text-[12.5px] text-text">
          {`from qidea import show_counts, show_circuit\nshow_circuit(qc)\nshow_counts(counts)`}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-3 px-4 py-3">
      {results.map(({ id, entry, visual }) => (
        <section key={id} className="max-w-full min-w-[280px] rounded-lg border border-line bg-bg p-3" aria-label={visual.title}>
          <header className="mb-2 flex items-center gap-2">
            {visual.kind === 'histogram' ? (
              <BarChart3 size={14} className="text-quantum" />
            ) : (
              <Workflow size={14} className="text-quantum" />
            )}
            <h3 className="text-[13px] font-semibold text-text">{visual.title}</h3>
            <span className="ml-auto truncate text-[11.5px] text-muted">{entry}</span>
          </header>
          {visual.kind === 'histogram' ? <Histogram counts={visual.counts} /> : <CircuitDiagram circuit={visual.circuit} />}
        </section>
      ))}
    </div>
  )
}
