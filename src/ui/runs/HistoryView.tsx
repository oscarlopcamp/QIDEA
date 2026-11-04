import { useMemo } from 'react'
import { CircleAlert, CircleCheck, FileCode2, RotateCcw, Copy, CopyCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RunRecord } from '@/core/model/runs'
import type { Visual } from '@/services/runtimes/types'
import { useRuntime } from '@/stores/runtime'
import { listRuns, useRuns } from '@/stores/runs'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { VisualCard } from '@/ui/viz/VisualCard'

const time = (iso: string) =>
  new Date(iso).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Every recorded run of the project, with exact versions and a one-click reproduction. */
export function HistoryView() {
  const { t } = useTranslation()
  const entries = useWorkspace((s) => s.entries)
  const project = useWorkspace((s) => s.project)
  const busy = useRuntime((s) => s.phase === 'loading' || s.phase === 'running')
  const { selectedId, select, reproduce } = useRuns()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runs = useMemo(() => listRuns(), [entries])
  const run = runs.find((r) => r.id === selectedId) ?? runs[0]

  if (!project) return <p className="px-4 py-3 text-[13px] text-muted">{t('history.noProject')}</p>
  if (!runs.length) return <p className="px-4 py-3 text-[13px] text-muted">{t('history.empty')}</p>

  return (
    <div className="flex h-full min-h-0">
      <ul className="w-[280px] shrink-0 overflow-y-auto border-r border-line py-1" aria-label={t('history.list')}>
        {runs.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => select(r.id)}
              aria-current={r.id === run?.id}
              className={`flex w-full items-start gap-2 px-3 py-1.5 text-left ${r.id === run?.id ? 'bg-surface-2' : 'hover:bg-surface-2/60'}`}
            >
              <StatusIcon run={r} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-text">{r.entry}</span>
                <span className="block text-[11.5px] text-muted">
                  {time(r.at)}, Qiskit {r.runtime.packages.qiskit}
                  {r.reproduces && ` · ${t('history.reproduction')}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {run && <RunDetail run={run} original={runs.find((r) => r.id === run.reproduces)} busy={busy} onReproduce={() => void reproduce(run.id)} />}
    </div>
  )
}

function StatusIcon({ run }: { run: RunRecord }) {
  const { t } = useTranslation()
  if (!run.ok) return <CircleAlert size={14} className="mt-0.5 shrink-0 text-danger" aria-label={t('history.failed')} />
  if (run.reproduces && run.identical === false)
    return <Copy size={14} className="mt-0.5 shrink-0 text-danger" aria-label={t('history.differs')} />
  if (run.reproduces) return <CopyCheck size={14} className="mt-0.5 shrink-0 text-integration" aria-label={t('history.identical')} />
  return <CircleCheck size={14} className="mt-0.5 shrink-0 text-integration" aria-label={t('history.succeeded')} />
}

function RunDetail({
  run,
  original,
  busy,
  onReproduce,
}: {
  run: RunRecord
  original?: RunRecord
  busy: boolean
  onReproduce: () => void
}) {
  const { t } = useTranslation()
  const openFile = useWorkspace((s) => s.openFile)
  const versions = [
    ['Qiskit', run.runtime.packages.qiskit],
    ['Python', run.runtime.python],
    ['Pyodide', run.runtime.pyodide],
    ...Object.entries(run.runtime.packages)
      .filter(([k]) => k !== 'qiskit')
      .map(([k, v]) => [k, v]),
  ]
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-4 py-3" aria-label={t('history.detail')}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-semibold text-text">{run.entry}</h3>
        <span className="text-[12px] text-muted">
          {time(run.at)}, {t('history.duration', { ms: run.durationMs.toLocaleString('en') })}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              useUi.getState().showView('explorer')
              openFile(run.entry)
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12.5px] text-text hover:bg-surface-2"
          >
            <FileCode2 size={13} /> {t('history.openFile')}
          </button>
          <button
            type="button"
            onClick={onReproduce}
            disabled={busy}
            title={t('history.reproduceHint', { version: run.runtime.packages.qiskit })}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12.5px] font-medium text-accent-ink disabled:opacity-60"
          >
            <RotateCcw size={13} /> {t('history.reproduce')}
          </button>
        </div>
      </div>

      {run.reproduces && (
        <p className={`mt-2 text-[12.5px] ${run.identical ? 'text-integration' : 'text-danger'}`}>
          {run.identical
            ? t('history.identicalNote', { when: original ? time(original.at) : run.reproduces })
            : t('history.differsNote', { when: original ? time(original.at) : run.reproduces })}
        </p>
      )}
      {!run.snapshot && <p className="mt-2 text-[12.5px] text-muted">{t('history.noSnapshot')}</p>}

      <dl className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-1 text-[12px]">
        {versions.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono text-text">{v}</dd>
          </div>
        ))}
      </dl>

      {run.visuals.length > 0 && (
        <div className="mt-3 flex flex-wrap items-start gap-3">
          {(run.visuals as Visual[]).map((v, i) => (
            <VisualCard key={i} visual={v} />
          ))}
        </div>
      )}
      {(run.output || run.error) && (
        <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-bg p-2 font-mono text-[12px] leading-[1.25] text-text">
          {run.output}
          {run.error && !run.output.includes(run.error) && <span className="text-danger">{`\n${run.error}`}</span>}
        </pre>
      )}
    </div>
  )
}
