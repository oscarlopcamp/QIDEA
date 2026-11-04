import { useMemo, useState, type DragEvent } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { progressBy, STATUSES, unassigned, type WorkItem } from '@/core/model/manager'
import { LANES, type LaneId } from '@/core/model/project'
import { useContributions } from '@/extensions'
import type { MethodologyStage } from '@/extensions/api'
import { useManager, useManagerData } from '@/stores/manager'
import { ItemCard } from './ItemCard'
import { ItemDetail } from './ItemDetail'
import { LANE_VAR, StatusIcon } from './status'

const UNASSIGNED = '__unassigned__'

/** Lifecycle stages (columns) × classical / quantum / integration lanes (rows). */
export function ManagerBoard() {
  const { t } = useTranslation()
  const data = useManagerData()
  const methodologies = useContributions('methodologies')
  const { selectedId, statusFilter, setStatusFilter, setMethodology, moveItem } = useManager()
  const methodology = methodologies.find((m) => m.id === data.methodologyId) ?? methodologies[0]
  const stages: MethodologyStage[] = methodology?.stages ?? []
  const stageIds = stages.map((s) => s.id)
  const orphans = unassigned(data.items, stageIds)
  const columns = orphans.length
    ? [{ id: UNASSIGNED, title: 'manager.unassigned', description: 'manager.unassignedDesc' }, ...stages]
    : stages
  const visible = data.items.filter((i) => statusFilter === 'all' || i.status === statusFilter)
  const byLane = progressBy(data.items, (i) => i.lane)
  const selected = data.items.find((i) => i.id === selectedId)

  const cellItems = (stageId: string, lane: LaneId) =>
    visible.filter((i) => i.lane === lane && (stageId === UNASSIGNED ? !stageIds.includes(i.stageId) : i.stageId === stageId))

  return (
    <div className="flex h-full min-h-0" data-tour="manager-board">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-2.5">
          <label className="flex items-center gap-2 text-[12.5px] text-muted" data-tour="manager-methodology">
            {t('manager.methodology')}
            <select
              value={methodology?.id ?? ''}
              onChange={(e) => void setMethodology(e.target.value)}
              className="rounded-md border border-line bg-bg px-2 py-1 text-[12.5px] text-text outline-none focus:border-accent"
            >
              {methodologies.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.title, { defaultValue: m.title })}
                </option>
              ))}
            </select>
          </label>
          <ul className="flex flex-wrap items-center gap-4" aria-label={t('manager.progress')} data-tour="manager-progress">
            {LANES.map((lane) => {
              const p = byLane[lane] ?? { done: 0, total: 0 }
              return (
                <li key={lane} className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANE_VAR[lane] }} aria-hidden />
                  <span className="text-text">{t(`lanes.${lane}`)}</span>
                  <span
                    className="relative h-1.5 w-16 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-label={t('manager.laneProgress', { lane: t(`lanes.${lane}`) })}
                    aria-valuenow={p.done}
                    aria-valuemax={p.total}
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${p.total ? (100 * p.done) / p.total : 0}%`, background: LANE_VAR[lane] }}
                    />
                  </span>
                  {t('manager.doneOf', { done: p.done, total: p.total })}
                </li>
              )
            })}
          </ul>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label={t('manager.filter')}>
            {(['all', ...STATUSES] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] ${
                  statusFilter === st ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
                }`}
              >
                {st !== 'all' && <StatusIcon status={st} size={12} />}
                {st === 'all' ? t('manager.allStatuses') : t(`manager.status.${st}`)}
              </button>
            ))}
          </div>
        </header>

        {data.items.length === 0 && <p className="border-b border-line px-4 py-2 text-[12.5px] text-muted">{t('manager.emptyHint')}</p>}

        <div className="min-h-0 flex-1 overflow-auto">
          <div
            role="grid"
            aria-label={t('manager.board')}
            className="grid min-w-max"
            style={{ gridTemplateColumns: `128px repeat(${columns.length}, minmax(200px, 1fr))` }}
          >
            {/* Header row */}
            <div className="sticky left-0 top-0 z-20 border-b border-r border-line bg-surface" role="columnheader" />
            {columns.map((s) => {
              const count = data.items.filter((i) => (s.id === UNASSIGNED ? !stageIds.includes(i.stageId) : i.stageId === s.id)).length
              return (
                <div
                  key={s.id}
                  role="columnheader"
                  title={t(s.description, { defaultValue: s.description })}
                  className="sticky top-0 z-10 border-b border-r border-line bg-surface px-3 py-2"
                  data-tour={s.id === stages[0]?.id ? 'manager-stage' : undefined}
                >
                  <span className="block text-[12.5px] font-semibold text-text">
                    {t(s.title, { defaultValue: s.title })}
                    <span className="ml-1.5 font-normal text-muted">{count || ''}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-muted">
                    {t(s.description, { defaultValue: s.description })}
                  </span>
                </div>
              )
            })}

            {LANES.map((lane) => (
              <Row key={lane} lane={lane} columns={columns} cellItems={cellItems} selectedId={selectedId} onDropItem={moveItem} />
            ))}
          </div>
        </div>
      </div>
      {selected && <ItemDetail item={selected} stages={stages} />}
    </div>
  )
}

function Row({
  lane,
  columns,
  cellItems,
  selectedId,
  onDropItem,
}: {
  lane: LaneId
  columns: { id: string }[]
  cellItems: (stageId: string, lane: LaneId) => WorkItem[]
  selectedId: string | null
  onDropItem: (id: string, stageId: string, lane: LaneId) => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <>
      <div
        role="rowheader"
        className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-3"
        style={{ boxShadow: `inset 3px 0 0 ${LANE_VAR[lane]}` }}
        data-tour={`manager-lane-${lane}`}
      >
        <span className="block text-[13px] font-semibold text-text">{t(`lanes.${lane}`)}</span>
        <span className="mt-1 block text-[11.5px] leading-snug text-muted">{t(`manager.laneHint.${lane}`)}</span>
      </div>
      {columns.map((s) => (
        <Cell
          key={s.id}
          stageId={s.id}
          lane={lane}
          items={cellItems(s.id, lane)}
          selectedId={selectedId}
          onDropItem={onDropItem}
        />
      ))}
    </>
  )
}

function Cell({
  stageId,
  lane,
  items,
  selectedId,
  onDropItem,
}: {
  stageId: string
  lane: LaneId
  items: WorkItem[]
  selectedId: string | null
  onDropItem: (id: string, stageId: string, lane: LaneId) => Promise<void>
}) {
  const { t } = useTranslation()
  const { addItem, select } = useManager()
  const [over, setOver] = useState(false)
  const [adding, setAdding] = useState(false)
  const canAdd = stageId !== UNASSIGNED

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const id = e.dataTransfer.getData('text/qidea-item')
    if (id && canAdd) void onDropItem(id, stageId, lane)
  }

  const sorted = useMemo(() => [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [items])

  return (
    <div
      role="gridcell"
      onDragOver={(e) => {
        if (!canAdd) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`group/cell flex min-h-[112px] flex-col gap-1.5 border-b border-r border-line p-2 transition-colors ${
        over ? 'bg-surface-2' : ''
      }`}
    >
      {sorted.map((item) => (
        <ItemCard key={item.id} item={item} selected={item.id === selectedId} />
      ))}
      {canAdd &&
        (adding ? (
          <input
            autoFocus
            aria-label={t('manager.newItemTitle')}
            placeholder={t('manager.newItemPlaceholder')}
            onKeyDown={async (e) => {
              if (e.key === 'Escape') setAdding(false)
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                const id = await addItem(stageId, lane, e.currentTarget.value)
                setAdding(false)
                select(id)
              }
            }}
            onBlur={() => setAdding(false)}
            className="rounded-md border border-accent bg-bg px-2 py-1 text-[12.5px] text-text outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={t('manager.addItemIn', { lane: t(`lanes.${lane}`) })}
            className="mt-auto flex items-center gap-1 self-start rounded px-1.5 py-0.5 text-[12px] text-muted opacity-0 hover:bg-surface-2 hover:text-text focus:opacity-100 group-hover/cell:opacity-100"
          >
            <Plus size={12} /> {t('manager.add')}
          </button>
        ))}
    </div>
  )
}
