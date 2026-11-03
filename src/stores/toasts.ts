import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

interface ToastState {
  toasts: Toast[]
  push: (text: string, kind?: 'info' | 'error') => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (text, kind = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }))
    setTimeout(() => get().dismiss(id), kind === 'error' ? 8000 : 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
