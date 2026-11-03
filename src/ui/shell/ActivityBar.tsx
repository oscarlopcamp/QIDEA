import { Blocks, Files, FlaskConical, GraduationCap, Moon, SquareKanban, Sun, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUi, type ViewId } from '@/stores/ui'
import { QideaMark } from '@/ui/brand/Logo'

const VIEWS: { id: ViewId; icon: LucideIcon }[] = [
  { id: 'explorer', icon: Files },
  { id: 'manager', icon: SquareKanban },
  { id: 'learn', icon: GraduationCap },
  { id: 'lifecycle', icon: FlaskConical },
  { id: 'extensions', icon: Blocks },
]

export function ActivityBar() {
  const { t } = useTranslation()
  const { activeView, sidebarOpen, setActiveView, theme, toggleTheme } = useUi()

  return (
    <nav
      aria-label="Views"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-2"
    >
      <div className="mb-2 grid h-9 w-9 place-items-center" title="QIDEA">
        <QideaMark size={24} />
      </div>
      {VIEWS.map(({ id, icon: Icon }) => {
        const active = activeView === id && sidebarOpen
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            aria-label={t(`views.${id}`)}
            aria-pressed={active}
            title={t(`views.${id}`)}
            className={`relative grid h-10 w-10 place-items-center rounded-md transition-colors ${
              active ? 'text-text' : 'text-muted hover:text-text'
            }`}
          >
            {active && <span className="absolute left-[-4px] h-6 w-0.5 rounded-full bg-accent" />}
            <Icon size={20} strokeWidth={1.75} />
          </button>
        )
      })}
      <div className="flex-1" />
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t('status.themeToLight') : t('status.themeToDark')}
        title={theme === 'dark' ? t('status.themeToLight') : t('status.themeToDark')}
        className="grid h-10 w-10 place-items-center rounded-md text-muted hover:text-text"
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
      </button>
    </nav>
  )
}
