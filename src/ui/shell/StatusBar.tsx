import { useEffect } from 'react'
import { Cpu, LoaderCircle, Lock, LockOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { host, useContributions } from '@/extensions'
import { LOCK_PATH, parseLock } from '@/core/model/runs'
import { useRuntime } from '@/stores/runtime'
import { useWorkspace } from '@/stores/workspace'
import { QideaMark } from '@/ui/brand/Logo'

export function StatusBar() {
  const { t } = useTranslation()
  const { selected, loadedVersion, phase, progress, init } = useRuntime()
  const backend = useContributions('backends')[0]
  const lockText = useWorkspace((s) => s.entries[LOCK_PATH]?.content)
  const locked = parseLock(lockText)?.packages.qiskit

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
      {locked && (
        <span
          className={`flex items-center gap-1 ${locked === selected ? '' : 'text-danger'}`}
          title={locked === selected ? t('status.lockedTitle', { version: locked }) : t('status.lockMismatchTitle', { version: locked })}
        >
          {locked === selected ? <Lock size={12} /> : <LockOpen size={12} />}
          {locked === selected ? t('status.locked') : t('status.lockMismatch', { version: locked })}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <Cpu size={13} strokeWidth={1.75} />
        {backend?.name ?? t('status.noBackend')}
      </span>
      <span className="ml-auto">v{__APP_VERSION__}</span>
    </footer>
  )
}
