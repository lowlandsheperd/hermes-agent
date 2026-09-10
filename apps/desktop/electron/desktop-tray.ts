import fs from 'node:fs'
import path from 'node:path'

import { app, type BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron'

/** Main-window close policy. Secondary chat windows retain their normal close behavior. */
export class DesktopTray {
  private tray: Tray | null = null
  private quitting = false
  private settings = { closeToTray: true, noticeShown: false }
  private readonly settingsPath = path.join(app.getPath('userData'), 'desktop-tray.json')

  constructor(
    private readonly open: () => void,
    private readonly icon: () => string | undefined,
    private readonly supported = process.platform === 'win32'
  ) {
    try {
      const saved = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'))
      this.settings.closeToTray = saved.closeToTray !== false
      this.settings.noticeShown = saved.noticeShown === true
    } catch {
      /* First launch uses defaults. */
    }
    ipcMain.handle('hermes:tray:get', () => this.status())
    ipcMain.handle('hermes:tray:set', (_event, enabled: unknown) => {
      if (typeof enabled !== 'boolean') throw new Error('closeToTray must be boolean')
      const next = { ...this.settings, closeToTray: enabled }
      fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true })
      fs.writeFileSync(this.settingsPath, JSON.stringify(next), 'utf8')
      this.settings = next
      return this.status()
    })
    app.on('will-quit', () => this.tray?.destroy())
  }

  private status() {
    return { closeToTray: this.settings.closeToTray, available: this.tray !== null }
  }

  beginQuit() {
    this.quitting = true
  }

  attach(window: BrowserWindow) {
    // A failed/missing tray must never leave the app hidden with no way back.
    if (this.supported && !this.tray) {
      try {
        const iconPath = this.icon()
        if (iconPath) {
          const image = nativeImage.createFromPath(iconPath)
          if (!image.isEmpty()) {
            this.tray = new Tray(image)
            this.tray.setToolTip('CEDAR AGENT')
            this.tray.setContextMenu(
              Menu.buildFromTemplate([
                { label: '打开 CEDAR AGENT', click: this.open },
                { type: 'separator' },
                { label: '退出', click: () => app.quit() }
              ])
            )
            this.tray.on('double-click', this.open)
          }
        }
      } catch {
        this.tray?.destroy()
        this.tray = null
      }
    }
    window.on('query-session-end', () => this.beginQuit())
    window.on('close', event => {
      if (this.quitting || !this.tray || !this.settings.closeToTray) return
      event.preventDefault()
      window.hide()
      if (!this.settings.noticeShown) {
        this.tray.displayBalloon({
          title: 'CEDAR AGENT',
          content: '已隐藏到系统托盘。双击图标恢复窗口，右键菜单可退出。'
        })
        this.settings.noticeShown = true
        try {
          fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings), 'utf8')
        } catch {
          /* Non-critical notice preference. */
        }
      }
    })
  }
}
