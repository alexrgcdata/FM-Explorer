import 'fake-indexeddb/auto'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { openDB } from 'idb'
import {
  makeSchemaVersion,
  compareSchemaVersions,
  affectedRequests,
  labChangeExample,
} from '../src/lib/schema-history.ts'
import { entities } from '../src/lib/data.ts'
import { labProfiles, type Snapshot } from '../src/lib/contracts.ts'
import type { SavedRequest } from '../src/lib/saved-requests.ts'

const profile = labProfiles[1]
const snapshot: Snapshot = {
  id: 'baseline',
  profileId: profile.id,
  database: profile.database,
  protocol: profile.protocol,
  source: 'Local practice server',
  inspectedAt: '2026-10-26T10:00:00.000Z',
  complete: true,
  warnings: [],
  entities: [structuredClone(entities[0])],
  relationships: [],
}
const version = () => makeSchemaVersion(structuredClone(snapshot), profile)
const request: SavedRequest = {
  id: 'r',
  profileId: profile.id,
  name: 'Customer API',
  description: '',
  protocol: 'OData',
  query: {
    entity: 'Customers',
    conditions: [
      { id: 'c', field: 'Email', operator: 'equals', value: 'private-filter' },
    ],
    match: 'all',
    offset: 0,
    limit: 10,
  },
  expectations: {
    minRows: 1,
    fields: [{ name: 'FullName', type: 'string', allowNull: false }],
  },
  revision: 1,
  createdAt: snapshot.inspectedAt,
  updatedAt: snapshot.inspectedAt,
}

test('schema versions whitelist structural evidence and exclude rows, raw payloads and counts', () => {
  const input = structuredClone(snapshot)
  input.entities[0].raw = { record: 'raw-sentinel' }
  input.entities[0].rows = [{ Email: 'row-sentinel' }]
  input.entities[0].count = 100
  const saved = makeSchemaVersion(input, profile)
  assert.deepEqual(saved.entities[0].rows, [])
  assert.equal(saved.entities[0].count, undefined)
  assert.equal(saved.entities[0].raw, undefined)
  assert.equal(JSON.stringify(saved).includes('sentinel'), false)
  assert.equal(saved.target, profile.host)
  assert.match(saved.accessScope, /privileges were not fingerprinted/)
})
test('lab example detects missing/new fields and both normalized and native type changes', () => {
  const baseline = version()
  baseline.entities[0].fields.find((f) => f.name === 'FullName')!.nativeType =
    'Edm.String'
  const [before, after] = labChangeExample(baseline),
    result = compareSchemaVersions(before, after)
  assert.equal(result.comparable, true)
  assert.ok(
    result.changes.some((c) => c.kind === 'missing' && c.field === 'Email'),
  )
  assert.ok(
    result.changes.some((c) => c.kind === 'added' && c.field === 'AccountTier'),
  )
  assert.ok(
    result.changes.some(
      (c) =>
        c.kind === 'changed' &&
        c.field === 'FullName' &&
        c.property === 'nativeType',
    ),
  )
  assert.ok(
    result.changes.some(
      (c) =>
        c.kind === 'changed' && c.field === 'FullName' && c.property === 'type',
    ),
  )
  assert.equal(
    baseline.entities[0].fields.some((f) => f.name === 'Email'),
    true,
  )
  assert.equal(affectedRequests(result.changes, [request])[0].request.id, 'r')
  assert.equal(
    JSON.stringify(
      affectedRequests(result.changes, [
        { ...request, query: { ...request.query, entity: 'Products' } },
      ]),
    ),
    '[]',
  )
})
test('partial resource or field discovery never asserts removal or newly created objects', () => {
  const before = version(),
    after = version()
  after.complete = false
  after.entities[0].fields = []
  assert.ok(
    compareSchemaVersions(before, after).changes.every(
      (c) => c.kind === 'unknown',
    ),
  )
  after.entities = []
  assert.equal(compareSchemaVersions(before, after).changes[0].kind, 'unknown')
  assert.equal(compareSchemaVersions(after, before).changes[0].kind, 'unknown')
  const complete = version()
  complete.entities[0].warning = 'Partial fields'
  complete.entities[0].fields = []
  assert.ok(
    compareSchemaVersions(before, complete).changes.every(
      (c) => c.kind === 'unknown',
    ),
  )
})
test('known null/key/index changes are compared; unavailable metadata remains unknown', () => {
  const before = version(),
    after = version(),
    a = before.entities[0].fields[0],
    b = after.entities[0].fields[0]
  a.nullable = true
  b.nullable = false
  a.key = true
  b.key = false
  b.indexed = true
  const changes = compareSchemaVersions(before, after).changes
  assert.equal(changes.find((c) => c.property === 'nullable')?.kind, 'changed')
  assert.equal(changes.find((c) => c.property === 'key')?.kind, 'changed')
  assert.equal(changes.find((c) => c.property === 'indexed')?.kind, 'unknown')
})
test('timestamps, record counts, descriptions and field order do not create structural changes', () => {
  const before = version(),
    after = version()
  after.inspectedAt = '2026-10-26T11:00:00.000Z'
  after.entities[0].description = 'Changed'
  after.entities[0].count = 900
  after.entities[0].fields.reverse()
  assert.deepEqual(compareSchemaVersions(before, after).changes, [])
})
test('comparison rejects changed sources, protocols, database and targets', () => {
  for (const patch of [
    { target: 'https://different.example' },
    { protocol: 'Data API' as const },
    { database: 'Different' },
    { source: 'Other' },
    { profileId: 'other' },
    { apiVersion: 'vLatest' },
  ])
    assert.equal(
      compareSchemaVersions(version(), { ...version(), ...patch }).comparable,
      false,
    )
})
test('navigation evidence changes are compared and sorted-query fields link affected checks', () => {
  const before = version(),
    after = version()
  after.relationships = [
    {
      source: 'Customers',
      target: 'Orders',
      field: 'CustomerID',
      label: 'many',
      evidence: 'OData navigation',
    },
  ]
  const diff = compareSchemaVersions(before, after)
  assert.equal(diff.changes[0].property, 'Navigation → Orders')
  assert.equal(affectedRequests(diff.changes, [request]).length, 1)
  const changed = [
    {
      id: 'sort',
      kind: 'changed' as const,
      entity: 'Customers',
      field: 'JoinedAt',
      property: 'type',
      before: 'date',
      after: 'text',
      message: 'Changed',
    },
  ]
  assert.equal(affectedRequests(changed, [request]).length, 0)
  assert.equal(
    affectedRequests(changed, [
      {
        ...request,
        query: {
          ...request.query,
          sort: { field: 'JoinedAt', direction: 'asc' },
        },
      },
    ]).length,
    1,
  )
})

const legacy = await openDB('fm-api-explorer', 2, {
  upgrade(db) {
    db.createObjectStore('profiles', { keyPath: 'id' })
    db.createObjectStore('snapshots', { keyPath: 'profileId' })
    db.createObjectStore('preferences')
    db.createObjectStore('activity', { keyPath: 'id' }).createIndex(
      'by-time',
      'at',
    )
    db.createObjectStore('requests', { keyPath: 'id' }).createIndex(
      'by-profile',
      'profileId',
    )
    const runs = db.createObjectStore('checkRuns', { keyPath: 'id' })
    runs.createIndex('by-request', 'requestId')
    runs.createIndex('by-time', 'at')
  },
})
await legacy.put('snapshots', snapshot)
await legacy.put('requests', request)
legacy.close()
const storage = await import('../src/lib/storage.ts')
after(async () => {
  ;(await storage.database).close()
})
test('v2 migration preserves a baseline and saved requests; captures are immutable and capped at 50', async () => {
  assert.equal((await storage.database).version, 3)
  assert.equal((await storage.getSchemaVersions(profile.id)).length, 1)
  assert.equal((await storage.getRequests())[0].id, 'r')
  assert.equal(
    (await storage.getSchemaVersions(profile.id))[0].target,
    undefined,
  )
  await storage.saveSnapshot({ ...snapshot, id: 'captured' }, profile)
  const changed = structuredClone(snapshot)
  changed.id = 'captured'
  changed.entities = []
  await storage.saveSnapshot(changed, profile)
  assert.equal(
    (await storage.getSchemaVersions(profile.id)).find(
      (v) => v.id === 'captured',
    )!.entities.length,
    1,
  )
  for (let i = 0; i < 51; i++)
    await storage.saveSnapshot(
      {
        ...snapshot,
        id: `capture-${i}`,
        inspectedAt: new Date(1800000000000 + i).toISOString(),
      },
      profile,
    )
  const versions = await storage.getSchemaVersions(profile.id)
  assert.equal(versions.length, 50)
  assert.equal(versions[0].id, 'capture-50')
  assert.equal(versions.at(-1)!.id, 'capture-1')
  const other = { ...snapshot, id: 'other-version', profileId: 'other' }
  await storage.saveSnapshot(other)
  await storage.removeProfile(profile.id)
  assert.equal((await storage.getSchemaVersions(profile.id)).length, 0)
  assert.equal((await storage.getSchemaVersions('other')).length, 1)
  await storage.clearSnapshots()
  assert.equal((await storage.getSchemaVersions('other')).length, 0)
  assert.equal(await storage.getSnapshot('other'), undefined)
})
