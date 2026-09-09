import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { AlertTriangle, ExternalLink, RefreshCw } from '@/lib/icons'
import { $desktopVersion, refreshDesktopVersion } from '@/store/updates'

import { SectionHeading, SettingsContent } from './primitives'

const RELEASE_NOTES_URL = 'https://github.com/lowlandsheperd/hermes-agent/releases'
const INSTALLER_URL = RELEASE_NOTES_URL

export function AboutSettings() {
  const { t } = useI18n()
  const a = t.settings.about
  const version = useStore($desktopVersion)
  // The version atom is loaded once at app boot, which makes About show a
  // stale number after a self-update (the running binary is current, the
  // displayed string is not). Re-read on mount so opening About always
  // reflects the running build.
  useEffect(() => {
    void refreshDesktopVersion()
  }, [])

  return (
    <SettingsContent>
      <div className="flex flex-col items-center gap-3 pt-6 pb-2 text-center">
        <BrandMark className="size-16" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{a.heading}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {version?.appVersion ? a.version(version.appVersion) : a.versionUnavailable}
          </p>
        </div>
        {(version?.bundleOutOfSync || version?.bundleSwapPending) && (
          <div className="mx-auto w-full max-w-2xl rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                {version?.bundleSwapPending ? (
                  // The updated app is already on disk — the updater swapped it
                  // under this running process — so a restart loads it. Saying
                  // "App build out of date" here would repeat the contradiction
                  // this banner is meant to resolve: the Updates card below
                  // already reports the runtime as current.
                  <>
                    <p className="font-medium">{a.bundleSwapPending}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.bundleSwapPendingDesc}</p>
                    <Button
                      className="mt-2"
                      onClick={() => void window.hermesDesktop?.relaunchApp?.()}
                      size="sm"
                      variant="textStrong"
                    >
                      <RefreshCw className="size-3" />
                      {a.bundleSwapPendingAction}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-medium">{a.bundleOutOfSync}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.bundleOutOfSyncDesc}</p>
                    <Button asChild className="mt-2" size="sm" variant="textStrong">
                      <a
                        href={INSTALLER_URL}
                        onClick={event => {
                          event.preventDefault()
                          void window.hermesDesktop?.openExternal?.(INSTALLER_URL)
                        }}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-3" />
                        {a.bundleOutOfSyncAction}
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto mt-4 w-full max-w-2xl">
        <SectionHeading icon={RefreshCw} title={a.updates} />

        <Button onClick={() => void window.hermesDesktop?.openExternal(RELEASE_NOTES_URL)} variant="link">
          {a.releaseNotes}
        </Button>
      </div>
    </SettingsContent>
  )
}
