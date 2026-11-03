import type {
  ContributionKind,
  ContributionMap,
  Disposable,
  ExtensionContext,
  QideaExtension,
  QuickPickItem,
} from './api'

interface Registered<K extends ContributionKind> {
  owner: string
  item: ContributionMap[K]
}

export interface ExtensionStatus {
  extension: QideaExtension
  state: 'active' | 'failed'
  error?: string
  contributions: Partial<Record<ContributionKind, number>>
}

/** UI services the host needs from the app shell (set by the UI layer at startup). */
export interface HostUi {
  showQuickPick<T>(items: QuickPickItem<T>[], options?: { placeholder?: string }): Promise<QuickPickItem<T> | undefined>
  showMessage(text: string, kind?: 'info' | 'error'): void
}

const KINDS: ContributionKind[] = [
  'commands',
  'views',
  'languages',
  'runtimes',
  'backends',
  'projectTemplates',
  'methodologies',
]

/**
 * Activates extensions and keeps the registries of what they contribute.
 * Framework-free: React subscribes through `subscribe`/`getVersion`.
 */
export class ExtensionHost {
  private registries = new Map<ContributionKind, Registered<ContributionKind>[]>(KINDS.map((k) => [k, []]))
  private statuses = new Map<string, ExtensionStatus>()
  private contexts = new Map<string, ExtensionContext>()
  private listeners = new Set<() => void>()
  private version = 0
  private ui: HostUi = {
    showQuickPick: async () => undefined,
    showMessage: (text, kind) => (kind === 'error' ? console.error(text) : console.info(text)),
  }

  setUi(ui: HostUi) {
    this.ui = ui
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getVersion = () => this.version

  private changed() {
    this.version++
    for (const l of this.listeners) l()
  }

  private cache = new Map<ContributionKind, { version: number; items: unknown[] }>()

  /** Contributions of one kind. The array is stable until the registry changes (safe for React deps). */
  get<K extends ContributionKind>(kind: K): ContributionMap[K][] {
    const hit = this.cache.get(kind)
    if (hit && hit.version === this.version) return hit.items as ContributionMap[K][]
    const items = (this.registries.get(kind) as Registered<K>[]).map((r) => r.item)
    this.cache.set(kind, { version: this.version, items })
    return items
  }

  find<K extends ContributionKind>(kind: K, id: string): ContributionMap[K] | undefined {
    return this.get(kind).find((x) => (x as { id: string }).id === id)
  }

  ownerOf(kind: ContributionKind, id: string): string | undefined {
    return this.registries.get(kind)!.find((r) => (r.item as { id: string }).id === id)?.owner
  }

  private extCache: { version: number; list: ExtensionStatus[] } | null = null

  extensions(): ExtensionStatus[] {
    if (this.extCache?.version !== this.version) {
      this.extCache = { version: this.version, list: [...this.statuses.values()].map((s) => ({ ...s, contributions: { ...s.contributions } })) }
    }
    return this.extCache.list
  }

  private register<K extends ContributionKind>(owner: string, kind: K, item: ContributionMap[K]): Disposable {
    const list = this.registries.get(kind)!
    const id = (item as { id: string }).id
    if (list.some((r) => (r.item as { id: string }).id === id)) {
      throw new Error(`${kind} "${id}" is already registered`)
    }
    const entry: Registered<ContributionKind> = { owner, item }
    list.push(entry)
    const status = this.statuses.get(owner)
    if (status) status.contributions[kind] = (status.contributions[kind] ?? 0) + 1
    this.changed()
    return {
      dispose: () => {
        const i = list.indexOf(entry)
        if (i < 0) return
        list.splice(i, 1)
        const s = this.statuses.get(owner)
        if (s) s.contributions[kind] = Math.max(0, (s.contributions[kind] ?? 1) - 1)
        this.changed()
      },
    }
  }

  async executeCommand(id: string, ...args: unknown[]): Promise<unknown> {
    const cmd = this.find('commands', id)
    if (!cmd) throw new Error(`Unknown command: ${id}`)
    if (cmd.when && !cmd.when()) return undefined
    try {
      return await cmd.run(...args)
    } catch (err) {
      this.ui.showMessage(`Command "${id}" failed: ${(err as Error).message}`, 'error')
      return undefined
    }
  }

  private createContext(ext: QideaExtension): ExtensionContext {
    const reg =
      <K extends ContributionKind>(kind: K) =>
      (item: ContributionMap[K]) => {
        const d = this.register(ext.id, kind, item)
        ctx.subscriptions.push(d)
        return d
      }
    const ctx: ExtensionContext = {
      extensionId: ext.id,
      commands: { register: reg('commands'), execute: (id, ...args) => this.executeCommand(id, ...args) },
      views: { register: reg('views') },
      languages: { register: reg('languages') },
      runtimes: { register: reg('runtimes') },
      backends: { register: reg('backends') },
      projectTemplates: { register: reg('projectTemplates') },
      methodologies: { register: reg('methodologies') },
      ui: {
        showQuickPick: (items, options) => this.ui.showQuickPick(items, options),
        showMessage: (text, kind) => this.ui.showMessage(text, kind),
      },
      subscriptions: [],
    }
    return ctx
  }

  /** Activate an extension. A failing extension is recorded and rolled back; others keep working. */
  async activate(ext: QideaExtension): Promise<void> {
    if (this.statuses.get(ext.id)?.state === 'active') return
    const status: ExtensionStatus = { extension: ext, state: 'active', contributions: {} }
    this.statuses.set(ext.id, status)
    const ctx = this.createContext(ext)
    this.contexts.set(ext.id, ctx)
    try {
      await ext.activate(ctx)
    } catch (err) {
      for (const d of ctx.subscriptions.splice(0)) d.dispose()
      status.state = 'failed'
      status.error = err instanceof Error ? err.message : String(err)
      this.ui.showMessage(`Extension "${ext.name}" failed to activate: ${status.error}`, 'error')
    }
    this.changed()
  }

  deactivate(id: string) {
    const ctx = this.contexts.get(id)
    const status = this.statuses.get(id)
    if (!ctx || !status) return
    try {
      status.extension.deactivate?.()
    } finally {
      for (const d of ctx.subscriptions.splice(0).reverse()) d.dispose()
      this.contexts.delete(id)
      this.statuses.delete(id)
      this.changed()
    }
  }
}
