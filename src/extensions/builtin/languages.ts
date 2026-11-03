import type { QideaExtension } from '@/extensions/api'

export const languagesExtension: QideaExtension = {
  id: 'qidea.languages',
  name: 'Basic languages',
  description: 'Syntax highlighting for Python, OpenQASM, JSON, Markdown and config files.',
  version: '1.0.0',
  activate(ctx) {
    ctx.languages.register({ id: 'python', extensions: ['py'] })
    ctx.languages.register({ id: 'json', extensions: ['json'] })
    ctx.languages.register({ id: 'markdown', extensions: ['md'] })
    ctx.languages.register({ id: 'yaml', extensions: ['yaml', 'yml'] })
    ctx.languages.register({ id: 'ini', extensions: ['toml', 'ini', 'cfg'] })
    // OpenQASM gets a proper grammar with the simulator in a later phase.
    ctx.languages.register({ id: 'plaintext', extensions: ['qasm', 'txt'] })
  },
}
