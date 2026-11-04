import { Code2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkItem } from '@/core/model/manager'
import { useManager } from '@/stores/manager'
import { StatusIcon } from './status'

export function ItemCard({ item, selected }: { item: WorkItem; selected: boolean }) {
  const { t } = useTranslation()
  const { select, openLink } = useManager()
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/qidea-item', item.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`group rounded-md border bg-surface text-left shadow-sm transition-colors ${
        selected ? 'border-accent' : 'border-line hover:border-muted'
      }`}
    >
      <button
        type="button"
        onClick={() => select(selected ? null : item.id)}
        aria-pressed={selected}
        className="block w-full px-2.5 pb-1.5 pt-2 text-left"
      >
        <span className={`block text-[12.5px] leading-snug ${item.status === 'done' ? 'text-muted' : 'text-text'}`}>
          {item.title}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted">
          <StatusIcon status={item.status} size={12} />
          {t(`manager.status.${item.status}`)}
          {item.links.length > 0 && <span className="ml-auto">{t('manager.links', { count: item.links.length })}</span>}
        </span>
      </button>
      {item.links.length > 0 && (
        <button
          type="button"
          onClick={() => openLink(item.links[0])}
          title={t('manager.openCodeTitle', { path: item.links[0].path })}
          className="flex w-full items-center gap-1.5 border-t border-line px-2.5 py-1 text-[11.5px] text-muted hover:text-text"
        >
          <Code2 size={12} />
          <span className="truncate font-mono">
            {item.links[0].path}
            {item.links[0].line ? `:${item.links[0].line}` : ''}
          </span>
        </button>
      )}
    </div>
  )
}
