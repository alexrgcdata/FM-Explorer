import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { entities, type Entity, type Profile } from '../src/lib/data.ts'
import { compileRequest } from '../src/lib/queries.ts'
import { generate } from '../src/lib/generators.ts'

const profile: Profile = {
  id: 'export-test',
  name: 'CRM',
  host: 'https://example.invalid',
  database: 'Sales & CRM',
  protocol: 'OData',
}
const query = {
  entity: 'Customers',
  conditions: [],
  match: 'all' as const,
  offset: 0,
  limit: 20,
}

test('date and timestamp filters reject invalid calendars, invalid times, and trailing expressions in both compilers', () => {
  for (const protocol of ['Data API', 'OData'] as const) {
    for (const [type, invalid] of [
      [
        'date',
        ['2025-02-29', '2026-04-31', '0000-01-01', '2026-10-29 or true'],
      ],
      [
        'timestamp',
        [
          '2026-02-30T12:00:00Z',
          '2026-10-29T24:00:00Z',
          '2026-10-29T12:60:00Z',
          '2026-10-29T12:00:60Z',
          '2026-10-29T12:00:00Z or Active eq true',
          '2026-10-29T12:00:00+99:00',
        ],
      ],
    ] as const) {
      const entity: Entity = {
        name: 'Customers',
        description: '',
        rows: [],
        fields: [{ name: 'Created', type, description: '' }],
      }
      for (const value of invalid)
        assert.throws(() =>
          compileRequest({ ...profile, protocol }, entity, {
            ...query,
            conditions: [
              {
                id: 'created-filter',
                field: 'Created',
                operator: 'equals',
                value,
              },
            ],
          }),
        )
      const value =
        type === 'date' ? '2024-02-29' : '2024-02-29T23:59:59.123456+05:30'
      assert.doesNotThrow(() =>
        compileRequest({ ...profile, protocol }, entity, {
          ...query,
          conditions: [
            {
              id: 'created-filter',
              field: 'Created',
              operator: 'equals',
              value,
            },
          ],
        }),
      )
    }
  }
})

test('generated interfaces compile for reserved words, numeric names, and hostile field comments', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'fm-export-'))
  try {
    const files = []
    for (const [index, name] of [
      'class',
      'default',
      'interface',
      'string',
      '9 Sales',
      '',
    ].entries()) {
      const entity: Entity = {
        ...entities[0],
        name,
        fields: [
          {
            name: 'quote"\nfield',
            type: 'text',
            description: '*/ export const injected = true; /*\nnew line',
          },
        ],
      }
      const file = join(folder, `${index}.ts`)
      await writeFile(file, generate(entity, 'typescript', 'OData'))
      files.push(file)
    }
    await promisify(execFile)(process.execPath, [
      resolve('node_modules/typescript/bin/tsc'),
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      ...files,
    ])
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})

test('Postman and OpenAPI use canonical encoded read endpoints rather than imported endpoint text', () => {
  const entity = {
    ...entities[0],
    name: 'Order Items / Special',
    endpoint: 'https://untrusted.invalid/other',
  }
  for (const protocol of ['Data API', 'OData'] as const) {
    const context = { profile: { ...profile, protocol } }
    const expected = compileRequest(context.profile, entity, {
      ...query,
      entity: entity.name,
    })
    const collection = JSON.parse(
      generate(entity, 'postman', protocol, context),
    )
    assert.equal(collection.item[0].request.url, `{{host}}${expected.path}`)
    assert.equal(
      collection.item[0].request.auth.type,
      protocol === 'Data API' ? 'bearer' : 'basic',
    )
    for (const variable of collection.variable.filter(
      (v: { key: string }) => v.key !== 'host',
    ))
      assert.equal(variable.value, '')
    const openapi = JSON.parse(generate(entity, 'openapi', protocol, context))
    assert.deepEqual(Object.keys(openapi.paths), [expected.path.split('?')[0]])
    assert.equal(JSON.stringify(openapi).includes('untrusted.invalid'), false)
  }
  const fmid = JSON.parse(
    generate(entity, 'postman', 'OData', { profile, auth: 'FMID token' }),
  )
  assert.equal(fmid.item[0].request.auth.type, 'noauth')
  assert.ok(
    fmid.item[0].request.header.some(
      (h: { value: string }) => h.value === 'FMID {{fmidToken}}',
    ),
  )
})
