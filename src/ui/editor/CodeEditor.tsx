import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useRef } from 'react'
import { languageFor } from '@/core/fs/paths'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { monaco } from './monacoSetup'

/** Monaco bound to the active file. One model per path keeps undo history per file. */
export default function CodeEditor({ path }: { path: string }) {
  const content = useWorkspace((s) => s.entries[path]?.content ?? '')
  const updateContent = useWorkspace((s) => s.updateContent)
  const entries = useWorkspace((s) => s.entries)
  const theme = useUi((s) => s.theme)
  const runRef = useRef(useWorkspace.getState().runFile)

  // Drop models of files that were deleted or renamed away.
  useEffect(() => {
    for (const model of monaco.editor.getModels()) {
      const p = model.uri.path.replace(/^\//, '')
      if (model.uri.scheme === 'file' && !entries[p]) model.dispose()
    }
  }, [entries])

  const onMount: OnMount = (editor) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void runRef.current())
    editor.focus()
  }

  return (
    <Editor
      path={path}
      defaultLanguage={languageFor(path)}
      language={languageFor(path)}
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
