import { useEffect, useState } from 'react'

import { GatewaySettings } from '@/app/settings/gateway-settings'
import { useI18n } from '@/i18n'

export function DesktopInstallOverlay({ enabled = true }: { enabled?: boolean }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const desktop = window.hermesDesktop

    if (!enabled || !desktop?.onBootstrapEvent) {
      return
    }

    let cancelled = false
    void desktop
      .getBootstrapState()
      .then(state => {
        if (!cancelled) {
          setVisible(Boolean(state?.setupChoice))
        }
      })
      .catch(() => undefined)

    const off = desktop.onBootstrapEvent(event => {
      if (event.type === 'setup-choice') {
        setVisible(event.active)
      }

      if (event.type === 'dismissed') {
        setVisible(false)
      }
    })

    return () => {
      cancelled = true
      off?.()
    }
  }, [enabled])

  if (!enabled || !visible) {
    return null
  }

  return (
    <div className="fixed inset-0 z-(--z-setup) flex items-center justify-center overflow-y-auto bg-background/90 p-4 backdrop-blur-md">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-(--stroke-nous) bg-card p-8 shadow-nous">
        <h2 className="mb-4 text-xl font-semibold">{t.install.connectExistingTitle}</h2>
        <GatewaySettings embedded />
      </div>
    </div>
  )
}
