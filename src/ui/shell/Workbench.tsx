import { Group, Panel, Separator } from 'react-resizable-panels'
import { useUi } from '@/stores/ui'
import { ActivityBar } from './ActivityBar'
import { BottomPanel } from './BottomPanel'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { WelcomeView } from './WelcomeView'
import { useIsNarrow } from './useIsNarrow'

const sep = 'bg-line transition-colors hover:bg-accent data-[separator=active]:bg-accent'

export function Workbench() {
  const sidebarOpen = useUi((s) => s.sidebarOpen)
  const narrow = useIsNarrow()

  const main = (
    <Group orientation="vertical">
      <Panel minSize={160} className="min-w-0">
        <main className="h-full w-full overflow-hidden bg-bg">
          <WelcomeView />
        </main>
      </Panel>
      <Separator className={`h-px ${sep}`} />
      <Panel defaultSize="24" minSize={80} collapsible>
        <BottomPanel />
      </Panel>
    </Group>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex min-h-0 flex-1">
        <ActivityBar />
        {narrow ? (
          <>
            <div className="min-w-0 flex-1 overflow-hidden">{main}</div>
            {sidebarOpen && (
              <div className="absolute inset-y-0 left-12 z-10 w-[min(300px,80vw)] border-r border-line shadow-2xl">
                <Sidebar />
              </div>
            )}
          </>
        ) : (
          <Group orientation="horizontal" className="min-w-0 flex-1">
            {sidebarOpen && (
              <>
                <Panel defaultSize={260} minSize={180} maxSize="45">
                  <div className="h-full border-r border-line">
                    <Sidebar />
                  </div>
                </Panel>
                <Separator className={`w-px ${sep}`} />
              </>
            )}
            <Panel minSize={300}>{main}</Panel>
          </Group>
        )}
      </div>
      <StatusBar />
    </div>
  )
}
