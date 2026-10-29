import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allMarkdown } from '../src/lib/generators.ts'
import { entities } from '../src/lib/data.ts'

test('full-schema documentation preserves actual inspection time and partial-discovery warnings without record values', () => {
  const result = allMarkdown(
    'OData',
    entities,
    [],
    'CRM',
    'account-visible metadata',
    {
      inspectedAt: '2026-10-28T12:00:00.000Z',
      complete: false,
      warnings: ['Invoices metadata was not accessible.'],
    },
  )
  assert.ok(result.includes('Inspected: 2026-10-28T12:00:00.000Z'))
  assert.ok(result.includes('Coverage: Partial or unknown discovery'))
  assert.ok(result.includes('Invoices metadata was not accessible.'))
  assert.equal(result.includes('olivia.chen@example.com'), false)
  assert.equal(result.includes('See resource provenance'), false)
})

test('documentation never invents completed discovery or inspection time when provenance is absent', () => {
  const result = allMarkdown('Data API', [], [], 'CRM')
  assert.ok(result.includes('Inspected: Not recorded'))
  assert.ok(result.includes('Coverage: Partial or unknown discovery'))
  assert.equal(result.includes('Completed within account-visible scope'), false)
})
