import { useEffect } from 'react'
import { SquareKanban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { progressBy } from '@/core/model/manager'
import { LANES } from '@/core/model/project'
import { useContributions } from '@/extensions'
import { useManagerData } from '@/stores/manager'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { LANE_VAR } from './status'

/** Sidebar summary of the board. Opening this view switches the project to Manager mode. */
export function ManagerSidebar() {
  const { t } = useTranslation()
  const project = useWorkspace((s) => s.project)
  const data = useManagerData()
  const methodologies = useContributions('methodologies')
  const setMode = useUi((s) => s.setMode)
  const mode = useUi((s) => s.mode)

  useEffect(() => {
    if (project) setMode('manager')
  }, [project, setMode])

  if (!project) {
    return (
      <div className="px-4 pt-3">
        <h2 className="text-[13px] font-semibold text-text">{t('views.manager')}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t('sidebar.managerEmpty')}</p>
      </div>
    )
  }

  const methodology = methodologies.find((m) => m.id === data.methodologyId) ?? methodologies[0]
  const byStage = progressBy(data.items, (i) => i.stageId)
  const byLane = progressBy(data.items, (i) => i.lane)

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-4 pt-3">
      <h2 className="text-[13px] font-semibold text-text">{t('views.manager')}</h2>
      <p className="mt-1 text-[12.5px] text-muted">{methodology ? t(methodology.title, { defaultValue: methodology.title }) : ''}</p>
      {mode !== 'manager' && (
        <button
          type="button"
          onClick={() => setMode('manager')}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink"
        >
          <SquareKanban size={14} /> {t('manager.openBoard')}
        </button>
      )}
      <h3 className="mt-4 text-[11.5px] font-medium text-muted">{t('manager.lanesHeading')}</h3>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {LANES.map((lane) => {
          const p = byLane[lane] ?? { done: 0, total: 0 }
          return (
            <li key={lane} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANE_VAR[lane] }} aria-hidden />
              <span className="text-text">{t(`lanes.${lane}`)}</span>
              <span className="ml-auto text-muted">{t('manager.doneOf', { done: p.done, total: p.total })}</span>
            </li>
          )
        })}
      </ul>
      <h3 className="mt-4 text-[11.5px] font-medium text-muted">{t('manager.stagesHeading')}</h3>
      <ol className="mt-1.5 flex flex-col gap-1">
        {methodology?.stages.map((s) => {
          const p = byStage[s.id] ?? { done: 0, total: 0 }
          return (
            <li key={s.id} className="flex items-center gap-2 text-[12.5px]">
              <span className="text-text">{t(s.title, { defaultValue: s.title })}</span>
              <span className="ml-auto text-muted">{p.total ? t('manager.doneOf', { done: p.done, total: p.total }) : '—'}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
