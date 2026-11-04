import { useTranslation } from 'react-i18next'
import { useRuntime } from '@/stores/runtime'
import { VisualCard } from './VisualCard'

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
        <VisualCard key={id} visual={visual} source={entry} />
      ))}
    </div>
  )
}
