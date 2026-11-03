import { useTranslation } from 'react-i18next'
import { useContributions } from '@/extensions'
import { useUi } from '@/stores/ui'

/** Renders whichever sidebar view an extension registered under the active id. */
export function Sidebar() {
  const { t } = useTranslation()
  const activeView = useUi((s) => s.activeView)
  const view = useContributions('views').find((v) => v.id === activeView)
  if (!view) return <aside className="h-full bg-surface" />
  const View = view.component
  return (
    <aside className="flex h-full flex-col bg-surface" aria-label={t(view.title, { defaultValue: view.title })}>
      <View />
    </aside>
  )
}
