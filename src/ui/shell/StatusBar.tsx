import { useEffect } from 'react'
import { Cpu, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRuntime } from '@/stores/runtime'
import { QideaMark } from '@/ui/brand/Logo'

export function StatusBar() {
  const { t } = useTranslation()
  const { versions, selected, loadedVersion, phase, progress, init, select } = useRuntime()

  useEffect(() => {
    void init()
  }, [init])

  const state =
    phase === 'loading'
      ? (progress ?? t('status.loading'))
      : loadedVersion === selected && loadedVersion
        ? t('status.ready')
        : t('status.notLoaded')

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-surface-2 px-3 text-[12px] text-muted">
      <label className="flex items-center gap-1.5" title={t('status.runtime')}>
        {phase === 'loading' ? <LoaderCircle size={13} className="animate-spin text-quantum" /> : <QideaMark size={13} />}
        <span className="sr-only">{t('status.runtime')}</span>
        {versions.length > 0 ? (
          <select
            value={selected ?? ''}
            onChange={(e) => select(e.target.value)}
            disabled={phase === 'loading' || phase === 'running'}
            className="cursor-pointer bg-transparent pr-1 text-text outline-none"
          >
            {versions.map((v) => (
              <option key={v} value={v}>
                Qiskit {v}
              </option>
            ))}
          </select>
        ) : (
          <span>Qiskit</span>
        )}
        <span>· {state}</span>
      </label>
      <span className="flex items-center gap-1.5">
        <Cpu size={13} strokeWidth={1.75} />
        {t('status.backend')}
      </span>
      <span className="ml-auto">v{__APP_VERSION__}</span>
    </footer>
  )
}
