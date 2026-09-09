import { afterEach, expect, test, vi } from 'vitest'
import {
  $updateOverlayOpen,
  applyBackendUpdate,
  applyEverythingUpdate,
  applyUpdates,
  checkBackendUpdates,
  checkUpdates,
  openUpdatesWindow,
  reportBackendContract,
  reportInstallMethodWarning,
  requestActiveUpdate,
  startUpdatePoller,
  stopUpdatePoller
} from './updates'

afterEach(() => {
  Reflect.deleteProperty(window, 'hermesDesktop')
  vi.useRealTimers()
})
test('URL client never checks or applies client/server updates, even after focus and polling intervals', async () => {
  vi.useFakeTimers()
  const remote = vi.fn()
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: {
      api: remote,
      getVersion: vi.fn().mockResolvedValue({ appVersion: 'test' }),
      updates: { check: remote, apply: remote, onProgress: remote },
      connections: { updateAll: remote, updateManaged: remote }
    }
  })
  startUpdatePoller()
  await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
  window.dispatchEvent(new Event('focus'))
  expect(await checkUpdates()).toBeNull()
  expect(await checkBackendUpdates()).toBeNull()
  expect((await applyUpdates()).ok).toBe(false)
  expect((await applyBackendUpdate()).ok).toBe(false)
  await applyEverythingUpdate()
  openUpdatesWindow('backend')
  requestActiveUpdate()
  reportBackendContract(0)
  reportInstallMethodWarning('update needed')
  expect($updateOverlayOpen.get()).toBe(false)
  expect(remote).not.toHaveBeenCalled()
  stopUpdatePoller()
})
