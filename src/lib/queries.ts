import type { Entity, Field, Profile } from './data'
import type { Condition, Query, RequestSpec } from './contracts'

export function escapeFind(value: string) {
  return value.replace(/[\\@*#?!=<>~"/]/g, '\\$&')
}
export function odataIdentifier(value: string) {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(value)
    ? value
    : `"${value.replaceAll('"', '""')}"`
}
function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number),
    leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1]
}
function validTimestamp(value: string) {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2}))?$/.exec(
      value,
    )
  return (
    !!match &&
    validDate(match[1]) &&
    Number(match[2]) <= 23 &&
    Number(match[3]) <= 59 &&
    Number(match[4] ?? 0) <= 59 &&
    Number(match[5] ?? 0) <= 23 &&
    Number(match[6] ?? 0) <= 59
  )
}
function literal(field: Field, value: string) {
  if (field.nativeType === 'Edm.Guid') {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))
      throw new Error('Use a valid GUID.')
    return value
  }
  if (field.type === 'number') {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))
      throw new Error('Enter a valid number.')
    return value
  }
  if (field.type === 'boolean') {
    if (!['true', 'false'].includes(value))
      throw new Error('Boolean values must be true or false.')
    return value
  }
  if (field.type === 'date') {
    if (!validDate(value))
      throw new Error('Use a valid calendar date (YYYY-MM-DD).')
    return value
  }
  if (field.type === 'timestamp') {
    if (!validTimestamp(value))
      throw new Error(
        'Use a complete ISO timestamp without extra text, for example 2026-10-28T14:30:00Z.',
      )
    return value
  }
  return `'${value.replaceAll("'", "''")}'`
}
export function validateConditions(entity: Entity, conditions: Condition[]) {
  const used = new Set<string>()
  for (const c of conditions) {
    const f = entity.fields.find((f) => f.name === c.field)
    if (!f || f.global)
      throw new Error('Choose a nonglobal field from this resource.')
    if (used.has(c.field)) throw new Error('Use each field once per group.')
    used.add(c.field)
    if (c.operator === 'contains' && f.type !== 'text')
      throw new Error('Contains requires a text field.')
    if (['greater', 'less'].includes(c.operator) && f.type !== 'number')
      throw new Error('Numeric comparisons require a number field.')
    if (['container', 'json', 'unknown'].includes(f.type))
      throw new Error('This field type is not supported in filters.')
    literal(f, c.value)
  }
}
export function compileRequest(
  profile: Profile,
  entity: Entity,
  query: Query,
): RequestSpec {
  const active = query.conditions.filter((c) => c.value !== '')
  validateConditions(entity, active)
  if (query.sort && !entity.fields.some((f) => f.name === query.sort!.field))
    throw new Error('Unknown sort field.')
  const db = encodeURIComponent(profile.database),
    resource = encodeURIComponent(entity.name)
  if (profile.protocol === 'Data API') {
    const base = `/fmi/data/${profile.apiVersion ?? 'vLatest'}/databases/${db}/layouts/${resource}`
    const sort = query.sort
      ? [
          {
            fieldName: query.sort.field,
            sortOrder: query.sort.direction === 'asc' ? 'ascend' : 'descend',
          },
        ]
      : undefined
    if (active.length) {
      const groups = active.map((c) => ({
        [c.field]: `${c.operator === 'equals' ? '==' : c.operator === 'greater' ? '>' : c.operator === 'less' ? '<' : '*'}${escapeFind(c.value)}${c.operator === 'contains' ? '*' : ''}`,
      }))
      return {
        method: 'POST',
        path: `${base}/_find`,
        body: {
          query:
            query.match === 'all'
              ? [
                  Object.fromEntries(
                    groups.flatMap((group) => Object.entries(group)),
                  ),
                ]
              : groups,
          offset: String(query.offset + 1),
          limit: String(query.limit),
          dateformats: 2,
          ...(sort ? { sort } : {}),
        },
      }
    }
    const params = new URLSearchParams({
      _offset: String(query.offset + 1),
      _limit: String(query.limit),
      dateformats: '2',
    })
    if (sort) params.set('_sort', JSON.stringify(sort))
    return { method: 'GET', path: `${base}/records?${params}` }
  }
  const params = new URLSearchParams({
    $top: String(query.limit),
    $skip: String(query.offset),
    $count: 'true',
  })
  if (active.length)
    params.set(
      '$filter',
      active
        .map((c) => {
          const f = entity.fields.find((f) => f.name === c.field)!,
            name = odataIdentifier(c.field),
            value = literal(f, c.value)
          return c.operator === 'contains'
            ? `contains(${name},${value})`
            : `${name} ${c.operator === 'greater' ? 'gt' : c.operator === 'less' ? 'lt' : 'eq'} ${value}`
        })
        .join(query.match === 'all' ? ' and ' : ' or '),
    )
  if (query.sort)
    params.set(
      '$orderby',
      `${odataIdentifier(query.sort.field)} ${query.sort.direction}`,
    )
  return { method: 'GET', path: `/fmi/odata/v4/${db}/${resource}?${params}` }
}
