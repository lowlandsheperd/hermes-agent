/** URL client: version information only; no client or server update lifecycle. */
import type {
  DesktopUpdateApplyOptions,
  DesktopUpdateApplyResult,
  DesktopUpdateBlocker,
  DesktopUpdateStage,
  DesktopUpdateStatus,
  DesktopVersionInfo
} from '@/global'
import { atom } from 'nanostores'

export interface UpdateApplyState {
  applying: boolean
  stage: DesktopUpdateStage
  message: string
  percent: number | null
  error: string | null
  /** When the stage is 'manual': the exact command the user should run
   *  (CLI install with no staged updater). */
  command: string | null
  /** Structured update blockers used by the safe close-and-update confirmation. */
  blockers?: readonly DesktopUpdateBlocker[] | null
  log: readonly { stage: DesktopUpdateStage; message: string; at: number }[]
}

const IDLE: UpdateApplyState = {
  applying: false,
  stage: 'idle',
  message: '',
  percent: null,
  error: null,
  command: null,
  log: []
}

export const $desktopVersion = atom<DesktopVersionInfo | null>(null)
export const $updateApply = atom<UpdateApplyState>(IDLE)
export const $updateChecking = atom<boolean>(false)
export const $updateOverlayOpen = atom<boolean>(false)
export const $updateStatus = atom<DesktopUpdateStatus | null>(null)

// Client and backend are independently updatable; each keeps its own state.
export const $backendUpdateStatus = atom<DesktopUpdateStatus | null>(null)
export const $backendUpdateApply = atom<UpdateApplyState>(IDLE)
export const $backendUpdateChecking = atom<boolean>(false)

export type UpdateTarget = 'client' | 'backend'
export const $updateOverlayTarget = atom<UpdateTarget>('client')

export const setUpdateOverlayOpen = (_open: boolean) => {}
export const openUpdateOverlayFor = (_target: UpdateTarget) => {}
export const resetUpdateApplyState = () => {}
export const reportBackendContract = (_contract: number | undefined) => {}
export const reportInstallMethodWarning = (_message: string | undefined) => {}
export const maybeNotifyUpdateAvailable = (_status: DesktopUpdateStatus | null, _target?: UpdateTarget) => {}
export const openUpdatesWindow = (_target?: UpdateTarget) => {}
export const startActiveUpdate = (_target?: UpdateTarget) => {}
export const requestActiveUpdate = () => {}
export const checkBackendUpdates = async (): Promise<DesktopUpdateStatus | null> => null
export const checkUpdates = async (): Promise<DesktopUpdateStatus | null> => null
export const applyUpdates = async (_opts?: DesktopUpdateApplyOptions): Promise<DesktopUpdateApplyResult> => ({
  ok: false,
  error: 'disabled',
  message: 'Updates are disabled.'
})
export const applyBackendUpdate = applyUpdates
export interface UpdateEverythingState {
  running: boolean
}
export const $updateEverything = atom<UpdateEverythingState>({ running: false })
export const hasMultipleUpdateTargets = () => false
export const applyEverythingUpdate = async () => {}
export const startUpdatePoller = () => {
  void refreshDesktopVersion()
}
export const stopUpdatePoller = () => {}

export async function refreshDesktopVersion(): Promise<DesktopVersionInfo | null> {
  if (typeof window === 'undefined') {
    return null
  }

  // Best-effort UI sync: callers (checkUpdates, startUpdatePoller, window
  // focus handler) all kick this off with `void refreshDesktopVersion()`,
  // so any rejection from the IPC bridge (e.g. main process shutting down
  // mid-reload, or the bridge not yet ready on first paint) would surface
  // as an unhandled promise rejection in the renderer. Swallow it.
  try {
    const next = await window.hermesDesktop?.getVersion?.()

    if (next) {
      $desktopVersion.set(next)
    }

    return next ?? null
  } catch {
    return null
  }
}
