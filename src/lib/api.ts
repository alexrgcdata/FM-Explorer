import type {
  Auth,
  Query,
  RecordPage,
  SessionInfo,
  Snapshot,
} from './contracts'
import type { Profile } from './data'
import { publicPreview } from './runtime'
let workspaceToken = ''
export class ClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export async function bootstrap() {
  if (publicPreview) return
  const response = await fetch('/api/bootstrap', { credentials: 'same-origin' })
  if (!response.ok)
    throw new Error(
      'The local service is unavailable. Start the app with npm start.',
    )
  const body = await response.json()
  if (typeof body.workspaceToken !== 'string')
    throw new Error('Invalid local-service response.')
  workspaceToken = body.workspaceToken
}
async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (publicPreview) {
    if (signal?.aborted)
      throw new DOMException('Request cancelled.', 'AbortError')
    const { previewRequest } = await import('./showcase')
    return previewRequest<T>(path, method, body)
  }
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Workspace-Token': workspaceToken,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  })
  const result = await response.json()
  if (!response.ok)
    throw new ClientError(
      response.status,
      typeof result.error === 'string' ? result.error : 'Request failed.',
    )
  return result as T
}
export const api = {
  connect: (profile: Profile, auth: Auth) =>
    request<{ session: SessionInfo; snapshot: Snapshot }>('/connect', 'POST', {
      profile: {
        id: profile.id,
        name: profile.name,
        host: profile.host,
        database: profile.database,
        protocol: profile.protocol,
        ...(profile.lab ? { lab: true } : {}),
        ...(profile.apiVersion ? { apiVersion: profile.apiVersion } : {}),
      },
      auth,
    }),
  sessions: () => request<{ sessions: SessionInfo[] }>('/sessions'),
  refresh: (id: string) =>
    request<{ session: SessionInfo; snapshot: Snapshot }>(
      `/sessions/${encodeURIComponent(id)}/refresh`,
      'POST',
      {},
    ),
  records: (id: string, query: Query, signal?: AbortSignal) =>
    request<RecordPage>(
      `/sessions/${encodeURIComponent(id)}/records`,
      'POST',
      query,
      signal,
    ),
  disconnect: (id: string) =>
    request<{ disconnected: boolean; warning?: string }>(
      `/sessions/${encodeURIComponent(id)}`,
      'DELETE',
    ),
}
