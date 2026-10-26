import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { entities, relationships, type DataRow } from '../src/lib/data.ts'

const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const types: Record<string, string> = {
  text: 'Edm.String',
  number: 'Edm.Decimal',
  boolean: 'Edm.Boolean',
  date: 'Edm.Date',
  timestamp: 'Edm.DateTimeOffset',
}
export function labMetadata() {
  return `<?xml version="1.0" encoding="UTF-8"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="Lab" xmlns="http://docs.oasis-open.org/odata/ns/edm">${entities
    .map(
      (e) =>
        `<EntityType Name="${e.name}"><Key><PropertyRef Name="${e.fields[0].name}" /></Key>${e.fields.map((f) => `<Property Name="${xmlEscape(f.name)}" Type="${types[f.type] ?? 'Edm.String'}" Nullable="${f.required ? 'false' : 'true'}" />`).join('')}${relationships
          .filter((r) => r.source === e.name)
          .map(
            (r) =>
              `<NavigationProperty Name="${r.target}" Type="Collection(Lab.${r.target})" />`,
          )
          .join('')}</EntityType>`,
    )
    .join('')}<EntityContainer Name="Container">${entities
    .map(
      (e) =>
        `<EntitySet Name="${e.name}" EntityType="Lab.${e.name}">${relationships
          .filter((r) => r.source === e.name)
          .map(
            (r) =>
              `<NavigationPropertyBinding Path="${r.target}" Target="${r.target}" />`,
          )
          .join('')}</EntitySet>`,
    )
    .join('')}</EntityContainer></Schema></edmx:DataServices></edmx:Edmx>`
}
function compare(row: DataRow, field: string, op: string, value: string) {
  const actual = row[field]
  return op === 'contains'
    ? String(actual ?? '')
        .toLowerCase()
        .includes(value.toLowerCase())
    : op === 'gt'
      ? Number(actual) > Number(value)
      : op === 'lt'
        ? Number(actual) < Number(value)
        : String(actual).toLowerCase() === value.toLowerCase()
}
function findMatch(row: DataRow, criteria: unknown) {
  if (!criteria || typeof criteria !== 'object') return false
  return Object.entries(criteria).every(([field, raw]) => {
    const str = String(raw)
    let op = 'eq',
      value = str
    if (str.startsWith('==')) value = str.slice(2)
    else if (str.startsWith('>')) {
      op = 'gt'
      value = str.slice(1)
    } else if (str.startsWith('<')) {
      op = 'lt'
      value = str.slice(1)
    } else if (str.startsWith('*') && str.endsWith('*')) {
      op = 'contains'
      value = str.slice(1, -1)
    }
    value = value.replace(/\\(.)/g, '$1')
    const native = Object.fromEntries(
      Object.entries(row).map(([key, entry]) => [
        key,
        typeof entry === 'boolean' ? Number(entry) : entry,
      ]),
    )
    return compare(native, field, op, value)
  })
}
function splitExpression(value: string) {
  const parts: string[] = []
  let start = 0,
    quoted = false
  let mode = 'all'
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "'") {
      if (quoted && value[i + 1] === "'") {
        i++
        continue
      }
      quoted = !quoted
    }
    if (!quoted) {
      const join = value.slice(i).match(/^ (and|or) /)
      if (join) {
        parts.push(value.slice(start, i))
        mode = join[1] === 'or' ? 'any' : 'all'
        i += join[0].length - 1
        start = i + 1
      }
    }
  }
  parts.push(value.slice(start))
  return { parts, mode }
}
function odataMatch(row: DataRow, expression: string) {
  if (!expression) return true
  const { parts, mode } = splitExpression(expression)
  const results = parts.map((part) => {
    const contains = part.match(/^contains\((.+),('(?:[^']|'')*')\)$/),
      cmp = part.match(/^(.+) (eq|gt|lt) (.+)$/)
    if (!contains && !cmp) throw new Error('Unsupported lab filter')
    const field = (contains ? contains[1] : cmp![1])
        .replace(/^"(.*)"$/, '$1')
        .replaceAll('""', '"'),
      op = contains ? 'contains' : cmp![2],
      raw = contains ? contains[2] : cmp![3]
    const value = raw.startsWith("'")
      ? raw.slice(1, -1).replaceAll("''", "'")
      : raw
    return compare(row, field, op, value)
  })
  return mode === 'all' ? results.every(Boolean) : results.some(Boolean)
}
function sorted(rows: DataRow[], field?: string, direction = 'asc') {
  return field
    ? [...rows].sort(
        (a, b) =>
          (typeof a[field] === 'number' && typeof b[field] === 'number'
            ? Number(a[field]) - Number(b[field])
            : String(a[field] ?? '').localeCompare(String(b[field] ?? ''))) *
          (direction === 'desc' ? -1 : 1),
      )
    : rows
}
export async function registerLab(app: FastifyInstance) {
  const tokens = new Set<string>()
  const envelope = (response: unknown, code = '0') => ({
    response,
    messages: [{ code, message: code === '0' ? 'OK' : 'No records match' }],
  })
  app.post('/fmi/data/:version/databases/:database/sessions', async () => {
    const token = randomUUID()
    tokens.add(token)
    return envelope({ token })
  })
  app.delete<{ Params: { token: string } }>(
    '/fmi/data/:version/databases/:database/sessions/:token',
    async (req) => {
      tokens.delete(req.params.token)
      return envelope({})
    },
  )
  app.get(
    '/fmi/data/:version/databases/:database/layouts',
    async (req, reply) => {
      if (!tokens.has(req.headers.authorization?.slice(7) ?? ''))
        return reply.code(401).send(envelope({}, '952'))
      return envelope({ layouts: entities.map((e) => ({ name: e.name })) })
    },
  )
  app.get<{ Params: { layout: string } }>(
    '/fmi/data/:version/databases/:database/layouts/:layout',
    async (req, reply) => {
      if (!tokens.has(req.headers.authorization?.slice(7) ?? ''))
        return reply.code(401).send(envelope({}, '952'))
      const e = entities.find((e) => e.name === req.params.layout)
      if (!e) return reply.code(404).send(envelope({}, '105'))
      return envelope({
        fieldMetaData: e.fields.map((f) => ({
          name: f.name,
          result: f.type === 'boolean' ? 'number' : f.type,
          type: 'normal',
          notEmpty: !!f.required,
          autoEnter: !!f.auto,
          global: false,
          maxRepeat: 1,
        })),
        portalMetaData: {},
        valueLists: [],
      })
    },
  )
  const dataRoute = async (
    req: {
      headers: { authorization?: string }
      params: { layout: string }
      query: Record<string, string>
      body?: unknown
    },
    reply: { code: (n: number) => { send: (v: unknown) => unknown } },
  ) => {
    if (!tokens.has(req.headers.authorization?.slice(7) ?? ''))
      return reply.code(401).send(envelope({}, '952'))
    const entity = entities.find((e) => e.name === req.params.layout)
    if (!entity) return reply.code(404).send(envelope({}, '105'))
    const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {},
      q = req.query
    const criteria = Array.isArray(body.query) ? body.query : []
    let rows = entity.rows.filter(
      (row) => !criteria.length || criteria.some((c) => findMatch(row, c)),
    )
    const sort = body.sort ?? (q._sort ? JSON.parse(q._sort) : undefined),
      firstSort = Array.isArray(sort) ? sort[0] : undefined
    if (firstSort && typeof firstSort === 'object')
      rows = sorted(
        rows,
        String(firstSort.fieldName),
        firstSort.sortOrder === 'descend' ? 'desc' : 'asc',
      )
    const offset = Math.max(0, Number(body.offset ?? q._offset ?? 1) - 1),
      limit = Math.min(100, Math.max(1, Number(body.limit ?? q._limit ?? 20))),
      found = rows.length
    if (!found) return envelope({}, '401')
    const data = rows.slice(offset, offset + limit).map((row) => ({
      fieldData: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === 'boolean' ? Number(value) : value,
        ]),
      ),
      recordId: String(entity.rows.indexOf(row) + 1),
      modId: '1',
      portalData: {},
    }))
    return envelope({
      data,
      dataInfo: {
        database: 'Northstar_CRM',
        layout: entity.name,
        totalRecordCount: entity.rows.length,
        foundCount: found,
        returnedCount: data.length,
      },
    })
  }
  app.get<{ Params: { layout: string }; Querystring: Record<string, string> }>(
    '/fmi/data/:version/databases/:database/layouts/:layout/records',
    dataRoute,
  )
  app.post<{ Params: { layout: string }; Querystring: Record<string, string> }>(
    '/fmi/data/:version/databases/:database/layouts/:layout/_find',
    dataRoute,
  )
  app.get('/fmi/odata/v4/:database/$metadata', async (_, reply) =>
    reply.type('application/xml').send(labMetadata()),
  )
  app.get('/fmi/odata/v4/:database', async () => ({
    value: entities.map((e) => ({
      name: e.name,
      kind: 'EntitySet',
      url: e.name,
    })),
  }))
  app.get<{
    Params: { database: string; entity: string }
    Querystring: Record<string, string>
  }>('/fmi/odata/v4/:database/:entity', async (req, reply) => {
    const e = entities.find((e) => e.name === req.params.entity)
    if (!e)
      return reply.code(404).send({ error: { message: 'Unknown entity' } })
    const q = req.query
    let rows: DataRow[]
    try {
      rows = e.rows.filter((row) => odataMatch(row, q.$filter ?? ''))
    } catch {
      return reply.code(400).send({ error: { message: 'Unsupported filter' } })
    }
    if (q.$orderby) {
      const sort = q.$orderby.match(/^(.*) (asc|desc)$/)
      if (sort) rows = sorted(rows, sort[1].replace(/^"(.*)"$/, '$1'), sort[2])
    }
    const skip = Number(q.$skip ?? 0),
      top = Math.max(1, Math.min(100, Number(q.$top ?? 20))),
      take = Math.min(top, 7)
    const value = rows.slice(skip, skip + take),
      next = new URLSearchParams(q)
    next.set('$skip', String(skip + value.length))
    return {
      '@odata.context': `$metadata#${e.name}`,
      '@odata.count': rows.length,
      value,
      ...(skip + value.length < rows.length
        ? {
            '@odata.nextLink': `/fmi/odata/v4/${encodeURIComponent(req.params.database)}/${e.name}?${next}`,
          }
        : {}),
    }
  })
}
