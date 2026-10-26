import 'fake-indexeddb/auto'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { openDB } from 'idb'
import {
  evaluateCheck,
  requestExport,
  savedRequestSchema,
  type SavedRequest,
} from '../src/lib/saved-requests.ts'
import type { RecordPage } from '../src/lib/contracts.ts'

const definition: SavedRequest = {
  id: 'request',
  profileId: 'p',
  name: 'Customer read',
  description: '',
  protocol: 'OData',
  query: {
    entity: 'Customers',
    conditions: [
      {
        id: 'c',
        field: 'Email',
        operator: 'equals',
        value: 'private-filter@example.com',
      },
    ],
    match: 'all',
    offset: 0,
    limit: 10,
  },
  expectations: {
    minRows: 1,
    maxDurationMs: 100,
    fields: [
      { name: 'ID', type: 'numeric', allowNull: false },
      { name: 'Name', type: 'string', allowNull: false },
    ],
  },
  revision: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
const page = (rows: Record<string, unknown>[], elapsedMs = 12): RecordPage => ({
  rows,
  total: 100,
  found: 100,
  hasNext: true,
  request: { method: 'GET', path: '/Customers' },
  elapsedMs,
  warnings: [],
})

test('checks support precision-preserving numbers and retain summaries without records', () => {
  const result = evaluateCheck(
    definition,
    page([{ ID: '900719925474099312345', Name: 'record-sentinel' }]),
  )
  assert.equal(result.status, 'pass')
  assert.equal(result.returnedRows, 1)
  assert.equal(JSON.stringify(result).includes('record-sentinel'), false)
})
test('checks report missing fields, type mismatches, nulls and slow responses', () => {
  const result = evaluateCheck(
    definition,
    page([{ ID: null, Name: 7 }, { ID: 'abc' }], 101),
  )
  assert.equal(result.status, 'fail')
  assert.match(
    result.details.find((d) => d.id === 'field:ID')!.message,
    /1 disallowed nulls, 1 type mismatches/,
  )
  assert.match(
    result.details.find((d) => d.id === 'field:Name')!.message,
    /1 missing/,
  )
  assert.equal(result.details.find((d) => d.id === 'duration')!.status, 'fail')
})
test('empty pages cannot pass field checks; row expectations still fail independently', () => {
  assert.equal(
    evaluateCheck(
      {
        ...definition,
        expectations: { ...definition.expectations, minRows: 0 },
      },
      page([]),
    ).status,
    'inconclusive',
  )
  assert.equal(evaluateCheck(definition, page([])).status, 'fail')
})
test('request validation strips unexpected auth and exports redact filter values by default', () => {
  const safe = savedRequestSchema.parse({
    ...definition,
    password: 'secret-sentinel',
    query: {
      ...definition.query,
      headers: { Authorization: 'secret-sentinel' },
    },
  })
  assert.equal(JSON.stringify(safe).includes('secret-sentinel'), false)
  const profile = {
    id: 'p',
    name: 'Lab',
    host: 'https://example.com',
    database: 'CRM',
    protocol: 'OData' as const,
  }
  const redacted = JSON.parse(requestExport(profile, [safe], []))
  assert.equal(redacted.requests[0].query.conditions[0].value, '')
  assert.equal(redacted.requests[0].requiresFilterValues, true)
  assert.equal(
    JSON.stringify(redacted).includes('private-filter@example.com'),
    false,
  )
  assert.equal(
    JSON.parse(requestExport(profile, [safe], [], true)).requests[0].query
      .conditions[0].value,
    'private-filter@example.com',
  )
  assert.equal(
    savedRequestSchema.safeParse({
      ...definition,
      expectations: { ...definition.expectations, minRows: 11 },
    }).success,
    false,
  )
})

// Start at the shipped v1 format before importing the v2 storage module.
const legacy = await openDB('fm-api-explorer', 1, {
  upgrade(db) {
    db.createObjectStore('profiles', { keyPath: 'id' })
    db.createObjectStore('snapshots', { keyPath: 'profileId' })
    db.createObjectStore('preferences')
    db.createObjectStore('activity', { keyPath: 'id' }).createIndex(
      'by-time',
      'at',
    )
  },
})
await legacy.put('preferences', 'preserved', 'migration-sentinel')
legacy.close()
const storage = await import('../src/lib/storage.ts')
after(async () => {
  ;(await storage.database).close()
})
test('v1 migration preserves settings; requests persist, history is bounded and deletion cascades', async () => {
  assert.equal(
    await storage.preference('migration-sentinel', 'missing'),
    'preserved',
  )
  assert.equal((await storage.database).version, 2)
  await storage.saveRequest(definition)
  assert.equal((await storage.getRequests())[0].name, 'Customer read')
  for (let i = 0; i < 202; i++)
    await storage.saveCheckRun({
      ...evaluateCheck(definition, page([{ ID: 1, Name: 'A' }])),
      id: `run-${i}`,
      at: new Date(1700000000000 + i).toISOString(),
    })
  assert.equal((await storage.getCheckRuns()).length, 200)
  assert.equal((await storage.getCheckRuns())[0].id, 'run-201')
  await storage.deleteRequest(definition.id)
  assert.equal((await storage.getRequests()).length, 0)
  assert.equal((await storage.getCheckRuns()).length, 0)
  await storage.saveRequest(definition)
  await storage.saveCheckRun({
    ...evaluateCheck(definition, page([])),
    id: 'run',
    at: new Date().toISOString(),
  })
  await storage.removeProfile('p')
  assert.equal((await storage.getRequests()).length, 0)
  assert.equal((await storage.getCheckRuns()).length, 0)
})
