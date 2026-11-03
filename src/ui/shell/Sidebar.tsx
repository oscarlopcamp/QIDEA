import { useTranslation } from 'react-i18next'
import { useUi } from '@/stores/ui'
import { Explorer } from '@/ui/explorer/Explorer'

export function Sidebar() {
  const { t } = useTranslation()
  const view = useUi((s) => s.activeView)
  return (
    <aside className="flex h-full flex-col bg-surface" aria-label={t(`views.${view}`)}>
      {view === 'explorer' ? (
        <Explorer />
      ) : (
        <>
          <h2 className="px-4 pb-2 pt-3 text-[13px] font-semibold text-text">{t(`views.${view}`)}</h2>
          <p className="px-4 text-[13px] leading-relaxed text-muted">{t(`sidebar.${view}Empty`)}</p>
        </>
      )}
    </aside>
  )
}
