/// <reference types="vite/client" />
declare const __APP_VERSION__: string

declare module 'monaco-editor/editor/editor.worker.js?worker' {
  const W: new () => Worker
  export default W
}
declare module 'monaco-editor/language/json/json.worker.js?worker' {
  const W: new () => Worker
  export default W
}

declare module '*.py?raw' {
  const src: string
  export default src
}
