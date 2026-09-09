import { expect, test, vi } from 'vitest'
import { registerTerminalIpc } from './terminal-ipc'
const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>())
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn) }
}))

test('URL client rejects terminal start without resolving or launching any backend', async () => {
  const backend = vi.fn()
  const api = registerTerminalIpc({
    isWindows: false,
    findOnPath: backend,
    rememberLog: backend,
    activeSshTerminalTarget: backend,
    ensureBackend: backend,
    getSshConnectionState: backend
  })
  await expect(handlers.get('hermes:terminal:start')!({}, { cwd: '/server/work' })).rejects.toThrow('unavailable')
  expect(backend).not.toHaveBeenCalled()
  for (const action of ['attach', 'write', 'resize', 'dispose']) {
    expect(handlers.get(`hermes:terminal:${action}`)!({}, 'old-terminal')).toBe(false)
  }
  expect(handlers.get('hermes:terminal:cwd')!({}, 'old-terminal')).toBeNull()
  expect(api.disposeTerminalSession('old-terminal')).toBe(false)
})
