import { useEffect } from 'react'
import { Cpu, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { host } from '@/extensions'
import { useRuntime } from '@/stores/runtime'
import { QideaMark } from '@/ui/brand/Logo'

export function StatusBar() {
  const { t } = useTranslation()
  const { selected, loadedVersion, phase, progress, init } = useRuntime()

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
      <button
        type="button"
        onClick={() => void host.executeCommand('qidea.qiskit.selectVersion')}
        title={t('status.runtime')}
        aria-label={`${t('status.runtime')}: ${selected ?? '—'}, ${state}`}
        className="flex items-center gap-1.5 rounded px-1 hover:bg-surface hover:text-text"
      >
        {phase === 'loading' ? <LoaderCircle size={13} className="animate-spin text-quantum" /> : <QideaMark size={13} />}
        <span className="text-text">Qiskit {selected ?? ''}</span>
        <span>· {state}</span>
      </button>
      <span className="flex items-center gap-1.5">
        <Cpu size={13} strokeWidth={1.75} />
        {t('status.backend')}
      </span>
      <span className="ml-auto">v{__APP_VERSION__}</span>
    </footer>
  )
}
