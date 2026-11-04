import { useMemo } from 'react'
import { create } from 'zustand'
import {
  emptyManager,
  MANAGER_PATH,
  parseManager,
  serializeManager,
  type ItemStatus,
  type ManagerData,
  type WorkItem,
  type WorkLink,
} from '@/core/model/manager'
import type { LaneId } from '@/core/model/project'
import { useUi } from './ui'
import { useWorkspace } from './workspace'

/** Board data of the open project (from .qidea/manager.json, or an empty board). */
export function readManager(): ManagerData {
  return parseManager(useWorkspace.getState().entries[MANAGER_PATH]?.content) ?? emptyManager()
}

export function useManagerData(): ManagerData {
  const text = useWorkspace((s) => s.entries[MANAGER_PATH]?.content)
  return useMemo(() => parseManager(text) ?? emptyManager(), [text])
}

async function save(mutate: (d: ManagerData) => void) {
  const data = structuredClone(readManager())
  mutate(data)
  await useWorkspace.getState().writeFile(MANAGER_PATH, serializeManager(data))
}

const now = () => new Date().toISOString()

interface ManagerState {
  /** Item open in the detail panel. */
  selectedId: string | null
  statusFilter: ItemStatus | 'all'
  select: (id: string | null) => void
  setStatusFilter: (f: ItemStatus | 'all') => void
  addItem: (stageId: string, lane: LaneId, title: string) => Promise<string>
  updateItem: (id: string, patch: Partial<Omit<WorkItem, 'id' | 'createdAt'>>) => Promise<void>
  moveItem: (id: string, stageId: string, lane: LaneId) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  addLink: (id: string, link: WorkLink) => Promise<void>
  removeLink: (id: string, index: number) => Promise<void>
  setMethodology: (methodologyId: string) => Promise<void>
  /** Leave the board and show the linked code. */
  openLink: (link: WorkLink) => void
}

export const useManager = create<ManagerState>((set) => ({
  selectedId: null,
  statusFilter: 'all',
  select: (id) => set({ selectedId: id }),
  setStatusFilter: (f) => set({ statusFilter: f }),

  addItem: async (stageId, lane, title) => {
    const id = crypto.randomUUID().slice(0, 8)
    const t = now()
    await save((d) => {
      d.items.push({ id, stageId, lane, title: title.trim(), description: '', status: 'todo', links: [], createdAt: t, updatedAt: t })
    })
    return id
  },

  updateItem: (id, patch) =>
    save((d) => {
      const i = d.items.find((x) => x.id === id)
      if (i) Object.assign(i, patch, { updatedAt: now() })
    }),

  moveItem: (id, stageId, lane) =>
    save((d) => {
      const i = d.items.find((x) => x.id === id)
      if (i && (i.stageId !== stageId || i.lane !== lane)) Object.assign(i, { stageId, lane, updatedAt: now() })
    }),

  deleteItem: async (id) => {
    await save((d) => {
      d.items = d.items.filter((x) => x.id !== id)
    })
    set((s) => (s.selectedId === id ? { selectedId: null } : s))
  },

  addLink: (id, link) =>
    save((d) => {
      const i = d.items.find((x) => x.id === id)
      if (i && !i.links.some((l) => l.path === link.path && l.line === link.line)) {
        i.links.push(link)
        i.updatedAt = now()
      }
    }),

  removeLink: (id, index) =>
    save((d) => {
      const i = d.items.find((x) => x.id === id)
      if (i) {
        i.links.splice(index, 1)
        i.updatedAt = now()
      }
    }),

  setMethodology: (methodologyId) =>
    save((d) => {
      d.methodologyId = methodologyId
    }),

  openLink: (link) => {
    const ws = useWorkspace.getState()
    if (ws.entries[link.path]?.kind !== 'file') return
    useUi.getState().setMode('code')
    ws.openFile(link.path, link.line)
  },
}))
