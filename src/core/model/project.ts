/** Project model shared by every layer. Pure data: no React, no browser APIs. */

export const PROJECT_SCHEMA_VERSION = 1

export type LaneId = 'classical' | 'quantum' | 'integration'
export const LANES: LaneId[] = ['classical', 'quantum', 'integration']

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** Template the project was created from, if any. */
  template?: string
}

export type EntryKind = 'file' | 'folder'

/** One node of a project's virtual file system. Folders are stored so empty ones survive. */
export interface FileEntry {
  path: string
  kind: EntryKind
  content: string
}

/** The project manifest, stored as qidea.json at the project root. */
export interface QideaManifest {
  name: string
  schemaVersion: number
  /** File run by default (e.g. integration/main.py). */
  entry?: string
  runtime?: {
    python?: { packages?: Record<string, string> }
  }
  /** Folder that holds each lane's code. */
  lanes?: Partial<Record<LaneId, string>>
}

export const MANIFEST_PATH = 'qidea.json'

export function parseManifest(text: string | undefined): QideaManifest | null {
  if (!text) return null
  try {
    const m = JSON.parse(text) as QideaManifest
    return typeof m === 'object' && m && typeof m.name === 'string' ? m : null
  } catch {
    return null
  }
}
