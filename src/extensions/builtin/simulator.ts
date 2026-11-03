import type { QideaExtension } from '@/extensions/api'
import { LocalSimulatorBackend } from '@/services/backends/LocalSimulatorBackend'

export const simulatorExtension: QideaExtension = {
  id: 'qidea.simulator',
  name: 'Local simulator',
  description: `In-browser state-vector simulator. Python code uses it through qidea.LocalSimulator().`,
  version: '1.0.0',
  activate(ctx) {
    ctx.backends.register(new LocalSimulatorBackend())
  },
}
