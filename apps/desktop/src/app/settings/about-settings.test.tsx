import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AboutSettings } from './about-settings'
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'hermesDesktop')
})
test('About displays the installed version without any update or release controls, even with stale bundle flags', async () => {
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: {
      getVersion: vi
        .fn()
        .mockResolvedValue({ appVersion: 'test-version', bundleOutOfSync: true, bundleSwapPending: true })
    }
  })
  const { container } = render(<AboutSettings />)
  expect(await screen.findByText(/test-version/)).toBeTruthy()
  expect(container.querySelector('button, a')).toBeNull()
  expect(screen.queryByText(/update|release|restart/i)).toBeNull()
})
