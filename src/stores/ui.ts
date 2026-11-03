import { create } from 'zustand'

export type Theme = 'dark' | 'light'

/** A request for the explorer to start creating a file/folder (from a command). */
export interface ExplorerRequest {
  kind: 'file' | 'folder'
  nonce: number
}

interface UiState {
  /** Id of the active sidebar view, as registered by an extension. */
  activeView: string
  sidebarOpen: boolean
  panelOpen: boolean
  theme: Theme
  newProjectOpen: boolean
  explorerRequest: ExplorerRequest | null
  setActiveView: (view: string) => void
  showView: (view: string) => void
  toggleSidebar: () => void
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  toggleTheme: () => void
  setNewProjectOpen: (open: boolean) => void
  requestExplorerNew: (kind: 'file' | 'folder') => void
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export const useUi = create<UiState>((set, get) => ({
  activeView: 'explorer',
  // On phones the sidebar is an overlay, so start with it closed.
  sidebarOpen: !matchMedia('(max-width: 767px)').matches,
  panelOpen: true,
  theme: readTheme(),
  newProjectOpen: false,
  explorerRequest: null,

  // Clicking the active view collapses the sidebar, as in VS Code.
  setActiveView: (view) =>
    set((s) => (s.activeView === view ? { sidebarOpen: !s.sidebarOpen } : { activeView: view, sidebarOpen: true })),
  showView: (view) => set({ activeView: view, sidebarOpen: true }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('qidea.theme', theme)
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    set({ theme })
  },
  setNewProjectOpen: (open) => set({ newProjectOpen: open }),
  requestExplorerNew: (kind) => set({ explorerRequest: { kind, nonce: Date.now() } }),
}))
