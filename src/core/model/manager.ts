/**
 * Project-manager model: work items placed on a (lifecycle stage × lane) board.
 * Stored as .qidea/manager.json in the project, so it travels with zip exports.
 */
import { LANES, type LaneId } from './project'

export const MANAGER_PATH = '.qidea/manager.json'

export type ItemStatus = 'todo' | 'doing' | 'review' | 'done'
export const STATUSES: ItemStatus[] = ['todo', 'doing', 'review', 'done']

/** A link from a work item to code: a file, optionally a line. */
export interface WorkLink {
  path: string
  line?: number
}

export interface WorkItem {
  id: string
  stageId: string
  lane: LaneId
  title: string
  description: string
  status: ItemStatus
  links: WorkLink[]
  createdAt: string
  updatedAt: string
}

export interface ManagerData {
  schemaVersion: 1
  /** Id of a methodology contributed by an extension (e.g. `generic`). */
  methodologyId: string
  items: WorkItem[]
}

export const emptyManager = (methodologyId = 'generic'): ManagerData => ({ schemaVersion: 1, methodologyId, items: [] })

export function parseManager(text: string | undefined): ManagerData | null {
  if (!text) return null
  try {
    const d = JSON.parse(text) as ManagerData
    if (!d || !Array.isArray(d.items)) return null
    // Be lenient with hand-edited files: drop malformed items, default missing fields.
    d.items = d.items
      .filter((i) => i && typeof i.id === 'string' && typeof i.title === 'string' && LANES.includes(i.lane))
      .map((i) => ({
        ...i,
        description: i.description ?? '',
        status: STATUSES.includes(i.status) ? i.status : 'todo',
        links: Array.isArray(i.links) ? i.links.filter((l) => l && typeof l.path === 'string') : [],
      }))
    d.methodologyId ||= 'generic'
    return d
  } catch {
    return null
  }
}

export const serializeManager = (d: ManagerData) => `${JSON.stringify(d, null, 2)}\n`

export interface Progress {
  done: number
  total: number
}

export function progressBy<K extends string>(items: WorkItem[], key: (i: WorkItem) => K): Record<K, Progress> {
  const out = {} as Record<K, Progress>
  for (const i of items) {
    const k = key(i)
    out[k] ??= { done: 0, total: 0 }
    out[k].total++
    if (i.status === 'done') out[k].done++
  }
  return out
}

/** Items whose stage is not part of the current methodology (after switching methodology). */
export const unassigned = (items: WorkItem[], stageIds: string[]) => items.filter((i) => !stageIds.includes(i.stageId))
