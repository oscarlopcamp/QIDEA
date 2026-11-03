import { create } from 'zustand'
import type { QuickPickItem } from '@/extensions/api'

export type PaletteMode = 'commands' | 'files' | 'pick'

interface PickRequest {
  items: QuickPickItem[]
  placeholder?: string
  resolve: (item: QuickPickItem | undefined) => void
}

interface PaletteState {
  open: boolean
  mode: PaletteMode
  initialQuery: string
  pick: PickRequest | null
  openCommands: () => void
  openFiles: () => void
  showQuickPick: <T>(items: QuickPickItem<T>[], options?: { placeholder?: string }) => Promise<QuickPickItem<T> | undefined>
  close: (picked?: QuickPickItem) => void
}

export const usePalette = create<PaletteState>((set, get) => {
  const cancelPending = () => get().pick?.resolve(undefined)
  return {
    open: false,
    mode: 'commands',
    initialQuery: '',
    pick: null,

    openCommands: () => {
      cancelPending()
      set({ open: true, mode: 'commands', initialQuery: '>', pick: null })
    },
    openFiles: () => {
      cancelPending()
      set({ open: true, mode: 'files', initialQuery: '', pick: null })
    },
    showQuickPick: (items, options) =>
      new Promise((resolve) => {
        cancelPending()
        set({
          open: true,
          mode: 'pick',
          initialQuery: '',
          pick: { items, placeholder: options?.placeholder, resolve: resolve as PickRequest['resolve'] },
        })
      }),
    close: (picked) => {
      get().pick?.resolve(picked)
      set({ open: false, pick: null })
    },
  }
})

/** Subsequence fuzzy match. Higher is better; null when not a match. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const t = text.toLowerCase()
  const direct = t.indexOf(q)
  if (direct >= 0) return 1000 - direct - t.length / 100
  let score = 0
  let ti = 0
  let streak = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found < 0) return null
    streak = found === ti ? streak + 1 : 0
    score += 10 + streak * 5 - (found - ti)
    ti = found + 1
  }
  return score - t.length / 100
}
