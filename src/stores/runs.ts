import { create } from 'zustand'
import { normalizePath } from '@/core/fs/paths'
import { MANIFEST_PATH, parseManifest } from '@/core/model/project'
import {
  diffLock,
  isInternalPath,
  LOCK_PATH,
  makeLock,
  MAX_RUN_RECORDS,
  parseLock,
  parseRunRecord,
  RUNS_DIR,
  runRecordPath,
  sameResults,
  serializeLock,
  snapshotFiles,
  type RunRecord,
} from '@/core/model/runs'
import { host } from '@/extensions'
import { usePalette } from './palette'
import { useRuntime, type RunReport } from './runtime'
import { useToasts } from './toasts'
import { useWorkspace } from './workspace'

/**
 * Reproducible runs: checks the project's qidea.lock before running, records every run in
 * .qidea/runs/, writes the lock after the first successful run, and replays old runs.
 */

type LockDecision = 'locked' | 'once' | 'update' | 'cancel'

interface RunsState {
  /** Run shown in the History tab. */
  selectedId: string | null
  select: (id: string | null) => void
  /** Run a project file, honouring the lock. */
  runFile: (path?: string) => Promise<void>
  /** Re-run a recorded run with its exact Qiskit version and code snapshot. */
  reproduce: (id: string) => Promise<void>
}

/** Every run record in the open project, newest first. */
export function listRuns(): RunRecord[] {
  const { entries } = useWorkspace.getState()
  return Object.values(entries)
    .filter((e) => e.kind === 'file' && e.path.startsWith(`${RUNS_DIR}/`) && e.path.endsWith('.json'))
    .map((e) => parseRunRecord(e.content))
    .filter((r): r is RunRecord => r !== null)
    .sort((a, b) => b.at.localeCompare(a.at))
}

function projectFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  for (const e of Object.values(useWorkspace.getState().entries)) {
    if (e.kind === 'file' && !isInternalPath(e.path)) files[e.path] = e.content
  }
  return files
}

const toast = (text: string, kind?: 'info' | 'error') => useToasts.getState().push(text, kind)

/** The selected Qiskit version differs from the lock: ask what to do. */
async function askAboutLock(locked: string, selected: string, lockedAvailable: boolean): Promise<LockDecision> {
  const items = [
    ...(lockedAvailable
      ? [{ label: `Use Qiskit ${locked}`, description: 'the version in qidea.lock (recommended)', value: 'locked' as const }]
      : []),
    { label: `Run once with Qiskit ${selected}`, description: 'keep qidea.lock as it is', value: 'once' as const },
    { label: `Update qidea.lock to Qiskit ${selected}`, description: 'after this run succeeds', value: 'update' as const },
  ]
  const picked = await usePalette.getState().showQuickPick(items, {
    placeholder: lockedAvailable
      ? `This project is locked to Qiskit ${locked}. You selected ${selected}.`
      : `This project is locked to Qiskit ${locked}, which is not available here.`,
  })
  return picked?.value ?? 'cancel'
}

async function writeLock(report: RunReport, reason: 'first' | 'update') {
  const ws = useWorkspace.getState()
  const lock = makeLock(report.lock)
  await ws.writeFile(LOCK_PATH, serializeLock(lock))
  // Keep the manifest's declared version in step with the lock.
  const manifest = parseManifest(ws.entries[MANIFEST_PATH]?.content)
  if (manifest) {
    manifest.runtime ??= {}
    manifest.runtime.python ??= {}
    manifest.runtime.python.packages = { ...manifest.runtime.python.packages, qiskit: lock.packages.qiskit }
    await ws.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  toast(
    reason === 'first'
      ? `Locked this project to Qiskit ${lock.packages.qiskit}. The exact versions are in qidea.lock.`
      : `qidea.lock updated to Qiskit ${lock.packages.qiskit}.`,
  )
}

async function record(report: RunReport, files: Record<string, string>, extra: Partial<RunRecord> = {}) {
  const ws = useWorkspace.getState()
  const rec: RunRecord = {
    schemaVersion: 1,
    id: crypto.randomUUID().slice(0, 8),
    at: new Date().toISOString(),
    entry: report.entry,
    backendId: host.get('backends')[0]?.id ?? 'unknown',
    ok: report.ok,
    error: report.error,
    durationMs: Math.round(report.durationMs),
    runtime: report.lock,
    snapshot: snapshotFiles(files),
    output: report.output,
    visuals: report.visuals,
    ...extra,
  }
  await ws.writeFile(runRecordPath(rec), `${JSON.stringify(rec, null, 2)}\n`)
  // Keep the history bounded.
  const old = Object.keys(useWorkspace.getState().entries)
    .filter((p) => p.startsWith(`${RUNS_DIR}/`) && p.endsWith('.json'))
    .sort()
    .reverse()
    .slice(MAX_RUN_RECORDS)
  await ws.deleteFiles(old)
  return rec
}

export const useRuns = create<RunsState>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),

  runFile: async (path) => {
    const ws = useWorkspace.getState()
    const target = path ?? ws.active
    if (!ws.project || !target || !target.endsWith('.py')) return
    await ws.flush()

    const rt = useRuntime.getState()
    if (!rt.versions.length) await rt.init()
    const lock = parseLock(useWorkspace.getState().entries[LOCK_PATH]?.content)
    let decision: LockDecision = 'locked'
    const selected = useRuntime.getState().selected
    if (lock && selected && lock.packages.qiskit !== selected) {
      decision = await askAboutLock(lock.packages.qiskit, selected, useRuntime.getState().versions.includes(lock.packages.qiskit))
      if (decision === 'cancel') return
      if (decision === 'locked') useRuntime.getState().select(lock.packages.qiskit)
    }

    const files = projectFiles()
    const report = await useRuntime.getState().runFiles(files, normalizePath(target))
    if (!report) return

    // Same Qiskit, but something else moved (e.g. a newer Pyodide): say so.
    if (lock && decision === 'locked') {
      const diffs = diffLock(lock, report.lock).filter((d) => d.name !== 'qidea')
      if (diffs.length) {
        useRuntime
          .getState()
          .print(
            'stderr',
            `Note: this run used different versions than qidea.lock: ${diffs.map((d) => `${d.name} ${d.actual ?? '—'} (locked ${d.locked ?? '—'})`).join(', ')}`,
          )
      }
    }

    const rec = await record(report, files)
    set({ selectedId: rec.id })
    if (report.ok && !lock) await writeLock(report, 'first')
    else if (report.ok && decision === 'update') await writeLock(report, 'update')
  },

  reproduce: async (id) => {
    const original = listRuns().find((r) => r.id === id)
    if (!original) return
    const version = original.runtime.packages.qiskit
    const rt = useRuntime.getState()
    if (!rt.versions.length) await rt.init()
    if (!useRuntime.getState().versions.includes(version)) {
      toast(`Qiskit ${version} is not available in this version of QIDEA, so this run cannot be reproduced exactly.`, 'error')
      return
    }
    useRuntime.getState().select(version)
    const files = original.snapshot ?? projectFiles()
    if (!original.snapshot) toast('This run has no code snapshot (the project was too large). Using the current code.')
    const report = await useRuntime.getState().runFiles(files, original.entry)
    if (!report) return
    const identical = report.ok === original.ok && sameResults(report.visuals, original.visuals) && report.output === original.output
    const rec = await record(report, files, { reproduces: original.id, identical })
    set({ selectedId: rec.id })
    useRuntime.getState().setPanelTab('history')
    toast(
      identical
        ? `Reproduced: same output and results as the run of ${new Date(original.at).toLocaleString('en')}.`
        : 'Reproduced with the same versions, but the results differ. Unseeded randomness is the usual cause: pass seed= to make runs repeatable.',
      identical ? 'info' : 'error',
    )
  },
}))

