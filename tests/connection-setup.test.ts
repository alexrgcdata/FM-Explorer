import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readEndpoint,
  connectionRequest,
  validateDatabaseName,
} from '../src/lib/connection-setup.ts'

test('connection setup extracts Data API and OData targets while preserving the database name', () => {
  assert.deepEqual(
    readEndpoint(
      'https://fm.example.test:8443/fmi/data/v2/databases/Studio%20CRM/layouts/Customers/records',
    ),
    {
      host: 'https://fm.example.test:8443',
      database: 'Studio CRM',
      protocol: 'Data API',
      apiVersion: 'v2',
    },
  )
  assert.deepEqual(
    readEndpoint(
      'https://fm.example.test/fmi/odata/v4/Studio_CRM.fmp12/$metadata',
    ),
    {
      host: 'https://fm.example.test',
      database: 'Studio_CRM.fmp12',
      protocol: 'OData',
    },
  )
  assert.deepEqual(readEndpoint('https://fm.example.test/'), {
    host: 'https://fm.example.test',
  })
})

test('connection setup rejects credential-bearing, queried, malformed or unrelated URLs', () => {
  for (const url of [
    'http://fm.example.test',
    'https://user:secret@fm.example.test',
    'https://fm.example.test/?token=secret',
    'https://fm.example.test/#secret',
    'https://fm.example.test/admin',
    'https://fm.example.test/fmi/odata/v4/A%2FB',
    'https://fm.example.test/fmi/odata/v4/%XX',
  ])
    assert.throws(() => readEndpoint(url))
  assert.throws(() => validateDatabaseName('Bad/Name'))
})

test('setup request contains no unvalidated host credentials and never claims a tested connection', () => {
  const request = connectionRequest(
    'Data API',
    'https://person:DO_NOT_COPY@fm.example.test',
    '',
  )
  assert.ok(!request.includes('DO_NOT_COPY'))
  assert.match(request, /HTTPS server address/)
  assert.match(request, /not connected or verified/)
  assert.match(
    connectionRequest(
      'Data API',
      'https://fm.example.test/fmi/odata/v4/Studio',
      '',
    ),
    /API: OData/,
  )
})
