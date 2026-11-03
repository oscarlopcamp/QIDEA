import { create } from 'zustand'
import { basename, dirname, isInside, joinPath, normalizePath, validateName } from '@/core/fs/paths'
import {
  MANIFEST_PATH,
  parseManifest,
  type EntryKind,
  type FileEntry,
  type ProjectMeta,
} from '@/core/model/project'
import { host } from '@/extensions'
import { exportZip, importZip } from '@/services/projects/zip'
import { storage } from '@/services/storage'
import { useRuntime } from './runtime'

const LAST_PROJECT_KEY = 'qidea.lastProject'
const sessionKey = (id: string) => `qidea.session.${id}`
const SAVE_DELAY_MS = 400

interface Session {
  tabs: string[]
  active: string | null
  expanded: string[]
}

function readLocal<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the session just won't be restored */
  }
}

export type FsError = 'empty' | 'invalid' | 'exists'

interface WorkspaceState {
  ready: boolean
  projects: ProjectMeta[]
  project: ProjectMeta | null
  entries: Record<string, FileEntry>
  tabs: string[]
  active: string | null
  expanded: string[]
  saving: boolean

  init: () => Promise<void>
  refreshProjects: () => Promise<void>
  createProject: (name: string, template: string) => Promise<void>
  openProject: (id: string) => Promise<void>
  closeProject: () => Promise<void>
  deleteProject: (id: string) => Promise<void>
  renameProject: (name: string) => Promise<void>
  exportProject: () => Promise<void>
  importProject: (file: File) => Promise<void>

  createEntry: (dir: string, name: string, kind: EntryKind) => Promise<FsError | null>
  renameEntry: (path: string, newName: string) => Promise<FsError | null>
  deleteEntry: (path: string) => Promise<void>
  updateContent: (path: string, content: string) => void
  flush: () => Promise<void>

  openFile: (path: string) => void
  closeTab: (path: string) => void
  toggleFolder: (path: string, open?: boolean) => void
  runFile: (path?: string) => Promise<void>
}

const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>()

export const useWorkspace = create<WorkspaceState>((set, get) => {
  const persistSession = () => {
    const { project, tabs, active, expanded } = get()
    if (project) writeLocal(sessionKey(project.id), { tabs, active, expanded } satisfies Session)
  }

  const saveNow = async (path: string) => {
    pendingSaves.delete(path)
    const { project, entries } = get()
    const entry = entries[path]
    if (!project || !entry) return
    await storage.writeFile(project.id, entry)
    if (pendingSaves.size === 0) set({ saving: false })
  }

  /** Pick the Qiskit version the project declares, when that version is published. */
  const syncRuntimeVersion = async (entries: Record<string, FileEntry>) => {
    const wanted = parseManifest(entries[MANIFEST_PATH]?.content)?.runtime?.python?.packages?.qiskit
    if (!wanted) return
    const rt = useRuntime.getState()
    if (!rt.versions.length) await rt.init()
    if (useRuntime.getState().versions.includes(wanted)) useRuntime.getState().select(wanted)
  }

  const load = async (meta: ProjectMeta) => {
    const list = await storage.listFiles(meta.id)
    const entries = Object.fromEntries(list.map((f) => [f.path, f]))
    const session = readLocal<Session>(sessionKey(meta.id))
    const manifest = parseManifest(entries[MANIFEST_PATH]?.content)
    const tabs = (session?.tabs ?? []).filter((p) => entries[p]?.kind === 'file')
    let active = session?.active && tabs.includes(session.active) ? session.active : (tabs[0] ?? null)
    // First open: show the entry file so there is code on screen straight away.
    if (!session && manifest?.entry && entries[manifest.entry]) {
      tabs.push(manifest.entry)
      active = manifest.entry
    }
    const expanded = session?.expanded ?? list.filter((f) => f.kind === 'folder' && !f.path.includes('/')).map((f) => f.path)
    set({ project: meta, entries, tabs, active, expanded })
    writeLocal(LAST_PROJECT_KEY, meta.id)
    persistSession()
    await syncRuntimeVersion(entries)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return {
    ready: false,
    projects: [],
    project: null,
    entries: {},
    tabs: [],
    active: null,
    expanded: [],
    saving: false,

    init: async () => {
      await get().refreshProjects()
      const last = readLocal<string>(LAST_PROJECT_KEY)
      const meta = last ? get().projects.find((p) => p.id === last) : undefined
      if (meta) await load(meta)
      set({ ready: true })
    },

    refreshProjects: async () => set({ projects: await storage.listProjects() }),

    createProject: async (name, template) => {
      await get().flush()
      const rt = useRuntime.getState()
      if (!rt.versions.length) await rt.init()
      const qiskit = useRuntime.getState().selected ?? ''
      const now = Date.now()
      const meta: ProjectMeta = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, template }
      const tpl = host.find('projectTemplates', template)
      if (!tpl) throw new Error(`Unknown project template: ${template}`)
      await storage.putProject(meta, tpl.instantiate({ name, qiskit }))
      await get().refreshProjects()
      await load(meta)
    },

    openProject: async (id) => {
      await get().flush()
      const meta = await storage.getProject(id)
      if (!meta) return
      await storage.touchProject(id)
      await load(meta)
      await get().refreshProjects()
    },

    closeProject: async () => {
      await get().flush()
      writeLocal(LAST_PROJECT_KEY, null)
      set({ project: null, entries: {}, tabs: [], active: null, expanded: [] })
      await get().refreshProjects()
    },

    deleteProject: async (id) => {
      if (get().project?.id === id) await get().closeProject()
      await storage.deleteProject(id)
      writeLocal(sessionKey(id), null)
      await get().refreshProjects()
    },

    renameProject: async (name) => {
      const p = get().project
      if (!p || !name.trim()) return
      await storage.renameProject(p.id, name.trim())
      set({ project: { ...p, name: name.trim() } })
      await get().refreshProjects()
    },

    exportProject: async () => {
      await get().flush()
      const p = get().project
      if (!p) return
      const blob = await exportZip(Object.values(get().entries))
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
      downloadBlob(blob, `${slug}.zip`)
    },

    importProject: async (file) => {
      await get().flush()
      const { name, files } = await importZip(file)
      const now = Date.now()
      const meta: ProjectMeta = {
        id: crypto.randomUUID(),
        name: name ?? file.name.replace(/\.zip$/i, ''),
        createdAt: now,
        updatedAt: now,
      }
      await storage.putProject(meta, files)
      await get().refreshProjects()
      await load(meta)
    },

    createEntry: async (dir, name, kind) => {
      const err = validateName(name)
      if (err) return err
      const p = get().project
      if (!p) return 'invalid'
      const path = joinPath(dir, name.trim())
      if (get().entries[path]) return 'exists'
      // Typing "folder/file.py" creates the missing folders too.
      const created: FileEntry[] = []
      const parts = path.split('/')
      for (let i = 1; i < parts.length; i++) {
        const d = parts.slice(0, i).join('/')
        if (!get().entries[d]) created.push({ path: d, kind: 'folder', content: '' })
      }
      created.push({ path, kind, content: '' })
      for (const e of created) await storage.writeFile(p.id, e)
      set((s) => ({
        entries: { ...s.entries, ...Object.fromEntries(created.map((e) => [e.path, e])) },
        expanded: [...new Set([...s.expanded, ...created.filter((e) => e.kind === 'folder').map((e) => e.path), dir].filter(Boolean))],
      }))
      if (kind === 'file') get().openFile(path)
      persistSession()
      return null
    },

    renameEntry: async (path, newName) => {
      const err = validateName(newName)
      if (err) return err
      const p = get().project
      if (!p) return 'invalid'
      const to = joinPath(dirname(path), newName.trim())
      if (to === path) return null
      if (get().entries[to]) return 'exists'
      await get().flush()
      await storage.movePath(p.id, path, to)
      const move = (x: string) => (isInside(x, path) ? to + x.slice(path.length) : x)
      set((s) => ({
        entries: Object.fromEntries(Object.values(s.entries).map((e) => [move(e.path), { ...e, path: move(e.path) }])),
        tabs: s.tabs.map(move),
        active: s.active ? move(s.active) : null,
        expanded: s.expanded.map(move),
      }))
      persistSession()
      return null
    },

    deleteEntry: async (path) => {
      const p = get().project
      if (!p) return
      const doomed = Object.keys(get().entries).filter((x) => isInside(x, path))
      for (const d of doomed) {
        clearTimeout(pendingSaves.get(d))
        pendingSaves.delete(d)
      }
      await storage.deleteFiles(p.id, doomed)
      set((s) => {
        const entries = { ...s.entries }
        for (const d of doomed) delete entries[d]
        const tabs = s.tabs.filter((t) => !isInside(t, path))
        const active = s.active && !isInside(s.active, path) ? s.active : (tabs[tabs.length - 1] ?? null)
        return { entries, tabs, active, expanded: s.expanded.filter((x) => !isInside(x, path)) }
      })
      persistSession()
    },

    updateContent: (path, content) => {
      const entry = get().entries[path]
      if (!entry || entry.content === content) return
      set((s) => ({ entries: { ...s.entries, [path]: { ...entry, content } }, saving: true }))
      clearTimeout(pendingSaves.get(path))
      pendingSaves.set(
        path,
        setTimeout(() => void saveNow(path), SAVE_DELAY_MS),
      )
    },

    flush: async () => {
      const paths = [...pendingSaves.keys()]
      for (const path of paths) {
        clearTimeout(pendingSaves.get(path))
        await saveNow(path)
      }
    },

    openFile: (path) => {
      if (get().entries[path]?.kind !== 'file') return
      set((s) => ({
        tabs: s.tabs.includes(path) ? s.tabs : [...s.tabs, path],
        active: path,
        // Reveal the file in the explorer.
        expanded: [...new Set([...s.expanded, ...ancestors(path)])],
      }))
      persistSession()
    },

    closeTab: (path) => {
      set((s) => {
        const i = s.tabs.indexOf(path)
        const tabs = s.tabs.filter((t) => t !== path)
        const active = s.active === path ? (tabs[Math.min(i, tabs.length - 1)] ?? null) : s.active
        return { tabs, active }
      })
      persistSession()
    },

    toggleFolder: (path, open) => {
      set((s) => {
        const isOpen = s.expanded.includes(path)
        const next = open ?? !isOpen
        return { expanded: next ? [...new Set([...s.expanded, path])] : s.expanded.filter((x) => x !== path) }
      })
      persistSession()
    },

    runFile: async (path) => {
      const target = path ?? get().active
      if (!target || !target.endsWith('.py')) return
      await get().flush()
      const files: Record<string, string> = {}
      for (const e of Object.values(get().entries)) if (e.kind === 'file') files[e.path] = e.content
      await useRuntime.getState().runFiles(files, normalizePath(target))
    },
  }
})

function ancestors(path: string): string[] {
  const out: string[] = []
  let d = dirname(path)
  while (d) {
    out.push(d)
    d = dirname(d)
  }
  return out
}

// Save pending edits if the tab is closed mid-debounce.
if (typeof window !== 'undefined') {
  const flush = () => void useWorkspace.getState().flush()
  window.addEventListener('beforeunload', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
}

export { basename }
