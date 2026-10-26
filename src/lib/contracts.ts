import type { DataRow, Entity, Profile } from './data'

export type Relationship = {
  source: string
  target: string
  field: string
  label: string
  evidence: string
}
export type Snapshot = {
  id: string
  profileId: string
  database: string
  protocol: Profile['protocol']
  source: string
  inspectedAt: string
  entities: Entity[]
  relationships: Relationship[]
  warnings: string[]
  complete: boolean
}
export type Auth = {
  mode: 'password' | 'token' | 'fmid' | 'lab'
  username?: string
  password?: string
  token?: string
}
export type SessionInfo = {
  id: string
  profileId: string
  connectedAt: string
  checkedAt: string
  latencyMs: number
  auth: string
  expiresAt: string
  source: string
}
export type Condition = {
  id: string
  field: string
  operator: 'equals' | 'contains' | 'greater' | 'less'
  value: string
}
export type Query = {
  entity: string
  conditions: Condition[]
  match: 'all' | 'any'
  offset: number
  limit: number
  sort?: { field: string; direction: 'asc' | 'desc' }
  cursor?: string
}
export type RequestSpec = {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  body?: unknown
}
export type RecordPage = {
  rows: DataRow[]
  recordMeta?: { recordId: string; modId?: string; portalData?: unknown }[]
  total: number | null
  found: number | null
  hasNext: boolean
  nextCursor?: string
  request: RequestSpec
  elapsedMs: number
  warnings: string[]
}
export type ActivityEntry = {
  id: string
  profileId: string
  at: string
  action: string
  success: boolean
  durationMs?: number
  detail: string
}
export const labProfiles: Profile[] = [
  {
    id: 'lab-data',
    name: 'Local FileMaker Lab',
    database: 'Northstar_CRM',
    protocol: 'Data API',
    host: 'Local practice server',
    lab: true,
  },
  {
    id: 'lab-odata',
    name: 'Local OData Lab',
    database: 'Northstar_CRM',
    protocol: 'OData',
    host: 'Local practice server',
    lab: true,
  },
]
