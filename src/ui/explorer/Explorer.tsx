import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  ChevronRight,
  Download,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { buildTree, dirname, type TreeNode } from '@/core/fs/paths'
import { MANIFEST_PATH, parseManifest, type LaneId } from '@/core/model/project'
import { useUi } from '@/stores/ui'
import { useWorkspace, type FsError } from '@/stores/workspace'
import { Dialog, btnDanger, btnSecondary } from '@/ui/common/Dialog'
import { FileIcon } from './FileIcon'
import { NoProject } from './NoProject'

type Editing =
  | { mode: 'new'; kind: 'file' | 'folder'; dir: string }
  | { mode: 'rename'; path: string }
  | null

const LANE_COLOR: Record<LaneId, string> = {
  classical: 'var(--lane-classical)',
  quantum: 'var(--lane-quantum)',
  integration: 'var(--lane-integration)',
}

export function Explorer() {
  const { t } = useTranslation()
  const ws = useWorkspace()
  const [editing, setEditing] = useState<Editing>(null)
  const [error, setError] = useState<FsError | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const request = useUi((s) => s.explorerRequest)

  const tree = useMemo(() => buildTree(Object.values(ws.entries)), [ws.entries])
  const laneOf = useMemo(() => {
    const lanes = parseManifest(ws.entries[MANIFEST_PATH]?.content)?.lanes ?? {}
    const map = new Map<string, LaneId>()
    for (const [lane, folder] of Object.entries(lanes)) if (folder) map.set(folder.replace(/\/$/, ''), lane as LaneId)
    return map
  }, [ws.entries])

  // "New file" / "New folder" commands from the palette.
  useEffect(() => {
    if (request) startNew(request.kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  if (!ws.project) return <NoProject />

  function targetDir() {
    if (!selected) return ''
    return ws.entries[selected]?.kind === 'folder' ? selected : dirname(selected)
  }

  function startNew(kind: 'file' | 'folder') {
    const dir = targetDir()
    if (dir) ws.toggleFolder(dir, true)
    setError(null)
    setEditing({ mode: 'new', kind, dir })
  }

  const commit = async (value: string) => {
    if (!editing) return
    const err =
      editing.mode === 'new'
        ? await ws.createEntry(editing.dir, value, editing.kind)
        : await ws.renameEntry(editing.path, value)
    if (err) setError(err)
    else {
      setEditing(null)
      setError(null)
    }
  }

  const onItemKey = (e: KeyboardEvent, node: TreeNode) => {
    if (e.key === 'F2') {
      e.preventDefault()
      setEditing({ mode: 'rename', path: node.path })
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) {
      e.preventDefault()
      setConfirmDelete(node.path)
    }
  }

  const renderInput = (depth: number, initial: string, kind: 'file' | 'folder') => (
    <div style={{ paddingLeft: 12 + depth * 12 }} className="py-0.5 pr-2">
      <div className="flex items-center gap-1.5">
        {kind === 'folder' ? <Folder size={14} className="shrink-0 text-muted" /> : <FileIcon path={initial || 'x.py'} />}
        <input
          autoFocus
          defaultValue={initial}
          aria-label={kind === 'folder' ? t('explorer.folderName') : t('explorer.fileName')}
          onFocus={(e) => {
            const dot = e.target.value.lastIndexOf('.')
            e.target.setSelectionRange(0, dot > 0 && kind === 'file' ? dot : e.target.value.length)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit(e.currentTarget.value)
            if (e.key === 'Escape') {
              setEditing(null)
              setError(null)
            }
          }}
          onBlur={() => {
            setEditing(null)
            setError(null)
          }}
          className={`min-w-0 flex-1 rounded border bg-bg px-1.5 py-0.5 text-[13px] text-text outline-none ${
            error ? 'border-danger' : 'border-accent'
          }`}
        />
      </div>
      {error && <p className="mt-1 text-[12px] text-danger">{t(`explorer.errors.${error}`)}</p>}
    </div>
  )

  const renderNodes = (nodes: TreeNode[], depth: number, dir: string) => (
    <>
      {editing?.mode === 'new' && editing.dir === dir && renderInput(depth, '', editing.kind)}
      {nodes.map((node) => {
        if (editing?.mode === 'rename' && editing.path === node.path)
          return <div key={node.path}>{renderInput(depth, node.name, node.kind)}</div>
        const open = ws.expanded.includes(node.path)
        const lane = node.kind === 'folder' ? laneOf.get(node.path) : undefined
        const isActive = ws.active === node.path
        return (
          <div key={node.path}>
            <div
              className={`group flex items-center pr-1 ${
                isActive ? 'bg-surface-2 text-text' : selected === node.path ? 'bg-surface-2/60' : 'hover:bg-surface-2/60'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(node.path)
                  if (node.kind === 'folder') ws.toggleFolder(node.path)
                  else ws.openFile(node.path)
                }}
                onDoubleClick={() => setEditing({ mode: 'rename', path: node.path })}
                onKeyDown={(e) => onItemKey(e, node)}
                aria-expanded={node.kind === 'folder' ? open : undefined}
                title={node.path}
                style={{ paddingLeft: 8 + depth * 12 }}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-[3px] text-left text-[13px] text-text"
              >
                {node.kind === 'folder' ? (
                  <>
                    <ChevronRight
                      size={13}
                      className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
                    />
                    {open ? (
                      <FolderOpen size={14} className="shrink-0" style={{ color: lane ? LANE_COLOR[lane] : 'var(--muted)' }} />
                    ) : (
                      <Folder size={14} className="shrink-0" style={{ color: lane ? LANE_COLOR[lane] : 'var(--muted)' }} />
                    )}
                  </>
                ) : (
                  <>
                    <span className="w-[13px] shrink-0" />
                    <FileIcon path={node.path} />
                  </>
                )}
                <span className="truncate">{node.name}</span>
                {lane && lane !== node.name.toLowerCase() && (
                  <span className="ml-1 truncate text-[11.5px] text-muted">{t(`lanes.${lane}`)}</span>
                )}
              </button>
              <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                <IconBtn label={t('explorer.rename')} onClick={() => setEditing({ mode: 'rename', path: node.path })}>
                  <Pencil size={12.5} />
                </IconBtn>
                <IconBtn label={t('explorer.delete')} onClick={() => setConfirmDelete(node.path)}>
                  <Trash2 size={12.5} />
                </IconBtn>
              </div>
            </div>
            {node.kind === 'folder' && open && renderNodes(node.children, depth + 1, node.path)}
          </div>
        )
      })}
    </>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-3 pb-1 pt-2.5">
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text" title={ws.project.name}>
          {ws.project.name}
        </h2>
        <IconBtn label={t('explorer.newFile')} onClick={() => startNew('file')}>
          <FilePlus2 size={15} />
        </IconBtn>
        <IconBtn label={t('explorer.newFolder')} onClick={() => startNew('folder')}>
          <FolderPlus size={15} />
        </IconBtn>
        <IconBtn label={t('explorer.export')} onClick={() => void ws.exportProject()}>
          <Download size={15} />
        </IconBtn>
        <IconBtn label={t('explorer.closeProject')} onClick={() => void ws.closeProject()}>
          <X size={15} />
        </IconBtn>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto pb-4"
        role="tree"
        aria-label={t('views.explorer')}
        onClick={(e) => e.target === e.currentTarget && setSelected(null)}
      >
        {renderNodes(tree, 0, '')}
      </div>
      <p className="border-t border-line px-3 py-2 text-[11.5px] text-muted">
        {ws.saving ? t('explorer.saving') : t('explorer.saved')}
      </p>

      <Dialog
        open={confirmDelete !== null}
        title={t('explorer.deleteTitle', { name: confirmDelete ?? '' })}
        onClose={() => setConfirmDelete(null)}
        onSubmit={() => {
          if (confirmDelete) void ws.deleteEntry(confirmDelete)
          setConfirmDelete(null)
        }}
        actions={
          <>
            <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className={btnDanger} autoFocus>
              {t('explorer.delete')}
            </button>
          </>
        }
      >
        {ws.entries[confirmDelete ?? '']?.kind === 'folder' ? t('explorer.deleteFolderBody') : t('explorer.deleteFileBody')}
      </Dialog>
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text"
    >
      {children}
    </button>
  )
}
