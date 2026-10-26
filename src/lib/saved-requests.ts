import { z } from 'zod'
import type { Field, Profile } from './data'
import type { RecordPage } from './contracts'

export const fieldExpectationSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.enum([
    'any',
    'string',
    'number',
    'numeric',
    'boolean',
    'array',
    'object',
  ]),
  allowNull: z.boolean(),
})
export const savedRequestSchema = z
  .object({
    id: z.string().min(1).max(100),
    profileId: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1500),
    protocol: z.enum(['Data API', 'OData']),
    query: z.object({
      entity: z.string().min(1).max(500),
      conditions: z
        .array(
          z.object({
            id: z.string().max(100),
            field: z.string().min(1).max(500),
            operator: z.enum(['equals', 'contains', 'greater', 'less']),
            value: z.string().max(2000),
          }),
        )
        .max(30),
      match: z.enum(['all', 'any']),
      offset: z.literal(0),
      limit: z.number().int().min(1).max(100),
      sort: z
        .object({
          field: z.string().min(1).max(500),
          direction: z.enum(['asc', 'desc']),
        })
        .optional(),
    }),
    expectations: z
      .object({
        minRows: z.number().int().min(0).max(100),
        maxDurationMs: z.number().int().min(1).max(120000).optional(),
        fields: z.array(fieldExpectationSchema).max(2000),
      })
      .refine(
        (value) =>
          new Set(value.fields.map((f) => f.name)).size === value.fields.length,
        'Choose each expected field once.',
      ),
    revision: z.number().int().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .refine(
    (value) => value.expectations.minRows <= value.query.limit,
    'Minimum returned rows cannot exceed the requested page size.',
  )
export type SavedRequest = z.infer<typeof savedRequestSchema>
export type FieldExpectation = z.infer<typeof fieldExpectationSchema>
export type CheckStatus = 'pass' | 'fail' | 'inconclusive' | 'error'
export type CheckDetail = {
  id: string
  status: 'pass' | 'fail' | 'not-evaluated'
  message: string
}
export type CheckRun = {
  id: string
  requestId: string
  profileId: string
  requestName: string
  requestRevision: number
  entity: string
  at: string
  status: CheckStatus
  returnedRows: number | null
  matchingRows: number | null
  durationMs: number | null
  details: CheckDetail[]
  error?: string
}

export function suggestedExpectation(field: Field): FieldExpectation {
  return {
    name: field.name,
    type:
      field.type === 'number'
        ? 'numeric'
        : field.type === 'boolean'
          ? 'boolean'
          : field.type === 'json'
            ? 'array'
            : field.type === 'unknown'
              ? 'any'
              : 'string',
    allowNull: field.nullable !== false,
  }
}
function matchesType(value: unknown, type: FieldExpectation['type']) {
  if (type === 'any') return true
  if (type === 'array') return Array.isArray(value)
  if (type === 'object')
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  if (type === 'number')
    return typeof value === 'number' && Number.isFinite(value)
  if (type === 'numeric')
    return typeof value === 'number'
      ? Number.isFinite(value)
      : typeof value === 'string' &&
          /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)
  return typeof value === type
}
export function evaluateCheck(
  definition: SavedRequest,
  response: RecordPage,
): Omit<CheckRun, 'id' | 'at'> {
  const details: CheckDetail[] = [
    {
      id: 'rows',
      status:
        response.rows.length >= definition.expectations.minRows
          ? 'pass'
          : 'fail',
      message: `Returned ${response.rows.length} rows; expected at least ${definition.expectations.minRows}.`,
    },
  ]
  if (definition.expectations.maxDurationMs !== undefined)
    details.push({
      id: 'duration',
      status:
        response.elapsedMs <= definition.expectations.maxDurationMs
          ? 'pass'
          : 'fail',
      message: `Upstream response took ${response.elapsedMs} ms; limit ${definition.expectations.maxDurationMs} ms.`,
    })
  for (const field of definition.expectations.fields) {
    if (!response.rows.length) {
      details.push({
        id: `field:${field.name}`,
        status: 'not-evaluated',
        message: `${field.name}: no returned rows to check.`,
      })
      continue
    }
    let missing = 0,
      nulls = 0,
      wrongType = 0
    for (const row of response.rows) {
      if (!Object.hasOwn(row, field.name) || row[field.name] === undefined)
        missing++
      else if (row[field.name] === null) {
        if (!field.allowNull) nulls++
      } else if (!matchesType(row[field.name], field.type)) wrongType++
    }
    const failed = missing + nulls + wrongType > 0
    details.push({
      id: `field:${field.name}`,
      status: failed ? 'fail' : 'pass',
      message: failed
        ? `${field.name}: ${missing} missing, ${nulls} disallowed nulls, ${wrongType} type mismatches in ${response.rows.length} returned rows.`
        : `${field.name}: present and matches ${field.type}${field.allowNull ? ' or null' : ''} in all ${response.rows.length} returned rows.`,
    })
  }
  return {
    requestId: definition.id,
    profileId: definition.profileId,
    requestName: definition.name,
    requestRevision: definition.revision,
    entity: definition.query.entity,
    status: details.some((d) => d.status === 'fail')
      ? 'fail'
      : details.some((d) => d.status === 'not-evaluated')
        ? 'inconclusive'
        : 'pass',
    returnedRows: response.rows.length,
    matchingRows: response.found,
    durationMs: response.elapsedMs,
    details,
  }
}
export function requestExport(
  profile: Profile,
  requests: SavedRequest[],
  runs: CheckRun[],
  includeValues = false,
) {
  return JSON.stringify(
    {
      format: 'fm-api-explorer.requests',
      version: 1,
      exportedAt: new Date().toISOString(),
      scope:
        'Bounded page checks; not database backups or full-dataset validation.',
      connection: {
        name: profile.name,
        database: profile.database,
        protocol: profile.protocol,
      },
      filterValuesIncluded: includeValues,
      requests: requests.map((r) => ({
        ...r,
        requiresFilterValues:
          !includeValues && r.query.conditions.some((c) => c.value.length > 0),
        query: {
          ...r.query,
          conditions: r.query.conditions.map((c) => ({
            ...c,
            value: includeValues ? c.value : '',
          })),
        },
      })),
      results: runs,
    },
    null,
    2,
  )
}
