import { Cpu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QideaMark } from '@/ui/brand/Logo'

export function StatusBar() {
  const { t } = useTranslation()
  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-surface-2 px-3 text-[12px] text-muted">
      <span className="flex items-center gap-1.5" title={t('status.runtime')}>
        <QideaMark size={13} />
        {t('status.runtimeNotLoaded')}
      </span>
      <span className="flex items-center gap-1.5">
        <Cpu size={13} strokeWidth={1.75} />
        {t('status.backend')}
      </span>
      <span className="ml-auto">v{__APP_VERSION__}</span>
    </footer>
  )
}
