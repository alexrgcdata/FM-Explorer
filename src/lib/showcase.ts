import { entities, relationships, type Profile } from './data'
import {
  labProfiles,
  type Query,
  type RecordPage,
  type SessionInfo,
  type Snapshot,
} from './contracts'
import { compileRequest } from './queries'

// Browser-only fixtures. This adapter never accepts or forwards real credentials.
const sessions = new Map<string, { profile: Profile; info: SessionInfo }>()
function connect(profile: Profile) {
  const allowed = labProfiles.find((p) => p.id === profile.id)
  if (!allowed)
    throw new Error(
      'The website preview only supports the bundled synthetic database. Use the local application for real FileMaker connections.',
    )
  const now = new Date().toISOString()
  const info: SessionInfo = {
    id: `preview-${allowed.id}`,
    profileId: allowed.id,
    connectedAt: now,
    checkedAt: now,
    latencyMs: 0,
    auth: 'Synthetic preview; no authentication',
    expiresAt: '',
    source: 'Browser-only synthetic preview',
  }
  sessions.set(info.id, { profile: allowed, info })
  return { session: info, snapshot: snapshot(allowed) }
}
function snapshot(profile: Profile): Snapshot {
  return {
    id: crypto.randomUUID(),
    profileId: profile.id,
    database: profile.database,
    protocol: profile.protocol,
    source: 'Bundled synthetic preview data',
    inspectedAt: new Date().toISOString(),
    complete: true,
    entities: entities.map((e) => ({
      ...structuredClone(e),
      rows: [],
      count: e.rows.length,
      kind: profile.protocol === 'Data API' ? 'layout' : 'entity-set',
      source: 'Bundled synthetic preview data',
      endpoint: compileRequest(profile, e, {
        entity: e.name,
        conditions: [],
        match: 'all',
        offset: 0,
        limit: 10,
      }).path,
    })),
    relationships: structuredClone(relationships).map((r) => ({
      ...r,
      evidence:
        'Declared synthetic fixture relationship; not discovered from a real database.',
    })),
    warnings: [
      'Website preview: synthetic records and declared fixture relationships only. No FileMaker server or AI provider is contacted. Connection timing is not a network measurement.',
    ],
  }
}
for (const p of labProfiles) connect(p)

export async function previewRequest<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  if (path === '/sessions' && method === 'GET')
    return { sessions: [...sessions.values()].map((s) => s.info) } as T
  if (path === '/connect' && method === 'POST') {
    const input = body as { profile: Profile; auth: { mode: string } }
    if (input.auth.mode !== 'lab')
      throw new Error(
        'Real credentials are not accepted in the website preview.',
      )
    return connect(input.profile) as T
  }
  const match = /^\/sessions\/([^/]+)(?:\/(refresh|records))?$/.exec(path)
  const current = match && sessions.get(decodeURIComponent(match[1]))
  if (!match || !current)
    throw new Error(
      'Preview session is unavailable. Open a bundled lab connection again.',
    )
  if (method === 'DELETE' && !match[2]) {
    sessions.delete(current.info.id)
    return { disconnected: true } as T
  }
  if (method === 'POST' && match[2] === 'refresh')
    return { session: current.info, snapshot: snapshot(current.profile) } as T
  if (method !== 'POST' || match[2] !== 'records')
    throw new Error('Unsupported preview operation.')
  const query = body as Query
  if (
    !Number.isInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100 ||
    !Number.isInteger(query.offset) ||
    query.offset < 0
  )
    throw new Error('Use a bounded preview page.')
  const entity = entities.find((e) => e.name === query.entity)
  if (!entity) throw new Error('Choose a bundled resource.')
  const request = compileRequest(current.profile, entity, query)
  const conditions = query.conditions.filter((c) => c.value !== '')
  let rows = entity.rows.filter((row) => {
    const matches = conditions.map((c) => {
      const value = row[c.field]
      const field = entity.fields.find((f) => f.name === c.field)!
      if (c.operator === 'greater') return Number(value) > Number(c.value)
      if (c.operator === 'less') return Number(value) < Number(c.value)
      if (c.operator === 'contains')
        return String(value ?? '')
          .toLowerCase()
          .includes(c.value.toLowerCase())
      if (field.type === 'number') return Number(value) === Number(c.value)
      return String(value ?? '').toLowerCase() === c.value.toLowerCase()
    })
    return (
      !matches.length ||
      (query.match === 'any' ? matches.some(Boolean) : matches.every(Boolean))
    )
  })
  if (query.sort) {
    const { field, direction } = query.sort
    rows = [...rows].sort((a, b) => {
      const av = a[field],
        bv = b[field]
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''))
      return direction === 'asc' ? cmp : -cmp
    })
  }
  const page: RecordPage = {
    rows: structuredClone(rows.slice(query.offset, query.offset + query.limit)),
    total: entity.rows.length,
    found: rows.length,
    hasNext: query.offset + query.limit < rows.length,
    request,
    elapsedMs: 0,
    warnings: [
      'Synthetic browser preview; this request was evaluated locally, not sent to FileMaker.',
    ],
  }
  return page as T
}
