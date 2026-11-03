import JSZip from 'jszip'
import { normalizePath } from '@/core/fs/paths'
import { MANIFEST_PATH, parseManifest, type FileEntry } from '@/core/model/project'

/** Zip a project. Files sit at the archive root so the zip opens like a normal folder. */
export async function exportZip(files: FileEntry[]): Promise<Blob> {
  const zip = new JSZip()
  for (const f of files) {
    if (f.kind === 'folder') zip.folder(f.path)
    else zip.file(f.path, f.content)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

const MAX_FILES = 2000
const MAX_TOTAL_BYTES = 50 * 1024 * 1024

/**
 * Read a project zip. Accepts archives whose files are wrapped in a single top folder
 * (what most OS "compress folder" actions produce). Returns the name from qidea.json if present.
 */
export async function importZip(data: Blob): Promise<{ name: string | null; files: FileEntry[] }> {
  const zip = await JSZip.loadAsync(data)
  const entries = Object.values(zip.files).filter((e) => !/(^|\/)(__MACOSX|\.DS_Store)(\/|$)/.test(e.name))
  if (entries.length > MAX_FILES) throw new Error(`The zip has more than ${MAX_FILES} entries`)

  const tops = new Set(entries.map((e) => e.name.split('/')[0]))
  const strip = tops.size === 1 && entries.every((e) => e.name.includes('/')) ? `${[...tops][0]}/` : ''

  const files: FileEntry[] = []
  let total = 0
  for (const e of entries) {
    const path = normalizePath(e.name.slice(strip.length))
    if (!path) continue
    if (e.dir) {
      files.push({ path, kind: 'folder', content: '' })
      continue
    }
    const content = await e.async('string')
    total += content.length
    if (total > MAX_TOTAL_BYTES) throw new Error('The zip is larger than 50 MB')
    files.push({ path, kind: 'file', content })
  }
  // Make sure every parent folder exists as an entry.
  const known = new Set(files.map((f) => f.path))
  for (const f of [...files]) {
    const parts = f.path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      if (!known.has(dir)) {
        known.add(dir)
        files.push({ path: dir, kind: 'folder', content: '' })
      }
    }
  }
  const manifest = parseManifest(files.find((f) => f.path === MANIFEST_PATH)?.content)
  return { name: manifest?.name ?? null, files }
}
