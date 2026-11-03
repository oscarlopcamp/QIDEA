/**
 * QIDEA extension API.
 *
 * An extension is an object with an `activate(ctx)` function. Everything it contributes
 * (commands, sidebar views, languages, runtimes, backends, project templates,
 * methodologies) goes through `ctx` and is removed again when the extension is deactivated.
 *
 * In v1 every QIDEA feature is a built-in extension (src/extensions/builtin) so this API
 * is exercised by real features before third-party extensions exist.
 */
import type { ComponentType } from 'react'
import type { FileEntry } from '@/core/model/project'
import type { QuantumBackend } from '@/services/backends/types'
import type { RuntimeProvider } from '@/services/runtimes/types'

export interface Disposable {
  dispose(): void
}

export interface Command {
  /** Namespaced id, e.g. `qidea.project.new`. */
  id: string
  /** Display title; an i18n key is accepted and translated when shown. */
  title: string
  category?: string
  /** Keyboard shortcut(s): `mod` is Cmd on macOS and Ctrl elsewhere, e.g. `mod+shift+p`, `f1`. */
  keybinding?: string | string[]
  /** Hide the command (palette and keybinding) when this returns false. */
  when?: () => boolean
  run: (...args: unknown[]) => unknown
}

export type IconComponent = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>

export interface SidebarView {
  id: string
  title: string
  icon: IconComponent
  /** Position in the activity bar, ascending. */
  order: number
  component: ComponentType
}

export interface LanguageContribution {
  /** Monaco language id. */
  id: string
  /** File extensions without the dot. */
  extensions: string[]
}

export interface ProjectTemplate {
  id: string
  title: string
  description: string
  /** Build the initial files. `vars` holds at least `name` and `qiskit`. */
  instantiate(vars: Record<string, string>): FileEntry[]
}

export interface MethodologyStage {
  id: string
  title: string
  description: string
}

/** A project-lifecycle methodology: the ordered stages the project manager shows. */
export interface MethodologyTemplate {
  id: string
  title: string
  description: string
  stages: MethodologyStage[]
}

export interface QuickPickItem<T = unknown> {
  label: string
  description?: string
  detail?: string
  value: T
}

/** Contribution kinds and the type each one holds. */
export interface ContributionMap {
  commands: Command
  views: SidebarView
  languages: LanguageContribution
  runtimes: RuntimeProvider
  backends: QuantumBackend
  projectTemplates: ProjectTemplate
  methodologies: MethodologyTemplate
}
export type ContributionKind = keyof ContributionMap

export interface ExtensionContext {
  readonly extensionId: string
  commands: {
    register(command: Command): Disposable
    execute(id: string, ...args: unknown[]): Promise<unknown>
  }
  views: { register(view: SidebarView): Disposable }
  languages: { register(language: LanguageContribution): Disposable }
  runtimes: { register(runtime: RuntimeProvider): Disposable }
  backends: { register(backend: QuantumBackend): Disposable }
  projectTemplates: { register(template: ProjectTemplate): Disposable }
  methodologies: { register(methodology: MethodologyTemplate): Disposable }
  ui: {
    showQuickPick<T>(items: QuickPickItem<T>[], options?: { placeholder?: string }): Promise<QuickPickItem<T> | undefined>
    showMessage(text: string, kind?: 'info' | 'error'): void
  }
  /** Disposed automatically when the extension is deactivated. */
  subscriptions: Disposable[]
}

export interface QideaExtension {
  /** Reverse-DNS style id, e.g. `qidea.python-runtime`. */
  id: string
  name: string
  description: string
  version: string
  activate(ctx: ExtensionContext): void | Promise<void>
  deactivate?(): void
}
