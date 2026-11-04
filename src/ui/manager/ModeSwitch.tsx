import { Code2, SquareKanban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUi, type WorkbenchMode } from '@/stores/ui'

/** Code and Manager are two modes of the same project. */
export function ModeSwitch() {
  const { t } = useTranslation()
  const mode = useUi((s) => s.mode)
  const setMode = useUi((s) => s.setMode)
  const modes: { id: WorkbenchMode; icon: typeof Code2 }[] = [
    { id: 'code', icon: Code2 },
    { id: 'manager', icon: SquareKanban },
  ]
  return (
    <div role="radiogroup" aria-label={t('mode.label')} className="m-1 flex shrink-0 rounded-md bg-bg p-0.5" data-tour="mode-switch">
      {modes.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => setMode(id)}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[12.5px] ${
            mode === id ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:text-text'
          }`}
        >
          <Icon size={13} />
          {t(`mode.${id}`)}
        </button>
      ))}
    </div>
  )
}
