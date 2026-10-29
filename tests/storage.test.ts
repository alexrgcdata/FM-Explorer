import 'fake-indexeddb/auto'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import * as storage from '../src/lib/storage.ts'
import type { Snapshot } from '../src/lib/contracts.ts'
import { entities } from '../src/lib/data.ts'

after(async () => {
  ;(await storage.database).close()
})
test('IndexedDB profiles discard unexpected credentials and snapshots never retain loaded records', async () => {
  const profile = {
    id: 'p',
    name: 'Private connection',
    host: 'https://example.com',
    database: 'CRM',
    protocol: 'Data API' as const,
    password: 'synthetic-sentinel',
    token: 'synthetic-sentinel',
  }
  await storage.saveProfile(profile)
  const profiles = await storage.getProfiles()
  assert.equal(JSON.stringify(profiles).includes('synthetic-sentinel'), false)
  const snapshot: Snapshot = {
    id: 's',
    profileId: 'p',
    database: 'CRM',
    protocol: 'Data API',
    source: 'test',
    inspectedAt: new Date().toISOString(),
    entities: [entities[0]],
    relationships: [],
    warnings: [],
    complete: true,
  }
  snapshot.entities = structuredClone(snapshot.entities)
  snapshot.entities[0].raw = {
    response: [{ Email: 'raw-response-sentinel' }],
    token: 'raw-auth-sentinel',
  }
  Object.assign(snapshot, { token: 'top-level-sentinel' })
  await storage.saveSnapshot(snapshot)
  const restored = await storage.getSnapshot('p')
  assert.equal(restored?.entities[0].fields.length, 10)
  assert.deepEqual(restored?.entities[0].rows, [])
  const persisted = await (await storage.database).get('snapshots', 'p')
  for (const sentinel of [
    'raw-response-sentinel',
    'raw-auth-sentinel',
    'top-level-sentinel',
  ]) {
    assert.equal(JSON.stringify(persisted).includes(sentinel), false)
  }
  assert.equal(
    JSON.stringify(restored).includes('olivia.chen@example.com'),
    false,
  )
  await storage.setPreference('favorites', { p: ['Customers'] })
  assert.deepEqual(await storage.preference('favorites', {}), {
    p: ['Customers'],
  })
  await storage.saveActivity({
    id: 'a',
    profileId: 'p',
    at: new Date().toISOString(),
    action: 'Connected',
    success: true,
    detail: 'Metadata inspected',
  })
  assert.equal((await storage.getActivity()).length, 1)
  await storage.removeProfile('p')
  assert.equal((await storage.getProfiles()).length, 0)
  assert.equal(await storage.getSnapshot('p'), undefined)
  assert.equal((await storage.getActivity()).length, 0)
})

test('cached snapshots from older releases discard raw payloads on read and keep only metadata counts', async () => {
  const old: Snapshot = {
    id: 'old',
    profileId: 'legacy',
    database: 'CRM',
    protocol: 'OData',
    source: 'fixture',
    inspectedAt: new Date().toISOString(),
    complete: true,
    warnings: [],
    relationships: [],
    entities: [
      {
        ...structuredClone(entities[0]),
        count: 18,
        raw: { records: [{ Email: 'legacy-private-value' }] },
      },
    ],
  }
  const db = await storage.database
  await db.put('snapshots', old)
  const restored = await storage.getSnapshot('legacy')
  assert.equal(restored?.entities[0].count, 18)
  assert.equal(JSON.stringify(restored).includes('legacy-private-value'), false)
  assert.equal(
    JSON.stringify(await db.get('snapshots', 'legacy')).includes(
      'legacy-private-value',
    ),
    false,
  )
})
