/** The desktop connects to existing servers; it never provisions this computer. */
export function assertRemoteConnectionKind(kind: unknown): void {
  if (kind !== 'remote' && kind !== 'ssh') {
    throw new Error('Choose a URL or SSH connection.')
  }
}

export function rejectLocalRuntime(): void {
  throw new Error('This client connects through URL or SSH. Choose a server to continue.')
}
