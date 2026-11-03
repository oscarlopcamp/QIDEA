import { useEffect, useRef } from 'react'
import { Eraser, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRuntime, type OutputKind } from '@/stores/runtime'

const KIND_CLASS: Record<OutputKind, string> = {
  info: 'text-muted',
  stdout: 'text-text',
  stderr: 'text-danger',
  error: 'text-danger',
  success: 'text-integration',
}

export function BottomPanel() {
  const { t } = useTranslation()
  const { output, phase, runCheck, clearOutput } = useRuntime()
  const end = useRef<HTMLDivElement>(null)
  const busy = phase === 'loading' || phase === 'running'

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [output.length])

  return (
    <section className="flex h-full flex-col border-t border-line bg-surface" aria-label={t('panel.output')}>
      <div className="flex items-center gap-4 px-4 pt-2 text-[12px]">
        <span className="border-b-2 border-accent pb-1 font-medium text-text">{t('panel.output')}</span>
        <span className="pb-1 text-muted">{t('panel.terminal')}</span>
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
      <div className="flex-1 overflow-auto px-4 py-2 font-mono text-[12.5px] leading-[1.2]" role="log" aria-live="polite">
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
