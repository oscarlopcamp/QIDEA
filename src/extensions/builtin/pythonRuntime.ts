import type { QideaExtension } from '@/extensions/api'
import { PyodideRuntime } from '@/services/runtimes/PyodideRuntime'
import { useRuntime } from '@/stores/runtime'
import { listRuns, useRuns } from '@/stores/runs'
import { useUi } from '@/stores/ui'

export const pythonRuntimeExtension: QideaExtension = {
  id: 'qidea.python-runtime',
  name: 'Python runtime (Pyodide + Qiskit)',
  description: 'Runs Python and Qiskit in your browser, with selectable Qiskit versions.',
  version: '1.0.0',
  activate(ctx) {
    ctx.runtimes.register(new PyodideRuntime())

    ctx.commands.register({
      id: 'qidea.qiskit.selectVersion',
      title: 'commands.selectQiskitVersion',
      category: 'Qiskit',
      run: async () => {
        const rt = useRuntime.getState()
        if (!rt.versions.length) await rt.init()
        const { versions, selected, loadedVersion } = useRuntime.getState()
        const picked = await ctx.ui.showQuickPick(
          versions.map((v, i) => ({
            label: `Qiskit ${v}`,
            description: [i === 0 ? 'latest' : '', v === selected ? 'selected' : '', v === loadedVersion ? 'loaded' : '']
              .filter(Boolean)
              .join(' · '),
            value: v,
          })),
          { placeholder: 'Select the Qiskit version for this session' },
        )
        if (picked) useRuntime.getState().select(picked.value)
      },
    })

    ctx.commands.register({
      id: 'qidea.qiskit.check',
      title: 'commands.runQiskitCheck',
      category: 'Qiskit',
      run: () => useRuntime.getState().runCheck(),
    })

    ctx.commands.register({
      id: 'qidea.runs.showHistory',
      title: 'commands.showRunHistory',
      category: 'commands.categoryRun',
      run: () => {
        useUi.getState().setPanelOpen(true)
        useRuntime.getState().setPanelTab('history')
      },
    })

    ctx.commands.register({
      id: 'qidea.runs.reproduceLast',
      title: 'commands.reproduceLastRun',
      category: 'commands.categoryRun',
      when: () => listRuns().length > 0,
      run: () => useRuns.getState().reproduce(listRuns()[0].id),
    })

    ctx.commands.register({
      id: 'qidea.output.clear',
      title: 'commands.clearOutput',
      category: 'Output',
      run: () => useRuntime.getState().clearOutput(),
    })
  },
}
