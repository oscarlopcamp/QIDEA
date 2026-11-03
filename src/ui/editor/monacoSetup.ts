/**
 * Bundle Monaco locally (no CDN) and register QIDEA's themes.
 * Imported only by the lazily-loaded editor, so it never slows down the first paint.
 */
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'

self.MonacoEnvironment = {
  getWorker: (_id: string, label: string) => (label === 'json' ? new JsonWorker() : new EditorWorker()),
}

loader.config({ monaco })

// Hex values mirror the CSS tokens in src/styles/index.css (Monaco needs literal colours).
monaco.editor.defineTheme('qidea-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '7d80a8', fontStyle: 'italic' },
    { token: 'string', foreground: '3cc6b4' },
    { token: 'number', foreground: 'f2b544' },
    { token: 'keyword', foreground: '9fb3ff' },
    { token: 'type', foreground: 'f2b544' },
  ],
  colors: {
    'editor.background': '#161a33',
    'editor.foreground': '#ecebf7',
    'editorLineNumber.foreground': '#4a5084',
    'editorLineNumber.activeForeground': '#9a9cc0',
    'editor.lineHighlightBackground': '#1d2142',
    'editor.selectionBackground': '#3a4180',
    'editorCursor.foreground': '#f2b544',
    'editorIndentGuide.background1': '#252a52',
    'editorWidget.background': '#1d2142',
    'editorWidget.border': '#2f3563',
  },
})

monaco.editor.defineTheme('qidea-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6d7196', fontStyle: 'italic' },
    { token: 'string', foreground: '0f8a7b' },
    { token: 'number', foreground: 'a26a06' },
    { token: 'keyword', foreground: '3a5bd9' },
    { token: 'type', foreground: 'a26a06' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1a1d38',
    'editorLineNumber.foreground': '#b3b7d1',
    'editorLineNumber.activeForeground': '#5d6188',
    'editor.lineHighlightBackground': '#f3f4fa',
    'editorCursor.foreground': '#b27508',
  },
})

export { monaco }
