import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './i18n'
import { host } from './extensions'
import { BUILTIN_EXTENSIONS } from './extensions/builtin'
import { usePalette } from './stores/palette'
import { useToasts } from './stores/toasts'
import { Workbench } from './ui/shell/Workbench'

host.setUi({
  showQuickPick: (items, options) => usePalette.getState().showQuickPick(items, options),
  showMessage: (text, kind) => useToasts.getState().push(text, kind),
})

async function start() {
  for (const ext of BUILTIN_EXTENSIONS) await host.activate(ext)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Workbench />
    </StrictMode>,
  )
}

void start()
