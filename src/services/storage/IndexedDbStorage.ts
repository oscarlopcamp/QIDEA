import Dexie, { type Table } from 'dexie'
import { isInside } from '@/core/fs/paths'
import type { FileEntry, ProjectMeta } from '@/core/model/project'
import type { StorageProvider } from './types'

interface FileRow extends FileEntry {
  projectId: string
  updatedAt: number
}

class QideaDb extends Dexie {
  projects!: Table<ProjectMeta, string>
  files!: Table<FileRow, [string, string]>

  constructor() {
    super('qidea')
    this.version(1).stores({
      projects: 'id, updatedAt',
      files: '[projectId+path], projectId',
    })
  }
}

const strip = ({ path, kind, content }: FileRow): FileEntry => ({ path, kind, content })

export class IndexedDbStorage implements StorageProvider {
  private db = new QideaDb()

  async listProjects() {
    return (await this.db.projects.orderBy('updatedAt').reverse().toArray())
  }

  getProject(id: string) {
    return this.db.projects.get(id)
  }

  async putProject(meta: ProjectMeta, files: FileEntry[]) {
    const now = Date.now()
    await this.db.transaction('rw', this.db.projects, this.db.files, async () => {
      await this.db.files.where('projectId').equals(meta.id).delete()
      await this.db.projects.put(meta)
      await this.db.files.bulkPut(files.map((f) => ({ ...f, projectId: meta.id, updatedAt: now })))
    })
  }

  async touchProject(id: string) {
    await this.db.projects.update(id, { updatedAt: Date.now() })
  }

  async renameProject(id: string, name: string) {
    await this.db.projects.update(id, { name, updatedAt: Date.now() })
  }

  async deleteProject(id: string) {
    await this.db.transaction('rw', this.db.projects, this.db.files, async () => {
      await this.db.files.where('projectId').equals(id).delete()
      await this.db.projects.delete(id)
    })
  }

  async listFiles(projectId: string) {
    return (await this.db.files.where('projectId').equals(projectId).toArray()).map(strip)
  }

  async writeFile(projectId: string, entry: FileEntry) {
    const now = Date.now()
    await this.db.transaction('rw', this.db.projects, this.db.files, async () => {
      await this.db.files.put({ ...entry, projectId, updatedAt: now })
      await this.db.projects.update(projectId, { updatedAt: now })
    })
  }

  async deleteFiles(projectId: string, paths: string[]) {
    await this.db.files.bulkDelete(paths.map((p) => [projectId, p] as [string, string]))
    await this.touchProject(projectId)
  }

  async movePath(projectId: string, from: string, to: string) {
    await this.db.transaction('rw', this.db.projects, this.db.files, async () => {
      const rows = await this.db.files
        .where('projectId')
        .equals(projectId)
        .filter((r) => isInside(r.path, from))
        .toArray()
      await this.db.files.bulkDelete(rows.map((r) => [projectId, r.path] as [string, string]))
      await this.db.files.bulkPut(rows.map((r) => ({ ...r, path: to + r.path.slice(from.length), updatedAt: Date.now() })))
      await this.db.projects.update(projectId, { updatedAt: Date.now() })
    })
  }
}
