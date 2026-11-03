/** Path helpers for the project virtual file system. Paths are relative, '/'-separated, no leading slash. */

export function normalizePath(p: string): string {
  const parts: string[] = []
  for (const seg of p.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

export const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1)
export const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
export const joinPath = (dir: string, name: string) => normalizePath(dir ? `${dir}/${name}` : name)
export const isInside = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`)

/** Invalid name characters for files and folders, kept portable across OSes and zip tools. */
export function validateName(name: string): 'empty' | 'invalid' | null {
  const n = name.trim()
  if (!n) return 'empty'
  if (n === '.' || n === '..' || /[\\/:*?"<>|]/.test(n)) return 'invalid'
  return null
}

export interface TreeNode {
  name: string
  path: string
  kind: 'file' | 'folder'
  children: TreeNode[]
}

/** Build a sorted tree (folders first, then files, alphabetical) from flat entries. */
export function buildTree(entries: { path: string; kind: 'file' | 'folder' }[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', kind: 'folder', children: [] }
  const folders = new Map<string, TreeNode>([['', root]])

  const ensureFolder = (path: string): TreeNode => {
    const existing = folders.get(path)
    if (existing) return existing
    const node: TreeNode = { name: basename(path), path, kind: 'folder', children: [] }
    folders.set(path, node)
    ensureFolder(dirname(path)).children.push(node)
    return node
  }

  for (const e of entries) {
    if (e.kind === 'folder') ensureFolder(e.path)
    else ensureFolder(dirname(e.path)).children.push({ name: basename(e.path), path: e.path, kind: 'file', children: [] })
  }

  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1))
    n.children.forEach(sort)
  }
  sort(root)
  return root.children
}

export function languageFor(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return (
    {
      py: 'python',
      json: 'json',
      md: 'markdown',
      ts: 'typescript',
      js: 'javascript',
      qasm: 'plaintext',
      toml: 'ini',
      yaml: 'yaml',
      yml: 'yaml',
      txt: 'plaintext',
    }[ext] ?? 'plaintext'
  )
}
