import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildServer } from '../server/index.ts'
import {
  ApiError,
  authenticate,
  discover,
  readResponse,
  records,
  type Adapter,
} from '../server/adapters.ts'
import { labProfiles, type Query } from '../src/lib/contracts.ts'
import { compileRequest, escapeFind } from '../src/lib/queries.ts'
import { generate } from '../src/lib/generators.ts'
import { entities } from '../src/lib/data.ts'

const app = await buildServer({ serveStatic: false, port: 4186 })
after(async () => app.close())
async function client() {
  const response = await app.inject({
    method: 'GET',
    url: '/api/bootstrap',
    headers: { host: '127.0.0.1:4186' },
  })
  assert.equal(response.statusCode, 200)
  const cookie = String(response.headers['set-cookie']).split(';')[0]
  const token = response.json().workspaceToken as string
  return {
    host: '127.0.0.1:4186',
    origin: 'http://127.0.0.1:4186',
    cookie,
    'x-workspace-token': token,
  }
}
async function connected(protocol: 'Data API' | 'OData') {
  const headers = await client()
  const profile = labProfiles.find((p) => p.protocol === protocol)!
  const response = await app.inject({
    method: 'POST',
    url: '/api/connect',
    headers,
    payload: { profile, auth: { mode: 'lab' } },
  })
  assert.equal(response.statusCode, 200, response.body)
  return { headers, ...response.json() }
}
const baseQuery: Query = {
  entity: 'Customers',
  conditions: [],
  match: 'all',
  offset: 0,
  limit: 10,
}

test('workspace rejects cross-origin requests, missing CSRF tokens, and wrong Host', async () => {
  const headers = await client()
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/connect',
        headers: { ...headers, origin: 'https://attacker.example' },
        payload: {},
      })
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/connect',
        headers: { ...headers, 'x-workspace-token': '' },
        payload: {},
      })
    ).statusCode,
    401,
  )
  assert.equal(
    (
      await app.inject({
        method: 'GET',
        url: '/api/bootstrap',
        headers: { host: 'attacker.example' },
      })
    ).statusCode,
    403,
  )
})
test('Data API issues an owned local session, discovers layouts, pages, sorts, finds, and logs out', async () => {
  const c = await connected('Data API')
  assert.equal(c.snapshot.entities.length, 6)
  assert.equal(
    c.snapshot.entities.reduce(
      (n: number, e: { fields: unknown[] }) => n + e.fields.length,
      0,
    ),
    42,
  )
  assert.equal(c.snapshot.relationships[0].evidence.includes('fixture'), true)
  assert.equal(JSON.stringify(c).includes('Bearer '), false)
  const page = await app.inject({
    method: 'POST',
    url: `/api/sessions/${c.session.id}/records`,
    headers: c.headers,
    payload: { ...baseQuery, sort: { field: 'FullName', direction: 'asc' } },
  })
  assert.equal(page.statusCode, 200, page.body)
  assert.equal(page.json().rows.length, 10)
  assert.equal(page.json().found, 18)
  assert.equal(page.json().rows[0].FullName, 'Amelia Lewis')
  assert.equal(page.json().recordMeta[0].recordId, '13')
  const found = await app.inject({
    method: 'POST',
    url: `/api/sessions/${c.session.id}/records`,
    headers: c.headers,
    payload: {
      ...baseQuery,
      conditions: [
        { id: 'status', field: 'Status', operator: 'equals', value: 'Pending' },
      ],
    },
  })
  assert.equal(found.json().rows.length, 3)
  assert.equal(found.json().request.method, 'POST')
  assert.equal(
    found.json().rows.every((r: { Status: string }) => r.Status === 'Pending'),
    true,
  )
  const empty = await app.inject({
    method: 'POST',
    url: `/api/sessions/${c.session.id}/records`,
    headers: c.headers,
    payload: {
      ...baseQuery,
      conditions: [
        {
          id: 'empty',
          field: 'FullName',
          operator: 'equals',
          value: 'No match exists',
        },
      ],
    },
  })
  assert.equal(empty.statusCode, 200)
  assert.deepEqual(empty.json().rows, [])
  assert.equal(empty.json().found, 0)
  const stranger = await client()
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/sessions/${c.session.id}/records`,
        headers: stranger,
        payload: baseQuery,
      })
    ).statusCode,
    401,
  )
  const disconnected = await app.inject({
    method: 'DELETE',
    url: `/api/sessions/${c.session.id}`,
    headers: c.headers,
  })
  assert.equal(disconnected.statusCode, 200)
  assert.equal(disconnected.json().remoteSessionClosed, true)
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/sessions/${c.session.id}/records`,
        headers: c.headers,
        payload: baseQuery,
      })
    ).statusCode,
    401,
  )
})
test('OData parses metadata, navigation, filters, and follows server-sized continuation pages without skipping rows', async () => {
  const c = await connected('OData')
  assert.equal(c.snapshot.entities.length, 6)
  assert.equal(c.snapshot.relationships.length, 5)
  assert.equal(c.snapshot.entities[0].fields[0].key, true)
  const first = await app.inject({
    method: 'POST',
    url: `/api/sessions/${c.session.id}/records`,
    headers: c.headers,
    payload: baseQuery,
  })
  assert.equal(first.statusCode, 200, first.body)
  assert.equal(first.json().rows.length, 7)
  assert.equal(first.json().found, 18)
  const second = await app.inject({
    method: 'POST',
    url: `/api/sessions/${c.session.id}/records`,
    headers: c.headers,
    payload: { ...baseQuery, offset: 7, cursor: first.json().nextCursor },
  })
  assert.equal(second.statusCode, 200, second.body)
  assert.equal(second.json().rows[0].CustomerID, 'CUS-0008')
  const third = await app.inject({
    method: 'POST',
    url: `/api/sessions/${c.session.id}/records`,
    headers: c.headers,
    payload: { ...baseQuery, offset: 14, cursor: second.json().nextCursor },
  })
  assert.equal(third.json().rows.length, 4)
  assert.equal(third.json().hasNext, false)
  const ids = [
    ...first.json().rows,
    ...second.json().rows,
    ...third.json().rows,
  ].map((r) => r.CustomerID)
  assert.equal(new Set(ids).size, 18)
  const filtered = await app.inject({
    method: 'POST',
    url: `/api/sessions/${c.session.id}/records`,
    headers: c.headers,
    payload: {
      ...baseQuery,
      conditions: [
        {
          id: 'name',
          field: 'FullName',
          operator: 'contains',
          value: 'Olivia',
        },
      ],
    },
  })
  assert.equal(filtered.json().found, 1)
  assert.equal(filtered.json().rows[0].FullName, 'Olivia Chen')
})
test('typed endpoints reject scripts, unknown fields, write routes, bad authentication modes and oversized pages', async () => {
  const c = await connected('Data API'),
    url = `/api/sessions/${c.session.id}/records`
  for (const payload of [
    { ...baseQuery, script: 'Dangerous' },
    { ...baseQuery, limit: 10000 },
    {
      ...baseQuery,
      conditions: [
        { id: 'bad', field: 'NotAField', operator: 'equals', value: 'x' },
      ],
    },
  ])
    assert.equal(
      (await app.inject({ method: 'POST', url, headers: c.headers, payload }))
        .statusCode,
      400,
    )
  assert.equal(
    (
      await app.inject({
        method: 'PATCH',
        url: `/api/sessions/${c.session.id}/records/1`,
        headers: c.headers,
        payload: {},
      })
    ).statusCode,
    404,
  )
  const profile = {
    ...labProfiles[0],
    id: 'external',
    lab: false,
    host: 'http://127.0.0.1:1234',
  }
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/connect',
        headers: c.headers,
        payload: { profile, auth: { mode: 'lab' } },
      })
    ).statusCode,
    400,
  )
})
test('query compiler escapes FileMaker metacharacters, quotes OData names, keeps native literals and rejects duplicates', () => {
  assert.equal(escapeFind('a*@x\\y'), 'a\\*\\@x\\\\y')
  const entity = {
    name: 'Company People',
    description: '',
    rows: [],
    fields: [
      { name: 'Display_Name', type: 'text' as const, description: '' },
      { name: 'Amount', type: 'number' as const, description: '' },
    ],
  }
  const profile = {
    id: 'p',
    name: 'p',
    database: 'CRM & Co',
    host: 'https://example.com',
    protocol: 'OData' as const,
  }
  const query = {
    ...baseQuery,
    entity: entity.name,
    conditions: [
      {
        id: '1',
        field: 'Display_Name',
        operator: 'equals' as const,
        value: "O'Brien",
      },
    ],
  }
  const request = compileRequest(profile, entity, query)
  assert.equal(
    new URL(request.path, 'https://example.com').searchParams.get('$filter'),
    "\"Display_Name\" eq 'O''Brien'",
  )
  assert.equal(request.path.includes('CRM%20%26%20Co'), true)
  assert.throws(
    () =>
      compileRequest(profile, entity, {
        ...query,
        conditions: [...query.conditions, ...query.conditions],
      }),
    /each field once/,
  )
  assert.throws(
    () =>
      compileRequest(profile, entity, {
        ...query,
        conditions: [
          { id: '2', field: 'Amount', operator: 'equals', value: 'NaN' },
        ],
      }),
    /valid number/,
  )
  const ts = generate(
    { ...entity, name: '123 Weird-Table' },
    'typescript',
    'OData',
  )
  assert.match(ts, /interface Resource_123_Weird_Table/)
  assert.match(ts, /"Display_Name"\?/)
  const json = JSON.parse(generate(entity, 'jsonschema', 'OData'))
  assert.ok(json.properties.Display_Name)
  assert.equal(json.required.length, 0)
})
test('lossless response handling preserves large integers, decimal strings, nulls and booleans', async () => {
  const result = (await readResponse(
    new Response(
      '{"big":9007199254740993123,"money":123456789.123456789,"nil":null,"flag":false}',
    ),
  )) as Record<string, unknown>
  assert.equal(result.big, '9007199254740993123')
  assert.equal(result.money, '123456789.123456789')
  assert.equal(result.nil, null)
  assert.equal(result.flag, false)
})
test('metadata parser rejects external entities and DOCTYPE declarations', async () => {
  const profile = { ...labProfiles[1], lab: false, host: 'https://example.com' }
  const bad = await authenticate(
    profile,
    { mode: 'password', username: 'test', password: 'test' },
    async () => '<DOCTYPE test>',
  )
  bad.transport = async () =>
    '<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///private">]><Edmx/>'
  await assert.rejects(() => discover(bad), /Unsupported XML/)
})
test('OData continuation cannot send authorization to another origin or resource', async () => {
  const adapter: Adapter = {
    profile: { ...labProfiles[1], host: 'https://example.com', lab: false },
    authorization: 'Basic placeholder',
    ownsToken: false,
    cursors: new Map(),
    transport: async () => ({
      value: [],
      ['@odata.nextLink']: 'https://attacker.example/steal',
    }),
    snapshot: {
      id: 's',
      profileId: 'p',
      database: 'Northstar_CRM',
      protocol: 'OData',
      source: 'test',
      inspectedAt: 'now',
      entities: [entities[0]],
      relationships: [],
      warnings: [],
      complete: true,
    },
  }
  await assert.rejects(
    () => records(adapter, baseQuery),
    (error) =>
      error instanceof ApiError &&
      error.message.includes('outside this resource'),
  )
})
test('an expired Data API token is surfaced as reauthentication, never as empty data', async () => {
  const adapter: Adapter = {
    profile: labProfiles[0],
    authorization: 'Bearer placeholder',
    ownsToken: false,
    cursors: new Map(),
    transport: async () => ({ messages: [{ code: '952' }], response: {} }),
    snapshot: {
      id: 's',
      profileId: 'p',
      database: 'Northstar_CRM',
      protocol: 'Data API',
      source: 'test',
      inspectedAt: 'now',
      entities: [entities[0]],
      relationships: [],
      warnings: [],
      complete: true,
    },
  }
  await assert.rejects(
    () => records(adapter, baseQuery),
    (error) => error instanceof ApiError && error.status === 401,
  )
})
test('FileMaker no-match errors carried in HTTP 500 are preserved for adapter handling', async () => {
  const result = (await readResponse(
    new Response(
      JSON.stringify({
        messages: [{ code: '401', message: 'No records match' }],
        response: {},
      }),
      { status: 500 },
    ),
    false,
    true,
  )) as { messages: { code: string }[] }
  assert.equal(result.messages[0].code, '401')
  await assert.rejects(
    () =>
      readResponse(new Response('proxy failure', { status: 500 }), false, true),
    (error) => error instanceof ApiError && error.code === 'HTTP_500',
  )
})
test('an existing session token can be used without taking ownership or revoking it', async () => {
  const native = await app.inject({method:'POST',url:'/fmi/data/vLatest/databases/Northstar_CRM/sessions',payload:{}})
  const token = native.json().response.token as string
  const headers = await client()
  const connected = await app.inject({method:'POST',url:'/api/connect',headers,payload:{profile:labProfiles[0],auth:{mode:'token',token}}})
  assert.equal(connected.statusCode,200)
  const sessionId=connected.json().session.id as string
  const disconnected=await app.inject({method:'DELETE',url:`/api/sessions/${sessionId}`,headers})
  assert.equal(disconnected.json().remoteSessionClosed,false)
  const stillValid=await app.inject({method:'GET',url:'/fmi/data/vLatest/databases/Northstar_CRM/layouts',headers:{authorization:`Bearer ${token}`}})
  assert.equal(stillValid.statusCode,200)
  const rejected=await app.inject({method:'POST',url:'/api/connect',headers,payload:{profile:labProfiles[0],auth:{mode:'token',token:'invalid-local-fixture-token'}}})
  assert.equal(rejected.statusCode,401)
})
