import { useTranslation } from 'react-i18next'

/** Placeholder sidebar view for modules that arrive in a later phase. */
export function plannedView(viewId: string) {
  function PlannedView() {
    const { t } = useTranslation()
    return (
      <div className="px-4 pt-3">
        <h2 className="text-[13px] font-semibold text-text">{t(`views.${viewId}`)}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t(`sidebar.${viewId}Empty`)}</p>
      </div>
    )
  }
  PlannedView.displayName = `PlannedView(${viewId})`
  return PlannedView
}
