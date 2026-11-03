import { useEffect } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import { host } from '@/extensions'
import { matchesKeybinding } from '@/extensions/keybindings'
import { useRuntime } from '@/stores/runtime'
import { useUi } from '@/stores/ui'
import { Toasts } from '@/ui/common/Toasts'
import { CommandPalette } from '@/ui/palette/CommandPalette'
import { NewProjectDialog } from '@/ui/projects/NewProjectDialog'
import { useWorkspace } from '@/stores/workspace'
import { EditorArea } from '@/ui/editor/EditorArea'
import { ActivityBar } from './ActivityBar'
import { BottomPanel } from './BottomPanel'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { useIsNarrow } from './useIsNarrow'

const sep = 'bg-line transition-colors hover:bg-accent data-[separator=active]:bg-accent'

export function Workbench() {
  const sidebarOpen = useUi((s) => s.sidebarOpen)
  const narrow = useIsNarrow()
  const init = useWorkspace((s) => s.init)

  const panelOpen = useUi((s) => s.panelOpen)
  const setPanelOpen = useUi((s) => s.setPanelOpen)
  const panelRef = usePanelRef()

  useEffect(() => {
    void init()
  }, [init])

  // Global shortcuts from extension commands. Capture phase so they win over Monaco's own.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      for (const cmd of host.get('commands')) {
        if (!cmd.keybinding) continue
        if (![cmd.keybinding].flat().some((k) => matchesKeybinding(e, k))) continue
        if (cmd.when && !cmd.when()) continue
        e.preventDefault()
        e.stopPropagation()
        void host.executeCommand(cmd.id)
        return
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Results need room: when they arrive, grow a short panel (never shrink one the user enlarged).
  const panelTab = useRuntime((s) => s.panelTab)
  useEffect(() => {
    const p = panelRef.current
    if (panelTab !== 'results' || !p) return
    if (p.isCollapsed()) p.expand()
    if (p.getSize().inPixels < 360) p.resize(380)
  }, [panelTab, panelRef])

  // Keep the bottom panel in sync with the store (commands toggle it; users can drag it closed).
  useEffect(() => {
    const p = panelRef.current
    if (!p) return
    if (panelOpen && p.isCollapsed()) p.expand()
    if (!panelOpen && !p.isCollapsed()) p.collapse()
  }, [panelOpen, panelRef])

  const main = (
    <Group orientation="vertical">
      <Panel minSize={160} className="min-w-0">
        <main className="h-full w-full overflow-hidden bg-bg">
          <EditorArea />
        </main>
      </Panel>
      <Separator className={`h-px ${sep}`} />
      <Panel
        defaultSize="24"
        minSize={80}
        collapsible
        panelRef={panelRef}
        onResize={() => {
          const collapsed = panelRef.current?.isCollapsed() ?? false
          if (collapsed === useUi.getState().panelOpen) setPanelOpen(!collapsed)
        }}
      >
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
      <CommandPalette />
      <NewProjectDialog />
      <Toasts />
    </div>
  )
}
