/** Where project files are written inside the Pyodide file system. */
export const PROJECT_DIR = '/home/pyodide/project'

/**
 * Drop Pyodide's internal frames from a traceback and show project paths relative,
 * so users only see their own files (and library frames that point at real code).
 */
export function cleanTraceback(tb: string): string {
  const out: string[] = []
  let skipping = false
  for (const line of tb.split('\n')) {
    if (line.startsWith('  File ')) skipping = /"\/lib\/python[\d.]+\.zip\/_pyodide\/|"<exec>"/.test(line)
    else if (!line.startsWith('    ')) skipping = false
    if (!skipping) out.push(line)
  }
  return out.join('\n').replaceAll(`${PROJECT_DIR}/`, '')
}
