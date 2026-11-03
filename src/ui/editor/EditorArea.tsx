import { lazy, Suspense } from 'react'
import { LoaderCircle, Play, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { basename } from '@/core/fs/paths'
import { useRuntime } from '@/stores/runtime'
import { useWorkspace } from '@/stores/workspace'
import { WelcomeView } from '@/ui/shell/WelcomeView'
import { FileIcon } from '@/ui/explorer/FileIcon'

const CodeEditor = lazy(() => import('./CodeEditor'))

export function EditorArea() {
  const { t } = useTranslation()
  const { project, tabs, active, openFile, closeTab, runFile } = useWorkspace()
  const phase = useRuntime((s) => s.phase)

  if (!project || !active) return <WelcomeView />

  const busy = phase === 'loading' || phase === 'running'
  const canRun = active.endsWith('.py')

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-stretch border-b border-line bg-surface">
        <div role="tablist" aria-label={t('editor.openFiles')} className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((p) => {
            const selected = p === active
            return (
              <div
                key={p}
                className={`group flex shrink-0 items-center gap-1.5 border-r border-line pl-3 pr-1 text-[12.5px] ${
                  selected ? 'bg-bg text-text shadow-[inset_0_2px_0_var(--accent)]' : 'text-muted hover:text-text'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={p}
                  onClick={() => openFile(p)}
                  onAuxClick={(e) => e.button === 1 && closeTab(p)}
                  className="flex items-center gap-1.5 py-2"
                >
                  <FileIcon path={p} />
                  {basename(p)}
                </button>
                <button
                  type="button"
                  onClick={() => closeTab(p)}
                  aria-label={t('editor.closeTab', { name: basename(p) })}
                  className={`grid h-5 w-5 place-items-center rounded hover:bg-surface-2 ${
                    selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                  }`}
                >
                  <X size={13} />
                </button>
              </div>
            )
          })}
        </div>
        {canRun && (
          <button
            type="button"
            onClick={() => void runFile()}
            disabled={busy}
            title={t('editor.runHint')}
            className="mx-2 my-1 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-medium text-accent-ink disabled:opacity-60"
          >
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
            {phase === 'loading' ? t('panel.loadingRuntime') : phase === 'running' ? t('editor.running') : t('editor.run')}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={<div className="grid h-full place-items-center text-[13px] text-muted">{t('editor.loading')}</div>}
        >
          <CodeEditor path={active} />
        </Suspense>
      </div>
    </div>
  )
}
