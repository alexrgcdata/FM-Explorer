import 'fake-indexeddb/auto'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openDB } from 'idb'
import { unzipSync, strFromU8 } from 'fflate'
import { entities } from '../src/lib/data.ts'
import { labProfiles, type Snapshot } from '../src/lib/contracts.ts'
import {
  buildHandoffFiles,
  createHandoffZip,
  filterKey,
  type HandoffInput,
} from '../src/lib/handoff.ts'
import { makeSchemaVersion } from '../src/lib/schema-history.ts'
import { evaluateCheck, type SavedRequest } from '../src/lib/saved-requests.ts'
import {
  knowledgeNoteSchema,
  type KnowledgeNote,
} from '../src/lib/knowledge.ts'
import { buildServer } from '../server/index.ts'

const profile = labProfiles[1],
  at = '2026-10-26T12:00:00.000Z'
const snapshot: Snapshot = {
  id: 'snapshot',
  profileId: profile.id,
  database: profile.database,
  protocol: 'OData',
  source: 'Local practice server',
  inspectedAt: at,
  complete: true,
  warnings: ['Account-visible scope only.'],
  entities: structuredClone(entities),
  relationships: [
    {
      source: 'Customers',
      target: 'Orders',
      field: 'CustomerID',
      label: 'many',
      evidence: 'fixture',
    },
  ],
}
snapshot.entities[0].rows = [{ Email: 'row-sentinel' }]
snapshot.entities[0].raw = { token: 'raw-sentinel' }
const request: SavedRequest = {
  id: 'r',
  profileId: profile.id,
  name: 'Active customer read',
  description: 'Read integration',
  protocol: 'OData',
  query: {
    entity: 'Customers',
    conditions: [
      {
        id: 'c',
        field: 'Status',
        operator: 'equals',
        value: 'private-filter-sentinel',
      },
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
  createdAt: at,
  updatedAt: at,
}
const note: KnowledgeNote = {
  id: 'n',
  profileId: profile.id,
  entity: 'Customers',
  field: 'Status',
  kind: 'status-meaning',
  status: 'confirmed',
  text: 'The owner confirmed these workflow meanings.',
  origin: 'developer-authored',
  createdAt: at,
  updatedAt: at,
}
function input(): HandoffInput {
  return {
    profile,
    snapshot,
    entities: ['Customers'],
    requests: [request],
    notes: [
      note,
      {
        ...note,
        id: 'draft',
        status: 'draft',
        text: 'Unverified workflow assumption.',
      },
    ],
    runs: [],
    reviewedValues: {},
    includeReviewedValues: false,
  }
}
const exec = promisify(execFile)
const scratch = await mkdtemp(join(tmpdir(), 'fm-handoff-'))
after(async () => {
  await rm(scratch, { recursive: true, force: true })
})
async function writeBundle(files: Record<string, string>, folder: string) {
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(folder, name)), { recursive: true })
    await writeFile(join(folder, name), content)
  }
}

test('selected package excludes records, raw auth and unrelated resources while separating human knowledge', () => {
  const config = input()
  config.requests.push({ ...request, id: 'other', profileId: 'other' })
  config.notes.push({ ...note, id: 'other', profileId: 'other' })
  const files = buildHandoffFiles(config),
    all = Object.values(files).join('\n'),
    schema = JSON.parse(files['schema.json']),
    manifest = JSON.parse(files['manifest.json'])
  assert.equal(schema.entities.length, 1)
  assert.equal(schema.entities[0].name, 'Customers')
  assert.deepEqual(schema.entities[0].rows, [])
  assert.deepEqual(schema.relationships, [])
  assert.equal(manifest.selection.omittedRelationships, 1)
  for (const secret of [
    'row-sentinel',
    'raw-sentinel',
    'private-filter-sentinel',
  ])
    assert.equal(all.includes(secret), false)
  assert.equal(manifest.selection.requestCount, 1)
  assert.equal(manifest.selection.noteCount, 2)
  assert.match(files['CONTEXT.md'], /Human-confirmed knowledge/)
  assert.match(files['CONTEXT.md'], /Draft notes — not verified/)
  assert.equal(manifest.privacy.credentialsIncluded, false)
  assert.equal(
    JSON.parse(files['requests.json']).requests[0].requiresFilterValues,
    true,
  )
  assert.equal(
    JSON.parse(files['api-examples.json']).items.find(
      (r: { key: string }) => r.key === 'request-001',
    ).request,
    null,
  )
})
test('review is explicit per value, typed, and cannot silently broaden a partially redacted request', () => {
  const config = input()
  config.reviewedValues[filterKey('r', 'c')] = 'Approved'
  assert.equal(
    Object.values(buildHandoffFiles(config)).join('').includes('Approved'),
    false,
  )
  config.includeReviewedValues = true
  let files = buildHandoffFiles(config),
    examples = JSON.parse(files['api-examples.json'])
  assert.equal(examples.items[1].requiresFilterValues, false)
  assert.ok(examples.items[1].request.path.includes('Approved'))
  assert.equal(
    JSON.parse(files['requests.json']).requests[0].query.conditions[0].value,
    'Approved',
  )
  config.requests = [
    {
      ...request,
      query: {
        ...request.query,
        conditions: [
          ...request.query.conditions,
          { id: 'c2', field: 'TotalOrders', operator: 'greater', value: '1' },
        ],
      },
    },
  ]
  files = buildHandoffFiles(config)
  assert.equal(JSON.parse(files['api-examples.json']).items[1].request, null)
  config.reviewedValues[filterKey('r', 'c2')] = 'invalid-number'
  examples = JSON.parse(buildHandoffFiles(config)['api-examples.json'])
  assert.equal(examples.items[1].request, null)
  assert.match(examples.items[1].problem, /cannot be compiled/)
})
test('scope mismatch is rejected and request error details omit original response error text', () => {
  assert.throws(
    () => buildHandoffFiles({ ...input(), entities: [] }),
    /Select at least/,
  )
  assert.throws(
    () => buildHandoffFiles({ ...input(), entities: ['Unknown'] }),
    /absent/,
  )
  assert.throws(
    () =>
      buildHandoffFiles({
        ...input(),
        snapshot: { ...snapshot, profileId: 'other' },
      }),
    /does not match/,
  )
  const config = input()
  config.runs = [
    {
      ...evaluateCheck(request, {
        rows: [],
        total: null,
        found: null,
        hasNext: false,
        request: { method: 'GET', path: '/' },
        elapsedMs: 1,
        warnings: [],
      }),
      id: 'run',
      at,
      status: 'error',
      error: 'upstream-private-sentinel',
    },
  ]
  assert.equal(
    Object.values(buildHandoffFiles(config))
      .join('')
      .includes('upstream-private-sentinel'),
    false,
  )
})
test('ZIP round trip validates all manifest hashes and generated TypeScript modules compile', async () => {
  const { bytes, files } = await createHandoffZip(input()),
    unzipped = unzipSync(bytes),
    manifest = JSON.parse(strFromU8(unzipped['manifest.json']))
  assert.ok(bytes.byteLength > 1000)
  for (const [name, record] of Object.entries(manifest.files) as [
    string,
    { sha256: string; bytes: number },
  ][]) {
    assert.equal(
      createHash('sha256').update(unzipped[name]).digest('hex'),
      record.sha256,
    )
    assert.equal(unzipped[name].byteLength, record.bytes)
  }
  assert.equal(
    Object.keys(manifest.files).length,
    Object.keys(unzipped).length - 1,
  )
  const folder = join(scratch, 'types')
  await writeBundle(files, folder)
  await exec(process.execPath, [
    resolve('node_modules/typescript/bin/tsc'),
    '--ignoreConfig',
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    '--target',
    'ES2022',
    join(folder, 'types/resource-001.ts'),
  ])
})
test('hostile resource names cannot create paths or inject TypeScript statements through comments', async () => {
  const config = input(),
    name = '../Bad\rconsole.log("injected")'
  config.snapshot = structuredClone(snapshot)
  config.snapshot.entities = [{ ...config.snapshot.entities[0], name }]
  config.entities = [name]
  config.requests = []
  config.notes = []
  const files = buildHandoffFiles(config)
  assert.ok(
    Object.keys(files).every(
      (name) => !name.includes('..') && !name.startsWith('/'),
    ),
  )
  const folder = join(scratch, 'hostile')
  await writeBundle(files, folder)
  await exec(process.execPath, [
    resolve('node_modules/typescript/bin/tsc'),
    '--ignoreConfig',
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    '--target',
    'ES2022',
    join(folder, 'types/resource-001.ts'),
  ])
})
test('standalone runner lists without network, blocks redacted reads, and exercises a native OData lab read', async () => {
  const folder = join(scratch, 'runner')
  await writeBundle(buildHandoffFiles(input()), folder)
  const listed = await exec(process.execPath, [join(folder, 'read.mjs')])
  assert.match(listed.stdout, /resource-001/)
  await assert.rejects(
    exec(process.execPath, [join(folder, 'read.mjs'), 'request-001']),
    (error) => {
      assert.match(
        (error as Error & { stderr: string }).stderr,
        /No request was sent/,
      )
      return true
    },
  )
  const app = await buildServer({ serveStatic: false, port: 4186 })
  await app.listen({ port: 0, host: '127.0.0.1' })
  try {
    const address = app.server.address()
    assert.ok(address && typeof address !== 'string')
    const result = await exec(
      process.execPath,
      [join(folder, 'read.mjs'), 'resource-001'],
      {
        env: {
          ...process.env,
          FM_HOST: `http://127.0.0.1:${address.port}`,
          FM_AUTHORIZATION: 'Basic bGFiOmxhYg==',
        },
      },
    )
    assert.equal(JSON.parse(result.stdout).value.length, 7)
    assert.equal(result.stdout.includes('Basic'), false)
  } finally {
    await app.close()
  }
})

test('standalone Data API saved find retains its reviewed filter and uses an externally supplied token', async () => {
  const p = labProfiles[0],
    config = input()
  config.profile = p
  config.snapshot = { ...snapshot, profileId: p.id, protocol: 'Data API' }
  config.requests = [{ ...request, profileId: p.id, protocol: 'Data API' }]
  config.includeReviewedValues = true
  config.reviewedValues[filterKey('r', 'c')] = 'Active'
  const folder = join(scratch, 'data-api')
  await writeBundle(buildHandoffFiles(config), folder)
  const app = await buildServer({ serveStatic: false, port: 4186 })
  await app.listen({ port: 0, host: '127.0.0.1' })
  try {
    const login = await app.inject({
      method: 'POST',
      url: '/fmi/data/vLatest/databases/Northstar_CRM/sessions',
      payload: {},
    })
    const token = login.json().response.token
    const address = app.server.address()
    assert.ok(address && typeof address !== 'string')
    const result = await exec(
      process.execPath,
      [join(folder, 'read.mjs'), 'request-001'],
      {
        env: {
          ...process.env,
          FM_HOST: `http://127.0.0.1:${address.port}`,
          FM_AUTHORIZATION: `Bearer ${token}`,
        },
      },
    )
    const rows = JSON.parse(result.stdout).response.data
    assert.equal(rows.length, 10)
    assert.ok(
      rows.every(
        (r: { fieldData: { Status: string } }) =>
          r.fieldData.Status === 'Active',
      ),
    )
    assert.equal(result.stdout.includes(token), false)
  } finally {
    await app.close()
  }
})

const legacy = await openDB('fm-api-explorer', 3, {
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
    db.createObjectStore('schemaVersions', { keyPath: 'id' }).createIndex(
      'by-profile',
      'profileId',
    )
  },
})
await legacy.put('schemaVersions', makeSchemaVersion(snapshot, profile))
await legacy.put('requests', request)
legacy.close()
const storage = await import('../src/lib/storage.ts')
after(async () => {
  ;(await storage.database).close()
})
test('v3 migration preserves schema and checks; notes persist, strip auth extras and cascade by connection', async () => {
  assert.equal((await storage.database).version, 4)
  assert.equal((await storage.getSchemaVersions(profile.id)).length, 1)
  assert.equal((await storage.getRequests()).length, 1)
  await storage.saveKnowledgeNote({
    ...note,
    password: 'auth-sentinel',
  } as KnowledgeNote)
  assert.equal((await storage.getKnowledgeNotes())[0].status, 'confirmed')
  assert.equal(
    JSON.stringify(await storage.getKnowledgeNotes()).includes('auth-sentinel'),
    false,
  )
  assert.equal(
    knowledgeNoteSchema.safeParse({ ...note, text: '   ' }).success,
    false,
  )
  await storage.saveKnowledgeNote({ ...note, id: 'other', profileId: 'other' })
  await storage.removeProfile(profile.id)
  assert.equal((await storage.getKnowledgeNotes()).length, 1)
  assert.equal((await storage.getKnowledgeNotes())[0].profileId, 'other')
  await storage.deleteKnowledgeNote('other')
  assert.deepEqual(await storage.getKnowledgeNotes(), [])
})
