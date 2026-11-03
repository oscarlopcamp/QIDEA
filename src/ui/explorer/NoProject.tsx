import { FolderPlus, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useProjectActions } from '@/ui/projects/projectActions'

export function NoProject() {
  const { t } = useTranslation()
  const actions = useProjectActions()
  return (
    <div className="flex h-full flex-col px-4 pt-3">
      <h2 className="text-[13px] font-semibold text-text">{t('views.explorer')}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{t('sidebar.explorerEmpty')}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={actions.openNew}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink"
        >
          <FolderPlus size={15} /> {t('welcome.newProject')}
        </button>
        <button
          type="button"
          onClick={actions.openImport}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-1.5 text-[13px] text-text hover:bg-surface-2"
        >
          <Upload size={15} /> {t('projects.import')}
        </button>
      </div>
      {actions.elements}
    </div>
  )
}
