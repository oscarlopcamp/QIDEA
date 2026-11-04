/**
 * Reproducibility model: the project lock file and run records.
 * Pure data and helpers: no browser APIs, so a server can share them.
 */

/** Exact runtime versions (same shape as the runtime reports). */
export interface RuntimeLockData {
  pyodide: string
  python: string
  packages: Record<string, string>
}

/** qidea.lock: written automatically after the first successful hybrid run. */
export interface LockFile extends RuntimeLockData {
  schemaVersion: 1
  /** ISO timestamp of when the lock was written. */
  lockedAt: string
}

export const LOCK_PATH = 'qidea.lock'
export const QIDEA_DIR = '.qidea'
export const RUNS_DIR = '.qidea/runs'
export const MAX_RUN_RECORDS = 50
/** Code snapshots larger than this are not stored in a run record. */
export const MAX_SNAPSHOT_BYTES = 512 * 1024

/** Paths QIDEA manages itself: hidden from the explorer and never part of a code snapshot. */
export const isInternalPath = (p: string) => p === QIDEA_DIR || p.startsWith(`${QIDEA_DIR}/`)

export function parseLock(text: string | undefined): LockFile | null {
  if (!text) return null
  try {
    const l = JSON.parse(text) as LockFile
    return l && typeof l.packages === 'object' && typeof l.packages.qiskit === 'string' ? l : null
  } catch {
    return null
  }
}

export function makeLock(lock: RuntimeLockData, now = new Date()): LockFile {
  const packages = Object.fromEntries(Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b)))
  return { schemaVersion: 1, lockedAt: now.toISOString(), pyodide: lock.pyodide, python: lock.python, packages }
}

export const serializeLock = (l: LockFile) => `${JSON.stringify(l, null, 2)}\n`

export interface VersionDiff {
  name: string
  locked: string | undefined
  actual: string | undefined
}

/** Differences between the locked versions and the ones a run actually used. */
export function diffLock(locked: RuntimeLockData, actual: RuntimeLockData): VersionDiff[] {
  const out: VersionDiff[] = []
  if (locked.pyodide !== actual.pyodide) out.push({ name: 'pyodide', locked: locked.pyodide, actual: actual.pyodide })
  if (locked.python !== actual.python) out.push({ name: 'python', locked: locked.python, actual: actual.python })
  const names = new Set([...Object.keys(locked.packages), ...Object.keys(actual.packages)])
  for (const name of [...names].sort()) {
    if (locked.packages[name] !== actual.packages[name]) {
      out.push({ name, locked: locked.packages[name], actual: actual.packages[name] })
    }
  }
  return out
}

export interface RunRecord {
  schemaVersion: 1
  id: string
  /** ISO timestamp. */
  at: string
  entry: string
  backendId: string
  ok: boolean
  error?: string
  durationMs: number
  runtime: RuntimeLockData
  /** The project's code at run time (absent if it was too large). */
  snapshot?: Record<string, string>
  /** Printed output (truncated). */
  output: string
  /** Charts and circuits the run produced. */
  visuals: unknown[]
  /** Set when this run reproduced an earlier one. */
  reproduces?: string
  /** For reproductions: did the results match the original exactly? */
  identical?: boolean
}

export const runRecordPath = (r: Pick<RunRecord, 'id' | 'at'>) =>
  `${RUNS_DIR}/${r.at.replace(/[:.]/g, '-')}-${r.id}.json`

export function parseRunRecord(text: string | undefined): RunRecord | null {
  if (!text) return null
  try {
    const r = JSON.parse(text) as RunRecord
    return r && typeof r.id === 'string' && typeof r.entry === 'string' && r.runtime ? r : null
  } catch {
    return null
  }
}

/** Canonical JSON (sorted keys) so equal results compare equal regardless of key order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export const sameResults = (a: unknown[], b: unknown[]) => canonical(a) === canonical(b)

/** Snapshot the project code for a run record, or undefined when it is too large. */
export function snapshotFiles(files: Record<string, string>): Record<string, string> | undefined {
  let size = 0
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    if (isInternalPath(path) || path === LOCK_PATH) continue
    size += content.length
    if (size > MAX_SNAPSHOT_BYTES) return undefined
    out[path] = content
  }
  return out
}
