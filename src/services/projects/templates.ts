import type { FileEntry } from '@/core/model/project'

// Templates live in /content/templates/<id>/ as plain files, bundled as text.
const raw = import.meta.glob('/content/templates/**/*', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

/** Instantiate a template: its files with {{placeholders}} filled in. */
export function instantiateTemplate(id: string, vars: Record<string, string>): FileEntry[] {
  const prefix = `/content/templates/${id}/`
  const files: FileEntry[] = []
  const folders = new Set<string>()
  for (const [key, text] of Object.entries(raw)) {
    if (!key.startsWith(prefix)) continue
    // Bundlers skip dot-folders, so templates store ".qidea/" as "_qidea/".
    const path = key.slice(prefix.length).replace(/^_qidea\//, '.qidea/')
    const content = text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m)
    files.push({ path, kind: 'file', content })
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join('/'))
  }
  if (!files.length) throw new Error(`Unknown template: ${id}`)
  return [...[...folders].map((path): FileEntry => ({ path, kind: 'folder', content: '' })), ...files]
}
