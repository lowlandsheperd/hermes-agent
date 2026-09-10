import { useEffect, useState } from 'react'

import { useI18n } from '@/i18n'

import { ToggleRow } from './primitives'

export function TraySetting() {
  const { locale } = useI18n()
  const [state, setState] = useState<{ closeToTray: boolean; available: boolean } | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const zh = locale.startsWith('zh')
  useEffect(() => {
    void window.hermesDesktop?.tray
      ?.getSettings()
      .then(setState)
      .catch(() => setError(true))
  }, [])
  if (!state?.available) return null
  return (
    <ToggleRow
      checked={state.closeToTray}
      disabled={saving}
      label={zh ? '关闭窗口时最小化到托盘' : 'Close window to system tray'}
      description={
        error
          ? zh
            ? '保存失败，请重试。'
            : 'Could not save. Please try again.'
          : zh
            ? '保持远程连接；通过托盘菜单退出客户端。'
            : 'Keep the remote connection active. Quit using the tray menu.'
      }
      onChange={enabled => {
        setSaving(true)
        setError(false)
        void window.hermesDesktop.tray
          .setSettings(enabled)
          .then(setState)
          .catch(() => setError(true))
          .finally(() => setSaving(false))
      }}
    />
  )
}
