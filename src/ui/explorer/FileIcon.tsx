import { File, FileCode2, FileJson, FileText } from 'lucide-react'

/** File icon by extension. Python files use the quantum accent: they are what users run. */
export function FileIcon({ path }: { path: string }) {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  const common = { size: 14, strokeWidth: 1.75, className: 'shrink-0' }
  if (ext === 'py') return <FileCode2 {...common} className="shrink-0 text-quantum" />
  if (ext === 'json') return <FileJson {...common} className="shrink-0 text-integration" />
  if (ext === 'md' || ext === 'txt') return <FileText {...common} className="shrink-0 text-muted" />
  return <File {...common} className="shrink-0 text-muted" />
}
