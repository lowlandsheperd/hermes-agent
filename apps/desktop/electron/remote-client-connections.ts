/** Connection policy for the standalone client. Shared upstream helpers also
 * serve full desktop builds; every client persistence and startup entry uses
 * this module so their local defaults never cross into this application. */
import * as registryCore from './connection-registry'
import type { ConnectionInput, ConnectionRegistry } from './connection-registry'
import { type DesktopRemoteRouteInput, resolveDesktopRemoteRoute } from './desktop-remote-route'
import {
  FirstRunSetupResetError,
  type PrimaryBackendStartupOptions,
  type PrimaryBackendStartupResult
} from './primary-backend-startup'
import { assertRemoteConnectionKind } from './remote-client-policy'

export function normalizeRegistry(raw: unknown): ConnectionRegistry {
  const registry = registryCore.normalizeRegistry(raw)
  const connections = registry.connections.filter(c => c.kind === 'remote' || c.kind === 'ssh')
  const primary = connections.some(c => c.id === registry.primary) ? registry.primary : connections[0]?.id || ''
  const lastUsed = connections.some(c => c.id === registry.lastUsed) ? registry.lastUsed : primary

  return { ...registry, connections, primary, lastUsed }
}

export function migrateV1ToRegistry(raw: unknown): ConnectionRegistry {
  const config = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {}
  const supported = config.mode === 'remote' || config.mode === 'ssh'
  const profiles = Object.fromEntries(
    Object.entries(config.profiles || {}).filter(
      ([, value]) => value && typeof value === 'object' && ['remote', 'ssh'].includes((value as any).mode)
    )
  )

  return normalizeRegistry(
    registryCore.migrateV1ToRegistry({
      ...config,
      mode: supported ? config.mode : 'local',
      remote: supported ? config.remote : {},
      profiles
    })
  )
}

export function normalizeConnectionInput(input: ConnectionInput, registry: ConnectionRegistry) {
  assertRemoteConnectionKind(input.kind)

  return registryCore.normalizeConnectionInput(input, registry)
}

export function removeConnection(registry: ConnectionRegistry, id: string): ConnectionRegistry {
  return normalizeRegistry(registryCore.removeConnection(registry, id))
}

export function reconcileAppliedGlobalConnection(
  registry: ConnectionRegistry,
  config: Record<string, any>
): ConnectionRegistry {
  assertRemoteConnectionKind(config.mode)

  if (config.mode === 'remote') {
    return normalizeRegistry(registryCore.reconcileAppliedGlobalConnection(registry, config))
  }
  const imported = migrateV1ToRegistry({ mode: 'ssh', remote: config.remote })
  const incoming = imported.connections[0]

  if (!incoming) {
    throw new Error('SSH host is required.')
  }
  const existing = registry.connections.find(
    c =>
      c.kind === 'ssh' &&
      c.host === incoming.host &&
      (c.user || '') === (incoming.user || '') &&
      (c.port ?? 22) === (incoming.port ?? 22) &&
      (c.remoteProfile || '') === (incoming.remoteProfile || '')
  )

  const entry = existing
    ? { ...existing, ...incoming, id: existing.id, label: existing.label }
    : registryCore.normalizeConnectionInput(
        {
          ...incoming,
          id: undefined,
          label: registryCore.uniqueLabel(
            incoming.label,
            registry.connections.map(c => c.label)
          )
        },
        registry
      )

  if (incoming.token !== undefined) {
    entry.token = incoming.token
  }

  return normalizeRegistry({ ...registryCore.upsertConnection(registry, entry), primary: entry.id, lastUsed: entry.id })
}

/** The registry is authoritative after one-time migration. In particular,
 * deleting the last server must not revive a stale v1 connection.json route. */
export function resolveClientRemoteRoute({ env, registry }: DesktopRemoteRouteInput) {
  return resolveDesktopRemoteRoute({ config: {}, env, registry: normalizeRegistry(registry) })
}

export async function runRemoteClientStartup<Backend, RuntimeBackend, Remote, Connection>({
  resolveRemote,
  connectRemote,
  waitForDecision
}: PrimaryBackendStartupOptions<Backend, RuntimeBackend, Remote, Connection>): Promise<
  PrimaryBackendStartupResult<RuntimeBackend, Connection>
> {
  const saved = await resolveRemote()

  if (saved) {
    return { kind: 'remote', connection: await connectRemote(saved) }
  }
  const decision = await waitForDecision({ kind: 'bootstrap-needed' } as Backend)

  if (decision === 'reset') {
    throw new FirstRunSetupResetError()
  }

  if (decision !== 'remote-applied') {
    throw new Error('Choose a URL or SSH connection to continue.')
  }
  const remote = await resolveRemote()

  if (!remote) {
    throw new Error('Choose a URL or SSH connection to continue.')
  }

  return { kind: 'remote', connection: await connectRemote(remote) }
}
