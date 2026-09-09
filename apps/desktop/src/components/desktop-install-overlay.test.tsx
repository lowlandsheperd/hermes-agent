import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { GatewaySettings } from '@/app/settings/gateway-settings'

import { DesktopInstallOverlay } from './desktop-install-overlay'

vi.mock('@/app/settings/connections-registry', () => ({ ConnectionsRegistrySection: () => null }))
vi.mock('@/app/settings/managed-updates-section', () => ({ ManagedUpdatesSection: () => null }))
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'hermesDesktop')
})

function bridge(mode = 'local') {
  const desktop = {
    getConnectionConfig: vi.fn().mockResolvedValue({ mode }),
    getBootstrapState: vi.fn().mockResolvedValue({ setupChoice: { platform: 'unknown' } }),
    onBootstrapEvent: vi.fn(() => () => {}),
    continueBootstrapLocal: vi.fn(),
    cloud: { status: vi.fn(), discover: vi.fn() }
  }

  Object.defineProperty(window, 'hermesDesktop', { configurable: true, value: desktop })

  return desktop
}

test('first run offers URL and SSH immediately with no installer or Cloud choice', async () => {
  const desktop = bridge()
  render(<DesktopInstallOverlay />)
  expect(await screen.findByText('Remote gateway')).toBeTruthy()
  expect(screen.getByText('Connect via SSH')).toBeTruthy()
  expect(screen.queryByText('Local gateway')).toBeNull()
  expect(screen.queryByText('Hermes Cloud')).toBeNull()
  expect(screen.queryByText('Install locally')).toBeNull()
  expect(desktop.continueBootstrapLocal).not.toHaveBeenCalled()
  expect(desktop.cloud.status).not.toHaveBeenCalled()
})

test('a saved Cloud mode opens as URL configuration and can switch only to SSH', async () => {
  const desktop = bridge('cloud')
  render(<GatewaySettings embedded />)
  await screen.findByText('Remote gateway')
  fireEvent.click(screen.getByText('Connect via SSH'))
  await waitFor(() => expect(screen.getByText('Host')).toBeTruthy())
  expect(screen.queryByText('Local gateway')).toBeNull()
  expect(screen.queryByText('Hermes Cloud')).toBeNull()
  expect(desktop.cloud.status).not.toHaveBeenCalled()
})
