import { CircleAlert, CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useExtensions } from '@/extensions'
import type { ContributionKind } from '@/extensions/api'

/** Lists installed extensions and what each one contributes. */
export function ExtensionsView() {
  const { t } = useTranslation()
  const extensions = useExtensions()
  return (
    <div className="flex h-full flex-col">
      <h2 className="px-4 pb-1 pt-3 text-[13px] font-semibold text-text">{t('views.extensions')}</h2>
      <p className="px-4 pb-2 text-[12.5px] text-muted">{t('extensions.lead', { count: extensions.length })}</p>
      <ul className="min-h-0 flex-1 overflow-auto px-2 pb-4">
        {extensions.map(({ extension: ext, state, error, contributions }) => (
          <li key={ext.id} className="rounded-md px-2 py-2 hover:bg-surface-2/60">
            <div className="flex items-center gap-1.5">
              {state === 'active' ? (
                <CircleCheck size={13} className="shrink-0 text-integration" aria-label={t('extensions.active')} />
              ) : (
                <CircleAlert size={13} className="shrink-0 text-danger" aria-label={t('extensions.failed')} />
              )}
              <span className="truncate text-[13px] font-medium text-text">{ext.name}</span>
              <span className="ml-auto shrink-0 text-[11.5px] text-muted">v{ext.version}</span>
            </div>
            <p className="mt-0.5 pl-[19px] text-[12.5px] leading-snug text-muted">{ext.description}</p>
            {error && <p className="mt-1 pl-[19px] text-[12px] text-danger">{error}</p>}
            <p className="mt-1 pl-[19px] text-[11.5px] text-muted">
              {(Object.entries(contributions) as [ContributionKind, number][])
                .filter(([, n]) => n > 0)
                .map(([kind, n]) => t(`extensions.kinds.${kind}`, { count: n }))
                .join(', ')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
