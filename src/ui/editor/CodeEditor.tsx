import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useRef } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { languageFor } from '@/core/fs/paths'
import { useContributions } from '@/extensions'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { monaco } from './monacoSetup'

/** Monaco bound to the active file. One model per path keeps undo history per file. */
export default function CodeEditor({ path }: { path: string }) {
  const content = useWorkspace((s) => s.entries[path]?.content ?? '')
  const updateContent = useWorkspace((s) => s.updateContent)
  const entries = useWorkspace((s) => s.entries)
  const theme = useUi((s) => s.theme)
  const languages = useContributions('languages')
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  const language = languages.find((l) => l.extensions.includes(ext))?.id ?? languageFor(path)

  // Drop models of files that were deleted or renamed away.
  useEffect(() => {
    for (const model of monaco.editor.getModels()) {
      const p = model.uri.path.replace(/^\//, '')
      if (model.uri.scheme === 'file' && !entries[p]) model.dispose()
    }
  }, [entries])

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const reveal = useWorkspace((s) => s.reveal)

  // Jump to a line requested by openFile(path, line), e.g. from a project-manager link.
  useEffect(() => {
    const ed = editorRef.current
    if (!ed || !reveal || reveal.path !== path) return
    const line = Math.min(reveal.line, ed.getModel()?.getLineCount() ?? reveal.line)
    ed.revealLineInCenter(line)
    ed.setSelection({ startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: Number.MAX_SAFE_INTEGER })
    ed.focus()
  }, [reveal, path])

  // Shortcuts (run, palette, ...) are global extension keybindings, handled by the workbench.
  const onMount: OnMount = (editor) => {
    editorRef.current = editor
    const r = useWorkspace.getState().reveal
    if (r && r.path === path) {
      editor.revealLineInCenter(r.line)
      editor.setSelection({ startLineNumber: r.line, startColumn: 1, endLineNumber: r.line, endColumn: Number.MAX_SAFE_INTEGER })
    }
    editor.focus()
  }

  return (
    <Editor
      path={path}
      defaultLanguage={language}
      language={language}
      value={content}
      theme={theme === 'dark' ? 'qidea-dark' : 'qidea-light'}
      onChange={(v) => updateContent(path, v ?? '')}
      onMount={onMount}
      options={{
        fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
        fontSize: 13.5,
        lineHeight: 21,
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        padding: { top: 12 },
        renderLineHighlight: 'line',
        tabSize: 4,
        automaticLayout: true,
      }}
    />
  )
}
