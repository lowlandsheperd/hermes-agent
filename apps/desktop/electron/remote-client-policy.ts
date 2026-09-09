/** The desktop connects to existing servers; it never provisions this computer. */
export function assertRemoteConnectionKind(kind: unknown): void {
  if (kind !== 'remote') {
    throw new Error('Choose a URL connection.')
  }
}

export function rejectLocalRuntime(): void {
  throw new Error('This client connects through URL. Choose a server to continue.')
}

/** The REST proxy must not expose server update actions to this client. */
export function assertClientApiPath(path: unknown): void {
  const pathname = decodeURIComponent(new URL(String(path || ''), 'http://client.invalid').pathname)
  if (/^\/api\/hermes\/update(?:\/|$)/.test(pathname)) {
    throw new Error('Updates are disabled.')
  }
}
