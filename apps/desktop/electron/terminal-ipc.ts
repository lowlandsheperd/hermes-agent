// URL-only client: hermes serve exposes a chat TUI, not a shell PTY.
import { ipcMain } from 'electron'

export interface TerminalIpcDeps {
  isWindows: boolean
  findOnPath: (command: string) => null | string
  rememberLog: (line: string) => void
  activeSshTerminalTarget: (webContentsId: number) => unknown
  ensureBackend: (webContentsId: number) => Promise<unknown>
  getSshConnectionState: (scope: string) => undefined | { remotePlatform?: string }
}

export interface TerminalIpcApi {
  disposeTerminalSession: (id: string) => boolean
  disposeTerminalSessionsForSshScope: (scope: string) => void
  disposeAllTerminalSessions: () => void
}

export function registerTerminalIpc(_deps: TerminalIpcDeps): TerminalIpcApi {
  ipcMain.handle('hermes:terminal:start', async () => {
    throw new Error('Terminal is unavailable for URL connections.')
  })
  for (const action of ['attach', 'write', 'resize', 'dispose']) {
    ipcMain.handle(`hermes:terminal:${action}`, () => false)
  }
  ipcMain.handle('hermes:terminal:cwd', () => null)
  return {
    disposeTerminalSession: () => false,
    disposeTerminalSessionsForSshScope: () => {},
    disposeAllTerminalSessions: () => {}
  }
}
