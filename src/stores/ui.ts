import { create } from 'zustand'

export type ViewId = 'explorer' | 'manager' | 'learn' | 'lifecycle' | 'extensions'
export type Theme = 'dark' | 'light'

interface UiState {
  activeView: ViewId
  sidebarOpen: boolean
  theme: Theme
  setActiveView: (view: ViewId) => void
  toggleTheme: () => void
}

function readTheme(): Theme {
  const t = document.documentElement.dataset.theme
  return t === 'light' ? 'light' : 'dark'
}

export const useUi = create<UiState>((set, get) => ({
  activeView: 'explorer',
  // On phones the sidebar is an overlay, so start with it closed.
  sidebarOpen: !matchMedia('(max-width: 767px)').matches,
  theme: readTheme(),
  // Clicking the active view collapses the sidebar, as in VS Code.
  setActiveView: (view) =>
    set((s) =>
      s.activeView === view ? { sidebarOpen: !s.sidebarOpen } : { activeView: view, sidebarOpen: true },
    ),
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
}))
