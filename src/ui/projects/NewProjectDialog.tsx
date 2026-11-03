import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContributions } from '@/extensions'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { Dialog, btnPrimary, btnSecondary, inputClass } from '@/ui/common/Dialog'

/** The one "New hybrid project" dialog. Templates come from extensions. */
export function NewProjectDialog() {
  const { t } = useTranslation()
  const open = useUi((s) => s.newProjectOpen)
  const setOpen = useUi((s) => s.setNewProjectOpen)
  const createProject = useWorkspace((s) => s.createProject)
  const templates = useContributions('projectTemplates')
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset only when the dialog opens.
  useEffect(() => {
    if (open) {
      setName('')
      setTemplate('')
    }
  }, [open])
  const selectedTemplate = template || templates[0]?.id || ''

  const submit = async () => {
    if (!name.trim() || !selectedTemplate) return
    setBusy(true)
    try {
      await createProject(name.trim(), selectedTemplate)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
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
          <button type="submit" className={btnPrimary} disabled={!name.trim() || !selectedTemplate || busy}>
            {t('projects.create')}
          </button>
        </>
      }
    >
      <label className="block text-[12.5px] font-medium text-text">
        {t('projects.name')}
        <input
          className={`${inputClass} mt-1.5`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projects.namePlaceholder')}
          autoFocus
        />
      </label>
      <fieldset className="mt-4">
        <legend className="text-[12.5px] font-medium text-text">{t('projects.template')}</legend>
        <div className="mt-1.5 flex flex-col gap-2">
          {templates.map((tpl) => (
            <label
              key={tpl.id}
              className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 ${
                selectedTemplate === tpl.id ? 'border-accent bg-bg' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="template"
                value={tpl.id}
                checked={selectedTemplate === tpl.id}
                onChange={() => setTemplate(tpl.id)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-[13.5px] font-medium text-text">{t(tpl.title, { defaultValue: tpl.title })}</span>
                <span className="block text-[12.5px] leading-relaxed">{t(tpl.description, { defaultValue: tpl.description })}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  )
}
