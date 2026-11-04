import { useEffect, useState } from 'react'
import { Code2, Link2, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STATUSES, type WorkItem } from '@/core/model/manager'
import { LANES, type LaneId } from '@/core/model/project'
import { isInternalPath } from '@/core/model/runs'
import type { MethodologyStage } from '@/extensions/api'
import { useManager } from '@/stores/manager'
import { usePalette } from '@/stores/palette'
import { useWorkspace } from '@/stores/workspace'
import { Dialog, btnDanger, btnSecondary, inputClass } from '@/ui/common/Dialog'
import { FileIcon } from '@/ui/explorer/FileIcon'
import { StatusIcon } from './status'

export function ItemDetail({ item, stages }: { item: WorkItem; stages: MethodologyStage[] }) {
  const { t } = useTranslation()
  const { select, updateItem, deleteItem, addLink, removeLink, openLink } = useManager()
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    setTitle(item.title)
    setDescription(item.description)
  }, [item.id, item.title, item.description])

  const linkFile = async () => {
    const files = Object.values(useWorkspace.getState().entries)
      .filter((e) => e.kind === 'file' && !isInternalPath(e.path))
      .map((e) => e.path)
      .sort()
    const picked = await usePalette
      .getState()
      .showQuickPick(files.map((p) => ({ label: p, value: p })), { placeholder: t('manager.pickFile') })
    if (picked) await addLink(item.id, { path: picked.value })
  }

  const label = 'block text-[11.5px] font-medium text-muted'
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-surface" aria-label={t('manager.detail')}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-text">{t('manager.detail')}</h3>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label={t('common.close')}
          className="ml-auto grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        <label className={label}>
          {t('manager.title')}
          <input
            className={`${inputClass} mt-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== item.title && void updateItem(item.id, { title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>

        <fieldset>
          <legend className={label}>{t('manager.statusLabel')}</legend>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={item.status === st}
                onClick={() => void updateItem(item.id, { status: st })}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12.5px] ${
                  item.status === st ? 'border-accent bg-bg text-text' : 'border-line text-muted hover:text-text'
                }`}
              >
                <StatusIcon status={st} />
                {t(`manager.status.${st}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <label className={label}>
            {t('manager.stage')}
            <select
              className={`${inputClass} mt-1 py-1.5`}
              value={item.stageId}
              onChange={(e) => void updateItem(item.id, { stageId: e.target.value })}
            >
              {!stages.some((s) => s.id === item.stageId) && <option value={item.stageId}>{t('manager.unassigned')}</option>}
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.title, { defaultValue: s.title })}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t('manager.lane')}
            <select
              className={`${inputClass} mt-1 py-1.5`}
              value={item.lane}
              onChange={(e) => void updateItem(item.id, { lane: e.target.value as LaneId })}
            >
              {LANES.map((l) => (
                <option key={l} value={l}>
                  {t(`lanes.${l}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={label}>
          {t('manager.description')}
          <textarea
            className={`${inputClass} mt-1 min-h-[96px] resize-y leading-relaxed`}
            value={description}
            placeholder={t('manager.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== item.description && void updateItem(item.id, { description })}
          />
        </label>

        <section aria-label={t('manager.code')}>
          <h4 className={label}>{t('manager.code')}</h4>
          <ul className="mt-1 flex flex-col gap-1">
            {item.links.map((l, i) => (
              <li key={`${l.path}:${l.line ?? ''}`} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1">
                <FileIcon path={l.path} />
                <button
                  type="button"
                  onClick={() => openLink(l)}
                  className="min-w-0 flex-1 truncate text-left font-mono text-[12px] text-text hover:underline"
                  title={t('manager.openCodeTitle', { path: l.path })}
                >
                  {l.path}
                </button>
                <input
                  type="number"
                  min={1}
                  aria-label={t('manager.line')}
                  placeholder={t('manager.lineShort')}
                  defaultValue={l.line}
                  onBlur={(e) => {
                    const n = Number(e.target.value)
                    const links = item.links.map((x, k) => (k === i ? { path: x.path, ...(n > 0 ? { line: n } : {}) } : x))
                    void updateItem(item.id, { links })
                  }}
                  className="w-14 rounded border border-line bg-bg px-1 py-0.5 text-right font-mono text-[11.5px] text-text outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => void removeLink(item.id, i)}
                  aria-label={t('manager.removeLink', { path: l.path })}
                  className="grid h-5 w-5 place-items-center rounded text-muted hover:text-danger"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void linkFile()} className={`${btnSecondary} px-2.5 py-1 text-[12.5px]`}>
              <Link2 size={13} /> {t('manager.linkFile')}
            </button>
            {item.links[0] && (
              <button type="button" onClick={() => openLink(item.links[0])} className={`${btnSecondary} px-2.5 py-1 text-[12.5px]`}>
                <Code2 size={13} /> {t('manager.openCode')}
              </button>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="mt-auto inline-flex items-center gap-1.5 self-start text-[12.5px] text-muted hover:text-danger"
        >
          <Trash2 size={13} /> {t('manager.deleteItem')}
        </button>
      </div>
      <Dialog
        open={confirm}
        title={t('manager.deleteTitle', { title: item.title })}
        onClose={() => setConfirm(false)}
        onSubmit={() => {
          setConfirm(false)
          void deleteItem(item.id)
        }}
        actions={
          <>
            <button type="button" className={btnSecondary} onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className={btnDanger}>
              {t('manager.deleteItem')}
            </button>
          </>
        }
      >
        {t('manager.deleteBody')}
      </Dialog>
    </aside>
  )
}
