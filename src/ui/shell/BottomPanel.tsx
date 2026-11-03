import { useTranslation } from 'react-i18next'

export function BottomPanel() {
  const { t } = useTranslation()
  return (
    <section className="flex h-full flex-col border-t border-line bg-surface" aria-label={t('panel.output')}>
      <div className="flex gap-4 px-4 pt-2 text-[12px]">
        <span className="border-b-2 border-accent pb-1 font-medium text-text">{t('panel.output')}</span>
        <span className="pb-1 text-muted">{t('panel.terminal')}</span>
      </div>
      <pre className="flex-1 overflow-auto px-4 py-2 font-mono text-[12.5px] text-muted">{t('panel.ready')}</pre>
    </section>
  )
}
