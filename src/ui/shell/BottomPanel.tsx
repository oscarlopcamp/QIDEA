import { useEffect, useRef } from 'react'
import { Eraser, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRuntime, type OutputKind } from '@/stores/runtime'
import { useUi } from '@/stores/ui'
import { ResultsView } from '@/ui/viz/ResultsView'

const KIND_CLASS: Record<OutputKind, string> = {
  info: 'text-muted',
  stdout: 'text-text',
  stderr: 'text-danger',
  error: 'text-danger',
  success: 'text-integration',
}

export function BottomPanel() {
  const { t } = useTranslation()
  const { output, phase, runCheck, clearOutput, results, panelTab, setPanelTab } = useRuntime()
  const open = useUi((s) => s.panelOpen)
  const end = useRef<HTMLDivElement>(null)
  const busy = phase === 'loading' || phase === 'running'

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [output.length])

  return (
    <section
      className="flex h-full flex-col border-t border-line bg-surface"
      aria-label={t('panel.output')}
      hidden={!open}
    >
      <div className="flex items-center gap-4 px-4 pt-2 text-[12px]">
        <div role="tablist" aria-label={t('panel.tabs')} className="flex gap-4">
          {(['output', 'results'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={panelTab === tab}
              onClick={() => setPanelTab(tab)}
              className={`border-b-2 pb-1 ${
                panelTab === tab ? 'border-accent font-medium text-text' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t(`panel.${tab}`)}
              {tab === 'results' && results.length > 0 && (
                <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-[11px] text-text">{results.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 pb-1">
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-text hover:bg-surface-2 disabled:opacity-50"
          >
            <Play size={13} className="text-quantum" />
            {phase === 'loading' ? t('panel.loadingRuntime') : t('panel.runCheck')}
          </button>
          <button
            type="button"
            onClick={clearOutput}
            aria-label={t('panel.clear')}
            title={t('panel.clear')}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text"
          >
            <Eraser size={13} />
          </button>
        </div>
      </div>
      {panelTab === 'results' && (
        <div className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-label={t('panel.results')}>
          <ResultsView />
        </div>
      )}
      <div
        className="flex-1 overflow-auto px-4 py-2 font-mono text-[12.5px] leading-[1.2]"
        role="log"
        aria-live="polite"
        hidden={panelTab !== 'output'}
      >
        {output.length === 0 && <p className="text-muted">{t('panel.ready')}</p>}
        {output.map((l) => (
          <pre key={l.id} className={`whitespace-pre-wrap py-px ${KIND_CLASS[l.kind]}`}>
            {l.text}
          </pre>
        ))}
        <div ref={end} />
      </div>
    </section>
  )
}
