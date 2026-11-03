import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspace } from '@/stores/workspace'
import { Dialog, btnPrimary, btnSecondary, inputClass } from '@/ui/common/Dialog'

/** "New hybrid project" dialog + hidden zip picker, shared by the welcome page and the explorer. */
export function useProjectActions() {
  const { t } = useTranslation()
  const { createProject, importProject } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createProject(name.trim(), 'hybrid-starter')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const elements = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setImportError(null)
          try {
            await importProject(file)
          } catch (err) {
            setImportError(t('projects.importFailed', { reason: (err as Error).message }))
          }
        }}
      />
      <Dialog
        open={open}
        title={t('projects.newTitle')}
        onClose={() => setOpen(false)}
        onSubmit={() => void submit()}
        actions={
          <>
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className={btnPrimary} disabled={!name.trim() || busy}>
              {t('projects.create')}
            </button>
          </>
        }
      >
        <p>{t('projects.newBody')}</p>
        <label className="mt-4 block text-[12.5px] font-medium text-text">
          {t('projects.name')}
          <input
            className={`${inputClass} mt-1.5`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projects.namePlaceholder')}
            autoFocus
          />
        </label>
      </Dialog>
      {importError && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {importError}
        </p>
      )}
    </>
  )

  return {
    openNew: () => {
      setName('')
      setOpen(true)
    },
    openImport: () => fileInput.current?.click(),
    elements,
  }
}
