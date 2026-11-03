import type { FileEntry, ProjectMeta } from '@/core/model/project'

/**
 * Persistence for projects and their files. The browser implementation uses IndexedDB;
 * a server implementation can replace it without touching the UI.
 */
export interface StorageProvider {
  listProjects(): Promise<ProjectMeta[]>
  getProject(id: string): Promise<ProjectMeta | undefined>
  /** Create or replace a project and all of its files atomically. */
  putProject(meta: ProjectMeta, files: FileEntry[]): Promise<void>
  touchProject(id: string): Promise<void>
  renameProject(id: string, name: string): Promise<void>
  deleteProject(id: string): Promise<void>

  listFiles(projectId: string): Promise<FileEntry[]>
  writeFile(projectId: string, entry: FileEntry): Promise<void>
  deleteFiles(projectId: string, paths: string[]): Promise<void>
  /** Move a file or a whole folder (every path under it). */
  movePath(projectId: string, from: string, to: string): Promise<void>
}
