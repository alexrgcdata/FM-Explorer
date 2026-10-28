import 'fake-indexeddb/auto'
import { after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { entities } from '../src/lib/data.ts'
import { labProfiles, type Snapshot } from '../src/lib/contracts.ts'
import { makeSchemaVersion } from '../src/lib/schema-history.ts'
import * as storage from '../src/lib/storage.ts'
import {
  buildWorkspaceArchive,
  parseWorkspaceArchive,
  importWorkspaceArchive,
  workspaceFileLimit,
} from '../src/lib/workspace-transfer.ts'
import type { SavedRequest } from '../src/lib/saved-requests.ts'
import type { KnowledgeNote } from '../src/lib/knowledge.ts'

const at = '2026-10-28T12:00:00.000Z'
const profile = {
  ...labProfiles[1],
  password: 'auth-sentinel',
  token: 'auth-sentinel',
}
const snapshot: Snapshot = {
  id: 's',
  profileId: profile.id,
  database: profile.database,
  protocol: profile.protocol,
  source: profile.host,
  inspectedAt: at,
  complete: true,
  warnings: [],
  entities: structuredClone(entities),
  relationships: [],
}
snapshot.entities[0].raw = { password: 'raw-sentinel' }
snapshot.entities[0].rows = [{ Email: 'record-sentinel' }]
const request: SavedRequest = {
  id: 'r',
  profileId: profile.id,
  protocol: profile.protocol,
  name: 'Customer check',
  description: '',
  query: {
    entity: 'Customers',
    conditions: [
      { id: 'c', field: 'Status', operator: 'equals', value: 'private-filter' },
    ],
    match: 'all',
    offset: 0,
    limit: 10,
  },
  expectations: { minRows: 1, fields: [] },
  revision: 1,
  createdAt: at,
  updatedAt: at,
}
const note: KnowledgeNote = {
  id: 'n',
  profileId: profile.id,
  entity: 'Customers',
  kind: 'workflow',
  status: 'draft',
  text: 'Private developer knowledge',
  origin: 'developer-authored',
  createdAt: at,
  updatedAt: at,
}
function fixture() {
  return buildWorkspaceArchive({
    profile,
    schemaVersions: [makeSchemaVersion(snapshot, profile)],
    savedRequests: [request],
    knowledgeNotes: [note],
  })
}
beforeEach(async () => {
  const db = await storage.database
  for (const name of [
    'profiles',
    'snapshots',
    'schemaVersions',
    'requests',
    'knowledgeNotes',
  ] as const)
    await db.clear(name)
})
after(async () => (await storage.database).close())

test('a write failure rolls back every imported store, including the new profile', async (t) => {
  const archive = fixture()
  archive.savedRequests.push({ ...archive.savedRequests[0], id: 'second' })
  t.mock.method(crypto, 'randomUUID', () => 'duplicate-generated-id')
  await assert.rejects(
    importWorkspaceArchive(archive),
    /already exists|ConstraintError/i,
  )
  assert.deepEqual(await storage.getProfiles(), [])
  assert.deepEqual(await storage.getRequests(), [])
  assert.deepEqual(await storage.getKnowledgeNotes(), [])
  assert.deepEqual(await storage.getSchemaVersions(profile.id), [])
  assert.equal(await storage.getSnapshot(profile.id), undefined)
})

test('real workspace restore remaps every item to the new profile and keeps differently named connections separate', async () => {
  const real = {
    id: 'original-real',
    name: 'Read-only CRM',
    host: 'https://fm.example.test',
    database: profile.database,
    protocol: profile.protocol,
  }
  const realSnapshot = { ...snapshot, profileId: real.id, source: real.host }
  const archive = buildWorkspaceArchive({
    profile: real,
    schemaVersions: [makeSchemaVersion(realSnapshot, real)],
    savedRequests: [{ ...request, profileId: real.id }],
    knowledgeNotes: [{ ...note, profileId: real.id }],
  })
  await storage.saveProfile({
    ...real,
    id: 'different-role',
    name: 'Admin CRM',
  })
  const result = await importWorkspaceArchive(archive)
  assert.notEqual(result.profile.id, real.id)
  assert.notEqual(result.profile.id, 'different-role')
  assert.equal((await storage.getProfiles()).length, 2)
  assert.equal((await storage.getRequests())[0].profileId, result.profile.id)
  assert.equal(
    (await storage.getKnowledgeNotes())[0].profileId,
    result.profile.id,
  )
  assert.equal((await storage.getSchemaVersions(result.profile.id)).length, 1)
  assert.equal(
    (await storage.getSnapshot(result.profile.id))?.profileId,
    result.profile.id,
  )
  assert.equal((await storage.getSchemaVersions('different-role')).length, 0)
  const second = await importWorkspaceArchive(archive)
  assert.equal(second.profile.id, result.profile.id)
  assert.equal((await storage.getProfiles()).length, 2)
  assert.equal((await storage.getRequests()).length, 2)
})

test('workspace exports allowlisted schema, definitions and notes, excluding auth fields and raw records', () => {
  const version = {
    ...makeSchemaVersion(snapshot, profile),
    entities: snapshot.entities,
  }
  const archive = buildWorkspaceArchive({
    profile,
    schemaVersions: [version],
    savedRequests: [{ ...request, token: 'injected' } as SavedRequest],
    knowledgeNotes: [note],
  })
  const content = JSON.stringify(archive)
  for (const sentinel of [
    'auth-sentinel',
    'record-sentinel',
    'raw-sentinel',
    'injected',
  ])
    assert.equal(content.includes(sentinel), false)
  assert.ok(content.includes('private-filter'))
  assert.ok(content.includes('Private developer knowledge'))
  assert.deepEqual(archive.schemaVersions[0].entities[0].rows, [])
  assert.deepEqual(parseWorkspaceArchive(content), JSON.parse(content))
  const older = { ...version, target: undefined, apiVersion: undefined }
  const legacy = buildWorkspaceArchive({
    profile,
    schemaVersions: [older],
    savedRequests: [],
    knowledgeNotes: [],
  })
  assert.equal(
    legacy.schemaVersions[0].target,
    undefined,
    'Export must not invent missing historical provenance',
  )
  assert.throws(
    () =>
      buildWorkspaceArchive({
        profile,
        schemaVersions: [
          { ...version, target: 'https://different.example.test' },
        ],
        savedRequests: [],
        knowledgeNotes: [],
      }),
    /sources must match/,
  )
})

test('import rejects invalid JSON, future formats, foreign-profile items, duplicate IDs and records before writes', async () => {
  assert.throws(() => parseWorkspaceArchive('not json'), /not valid JSON/)
  assert.throws(
    () => parseWorkspaceArchive(' '.repeat(workspaceFileLimit + 1)),
    /10 MB/,
  )
  for (const mutate of [
    (v: any) => {
      v.profile.name = 'Forged lab name'
    },
    (v: any) => {
      v.profile.apiVersion = 'v2'
    },
    (v: any) => {
      v.version = 2
    },
    (v: any) => {
      v.sessions = []
    },
    (v: any) => {
      v.savedRequests[0].profileId = 'other'
    },
    (v: any) => {
      v.savedRequests.push(v.savedRequests[0])
    },
    (v: any) => {
      v.schemaVersions[0].entities[0].rows = [{ email: 'private' }]
    },
    (v: any) => {
      v.schemaVersions[0].target = 'https://other.test'
    },
    (v: any) => {
      v.schemaVersions[0].protocol = 'Data API'
    },
    (v: any) => {
      v.savedRequests[0].query.limit = 500
    },
  ]) {
    const input = fixture()
    mutate(input)
    await assert.rejects(importWorkspaceArchive(input), /cannot be imported/)
  }
  assert.deepEqual(await storage.getProfiles(), [])
})

test('lab-only website imports reject real hosts and embedded credentials; valid real imports stay disconnected', async () => {
  const lab = fixture()
  lab.profile = {
    id: 'real',
    name: 'Private CRM',
    host: 'https://fm.example.test',
    database: 'CRM',
    protocol: 'OData',
  }
  lab.schemaVersions = []
  lab.savedRequests = []
  lab.knowledgeNotes = []
  assert.throws(
    () => parseWorkspaceArchive(JSON.stringify(lab), true),
    /bundled lab/,
  )
  for (const host of [
    'https://name:secret@fm.example.test',
    'http://fm.example.test',
    'https://fm.example.test/?token=secret',
    'https://fm.example.test/path',
  ]) {
    assert.throws(
      () =>
        parseWorkspaceArchive(
          JSON.stringify({ ...lab, profile: { ...lab.profile, host } }),
        ),
      /cannot be imported/,
    )
  }
  const result = await importWorkspaceArchive(lab)
  assert.notEqual(result.profile.id, 'real')
  assert.equal((await storage.getProfiles()).length, 1)
  assert.equal(await storage.getSnapshot(result.profile.id), undefined)
  assert.deepEqual(await storage.getActivity(), [])
})

test('restoring adds independent copies and preserves existing definitions and latest schema', async () => {
  await storage.saveProfile(profile)
  await storage.saveRequest(request)
  await storage.saveKnowledgeNote(note)
  await storage.saveSnapshot(snapshot, profile)
  const result = await importWorkspaceArchive(fixture(), true)
  assert.equal(result.profile.id, profile.id)
  assert.equal(result.requests, 1)
  assert.equal((await storage.getProfiles()).length, 1)
  const requests = await storage.getRequests()
  assert.equal(requests.length, 2)
  assert.deepEqual(
    requests.find((r) => r.id === 'r'),
    request,
  )
  assert.equal(new Set(requests.map((r) => r.id)).size, 2)
  assert.equal((await storage.getKnowledgeNotes()).length, 2)
  assert.equal((await storage.getSchemaVersions(profile.id)).length, 2)
  assert.equal((await storage.getSnapshot(profile.id))?.id, 's')
})

test('capacity failure is atomic and schema history capacity keeps existing versions', async () => {
  await storage.saveProfile(profile)
  for (let i = 0; i < 100; i++)
    await storage.saveRequest({ ...request, id: `existing-${i}` })
  await assert.rejects(importWorkspaceArchive(fixture()), /nothing was changed/)
  assert.equal((await storage.getRequests()).length, 100)
  assert.equal((await storage.getKnowledgeNotes()).length, 0)
  assert.equal((await storage.getSchemaVersions(profile.id)).length, 0)
  assert.equal(await storage.getSnapshot(profile.id), undefined)
  const db = await storage.database
  await db.clear('requests')
  for (let i = 0; i < 50; i++)
    await db.put('schemaVersions', {
      ...makeSchemaVersion(snapshot, profile),
      id: `v-${i}`,
    })
  const result = await importWorkspaceArchive(fixture())
  assert.equal(result.versions, 0)
  assert.equal(result.skippedVersions, 1)
  assert.equal((await storage.getSchemaVersions(profile.id)).length, 50)
})
