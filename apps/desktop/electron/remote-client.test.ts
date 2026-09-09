import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test, vi } from 'vitest'

import { createFirstRunSetupGate } from './first-run-setup-gate'
import { rehomePrimaryConnection } from './primary-connection-rehome'
import {
  migrateV1ToRegistry,
  normalizeConnectionInput,
  normalizeRegistry,
  reconcileAppliedGlobalConnection,
  removeConnection
} from './remote-client-connections'
import { resolveClientRemoteRoute as resolveDesktopRemoteRoute } from './remote-client-connections'
import { runRemoteClientStartup as runPrimaryBackendStartup } from './remote-client-connections'
import { assertRemoteConnectionKind, rejectLocalRuntime } from './remote-client-policy'

test('registry migration and deletion never select a local runtime or resurrect a deleted server', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hermes-remote-client-'))

  try {
    const config = { mode: 'ssh', remote: { host: 'server', user: 'alice' } }
    let registry = migrateV1ToRegistry(config)
    registry = reconcileAppliedGlobalConnection(registry, {
      mode: 'remote',
      remote: { url: 'https://gateway.example', authMode: 'token' }
    })
    const file = join(dir, 'connections.json')
    writeFileSync(
      file,
      JSON.stringify({
        ...registry,
        connections: [
          ...registry.connections,
          { id: 'local', kind: 'local', label: 'This device' },
          { id: 'cloud', kind: 'cloud', label: 'Cloud', url: 'https://cloud.example' }
        ]
      })
    )
    registry = normalizeRegistry(JSON.parse(readFileSync(file, 'utf8')))
    expect(registry.connections.map(c => c.kind).sort()).toEqual(['remote', 'ssh'])
    expect(resolveDesktopRemoteRoute({ config, registry })?.kind).toBe('remote')
    registry = removeConnection(registry, registry.primary)
    expect(resolveDesktopRemoteRoute({ config, registry })?.kind).toBe('ssh')
    registry = removeConnection(registry, registry.primary)
    expect(registry.primary).toBe('')
    expect(registry.connections).toEqual([])
    expect(resolveDesktopRemoteRoute({ config, registry })).toBeNull()
    expect(normalizeRegistry(null).connections).toEqual([])

    for (const kind of ['local', 'cloud', undefined, 'invalid']) {
      expect(() => assertRemoteConnectionKind(kind)).toThrow()
      expect(() => normalizeConnectionInput({ kind, label: 'Rejected' } as any, registry)).toThrow()
    }

    expect(rejectLocalRuntime).toThrow()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('URL and SSH apply resume first run without local preparation, including connection failures', async () => {
  for (const mode of ['remote', 'ssh'] as const) {
    let registry = normalizeRegistry(null)
    let prompted!: () => void

    const prompt = new Promise<void>(resolve => {
      prompted = resolve
    })

    const gate = createFirstRunSetupGate({ promptChoice: prompted })

    const local = vi.fn(() => {
      throw new Error('Local runtime must never be reached')
    })

    const options = {
      resolveRemote: async () => resolveDesktopRemoteRoute({ config: {}, registry }),
      connectRemote: async (route: { kind: string }) => ({ mode: 'remote', kind: route.kind }),
      waitForDecision: (backend: object) => gate.wait(backend),
      prepareLocalBackend: local,
      ensureLocalRuntime: local,
      waitForLocalStart: local
    }

    const startup = runPrimaryBackendStartup(options)
    await prompt
    expect(local).not.toHaveBeenCalled()
    registry = reconcileAppliedGlobalConnection(registry, {
      mode,
      remote: mode === 'ssh' ? { mode, host: 'server' } : { url: 'https://gateway.example' }
    })
    const teardown = vi.fn()
    await rehomePrimaryConnection({
      mode,
      clearLocalBootstrapFailure: () => {},
      resumeFirstRunRemote: () => gate.abandonForRemoteApply(),
      teardownPrimaryBackend: teardown,
      notifyConnectionApplied: () => {}
    })
    expect(await startup).toEqual({ kind: 'remote', connection: { mode: 'remote', kind: mode } })
    expect(teardown).not.toHaveBeenCalled()
    expect(local).not.toHaveBeenCalled()
    await expect(
      runPrimaryBackendStartup({
        ...options,
        connectRemote: async () => {
          throw new Error('Connection refused')
        }
      })
    ).rejects.toThrow('Connection refused')
    expect(local).not.toHaveBeenCalled()
  }
})
