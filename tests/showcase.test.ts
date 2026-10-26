import test from 'node:test'
import assert from 'node:assert/strict'
import { previewRequest } from '../src/lib/showcase.ts'
import {
  labProfiles,
  type RecordPage,
  type SessionInfo,
  type Snapshot,
} from '../src/lib/contracts.ts'

test('website preview discovers synthetic schema, filters and pages without network access', async () => {
  const { session, snapshot } = await previewRequest<{
    session: SessionInfo
    snapshot: Snapshot
  }>('/connect', 'POST', { profile: labProfiles[1], auth: { mode: 'lab' } })
  assert.equal(snapshot.entities.length, 6)
  assert.ok(snapshot.entities.every((e) => !e.rows.length))
  const query = {
    entity: 'Customers',
    conditions: [
      { id: 'status', field: 'Status', operator: 'equals', value: 'Active' },
    ],
    match: 'all',
    offset: 0,
    limit: 3,
    sort: { field: 'FullName', direction: 'asc' },
  }
  const first = await previewRequest<RecordPage>(
    `/sessions/${session.id}/records`,
    'POST',
    query,
  )
  const next = await previewRequest<RecordPage>(
    `/sessions/${session.id}/records`,
    'POST',
    { ...query, offset: 3 },
  )
  assert.equal(first.rows.length, 3)
  assert.ok(first.rows.every((r) => r.Status === 'Active'))
  assert.ok(first.hasNext)
  assert.notEqual(first.rows[0].CustomerID, next.rows[0].CustomerID)
  assert.match(first.warnings.join(' '), /not sent to FileMaker/)
})

test('website preview rejects real authentication, external profiles and unbounded reads', async () => {
  await assert.rejects(
    previewRequest('/connect', 'POST', {
      profile: labProfiles[0],
      auth: { mode: 'password' },
    }),
    /credentials/,
  )
  await assert.rejects(
    previewRequest('/connect', 'POST', {
      profile: { ...labProfiles[0], id: 'real-server' },
      auth: { mode: 'lab' },
    }),
    /only supports/,
  )
  await assert.rejects(
    previewRequest('/sessions/preview-lab-data/records', 'POST', {
      entity: 'Customers',
      limit: 1000,
      offset: 0,
    }),
    /bounded/,
  )
})
