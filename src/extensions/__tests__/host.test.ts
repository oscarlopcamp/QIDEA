import { describe, expect, it, vi } from 'vitest'
import type { QideaExtension } from '../api'
import { ExtensionHost } from '../host'

const ext = (id: string, activate: QideaExtension['activate']): QideaExtension => ({
  id,
  name: id,
  description: '',
  version: '1.0.0',
  activate,
})

describe('ExtensionHost', () => {
  it('registers contributions and counts them per extension', async () => {
    const host = new ExtensionHost()
    await host.activate(
      ext('a', (ctx) => {
        ctx.commands.register({ id: 'a.hello', title: 'Hello', run: () => 'hi' })
        ctx.methodologies.register({ id: 'm', title: 'M', description: '', stages: [] })
      }),
    )
    expect(host.get('commands').map((c) => c.id)).toEqual(['a.hello'])
    expect(host.extensions()[0].contributions).toEqual({ commands: 1, methodologies: 1 })
    expect(await host.executeCommand('a.hello')).toBe('hi')
  })

  it('removes everything an extension contributed when it is deactivated', async () => {
    const host = new ExtensionHost()
    const deactivate = vi.fn()
    await host.activate({
      ...ext('a', (ctx) => {
        ctx.commands.register({ id: 'a.x', title: 'X', run: () => {} })
        ctx.languages.register({ id: 'python', extensions: ['py'] })
      }),
      deactivate,
    })
    host.deactivate('a')
    expect(deactivate).toHaveBeenCalled()
    expect(host.get('commands')).toEqual([])
    expect(host.get('languages')).toEqual([])
    expect(host.extensions()).toEqual([])
  })

  it('rolls back a failing extension without affecting the others', async () => {
    const host = new ExtensionHost()
    const showMessage = vi.fn()
    host.setUi({ showQuickPick: async () => undefined, showMessage })
    await host.activate(ext('good', (ctx) => void ctx.commands.register({ id: 'good.x', title: 'X', run: () => {} })))
    await host.activate(
      ext('bad', (ctx) => {
        ctx.commands.register({ id: 'bad.x', title: 'X', run: () => {} })
        throw new Error('boom')
      }),
    )
    expect(host.get('commands').map((c) => c.id)).toEqual(['good.x'])
    const bad = host.extensions().find((s) => s.extension.id === 'bad')!
    expect(bad.state).toBe('failed')
    expect(bad.error).toBe('boom')
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('boom'), 'error')
  })

  it('rejects duplicate ids', async () => {
    const host = new ExtensionHost()
    host.setUi({ showQuickPick: async () => undefined, showMessage: () => {} })
    await host.activate(ext('a', (ctx) => void ctx.commands.register({ id: 'dup', title: 'X', run: () => {} })))
    await host.activate(ext('b', (ctx) => void ctx.commands.register({ id: 'dup', title: 'Y', run: () => {} })))
    expect(host.extensions().find((s) => s.extension.id === 'b')?.state).toBe('failed')
    expect(host.get('commands')).toHaveLength(1)
  })

  it('skips commands whose `when` is false and reports command errors', async () => {
    const host = new ExtensionHost()
    const showMessage = vi.fn()
    host.setUi({ showQuickPick: async () => undefined, showMessage })
    const run = vi.fn()
    await host.activate(
      ext('a', (ctx) => {
        ctx.commands.register({ id: 'a.hidden', title: 'H', when: () => false, run })
        ctx.commands.register({
          id: 'a.throws',
          title: 'T',
          run: () => {
            throw new Error('nope')
          },
        })
      }),
    )
    await host.executeCommand('a.hidden')
    expect(run).not.toHaveBeenCalled()
    await host.executeCommand('a.throws')
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('nope'), 'error')
    await expect(host.executeCommand('missing')).rejects.toThrow('Unknown command')
  })

  it('notifies subscribers on every change', async () => {
    const host = new ExtensionHost()
    const listener = vi.fn()
    host.subscribe(listener)
    const before = host.getVersion()
    await host.activate(ext('a', (ctx) => void ctx.languages.register({ id: 'json', extensions: ['json'] })))
    expect(host.getVersion()).toBeGreaterThan(before)
    expect(listener).toHaveBeenCalled()
  })
})
