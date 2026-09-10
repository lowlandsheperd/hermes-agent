import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  handlers: new Map<string, Function>(),
  menu: [] as any[],
  quit: vi.fn(),
  empty: false,
  tray: null as any,
  directory: ''
}))
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  return {
    app: { getPath: () => electron.directory, on: vi.fn(), quit: electron.quit },
    ipcMain: { handle: (name: string, fn: Function) => electron.handlers.set(name, fn) },
    Menu: {
      buildFromTemplate: (menu: any[]) => {
        electron.menu = menu
        return menu
      }
    },
    nativeImage: { createFromPath: () => ({ isEmpty: () => electron.empty }) },
    Tray: class extends EventEmitter {
      constructor() {
        super()
        electron.tray = this
      }
      setToolTip = vi.fn()
      setContextMenu = vi.fn()
      displayBalloon = vi.fn()
      destroy = vi.fn()
    }
  }
})
import { DesktopTray } from './desktop-tray'

beforeEach(() => {
  electron.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cedar-tray-'))
  electron.empty = false
  electron.handlers.clear()
  vi.clearAllMocks()
})
afterEach(() => fs.rmSync(electron.directory, { recursive: true, force: true }))
function setup() {
  const open = vi.fn()
  const tray = new DesktopTray(open, () => 'icon.png', true)
  const window = Object.assign(new EventEmitter(), { hide: vi.fn() })
  tray.attach(window as any)
  const close = () => {
    const event = { preventDefault: vi.fn() }
    window.emit('close', event)
    return event
  }
  return { tray, window, close, open }
}
describe('desktop tray close lifecycle', () => {
  it('hides, explains once, and restores through double-click or menu', () => {
    const { close, window, open } = setup()
    expect(close().preventDefault).toHaveBeenCalledOnce()
    close()
    expect(window.hide).toHaveBeenCalledTimes(2)
    expect(electron.tray.displayBalloon).toHaveBeenCalledOnce()
    electron.tray.emit('double-click')
    electron.menu[0].click()
    expect(open).toHaveBeenCalledTimes(2)
  })
  it('allows accepted quit and Windows session end to close the window', () => {
    const { tray, close } = setup()
    electron.menu[2].click()
    expect(electron.quit).toHaveBeenCalledOnce()
    // A cancelled quit must still retain close-to-tray behavior.
    expect(close().preventDefault).toHaveBeenCalledOnce()
    tray.beginQuit()
    expect(close().preventDefault).not.toHaveBeenCalled()
    const other = setup()
    other.window.emit('query-session-end')
    expect(other.close().preventDefault).not.toHaveBeenCalled()
  })
  it('persists opting out and does not hide without a working tray', () => {
    const { close } = setup()
    electron.handlers.get('hermes:tray:set')!(null, false)
    expect(close().preventDefault).not.toHaveBeenCalled()
    setup()
    expect(electron.handlers.get('hermes:tray:get')!().closeToTray).toBe(false)
    electron.empty = true
    const unavailable = setup()
    expect(electron.handlers.get('hermes:tray:get')!().available).toBe(false)
    expect(unavailable.close().preventDefault).not.toHaveBeenCalled()
  })
})
