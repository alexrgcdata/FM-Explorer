import { XMLParser } from 'fast-xml-parser'
import { parse as parseLossless } from 'lossless-json'
import type { Entity, Field, FieldType, Profile } from '../src/lib/data.ts'
import type {
  Auth,
  Query,
  RecordPage,
  RequestSpec,
  Snapshot,
} from '../src/lib/contracts.ts'
import { compileRequest } from '../src/lib/queries.ts'
import { randomUUID } from 'node:crypto'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}
type ObjectValue = Record<string, unknown>
export function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(502, 'The server returned an unexpected response shape.')
  return value as ObjectValue
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value]
}
function number(value: unknown): number | null {
  const n =
    typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}
function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}
export type Transport = (
  spec: RequestSpec,
  authorization: string,
  xml?: boolean,
) => Promise<unknown>
export type Adapter = {
  profile: Profile
  authorization: string
  ownsToken: boolean
  transport: Transport
  snapshot?: Snapshot
  cursors: Map<string, string>
}

export async function readResponse(
  response: Response,
  xml = false,
  dataApi = false,
): Promise<unknown> {
  const MAX = 8 * 1024 * 1024
  if (Number(response.headers.get('content-length') ?? 0) > MAX) {
    await response.body?.cancel()
    throw new ApiError(
      502,
      'Response exceeds the 8 MB safety limit. Narrow the request.',
    )
  }
  const reader = response.body?.getReader()
  let size = 0
  const chunks: Uint8Array[] = []
  if (reader) {
    try {
      while (true) {
        const result = await reader.read()
        if (result.done) break
        size += result.value.length
        if (size > MAX) {
          await reader.cancel()
          throw new ApiError(
            502,
            'Response exceeds the 8 MB safety limit. Narrow the request.',
          )
        }
        chunks.push(result.value)
      }
    } finally {
      reader.releaseLock()
    }
  }
  const body = Buffer.concat(chunks).toString('utf8')
  if (dataApi && response.status >= 500 && !xml) {
    try {
      const value = parseLossless(body)
      const envelope = object(value)
      if (
        Array.isArray(envelope.messages) &&
        envelope.messages.length &&
        String(object(envelope.messages[0]).code) !== '0'
      )
        return value
    } catch {
      /* Fall through to the sanitized HTTP error. */
    }
  }
  if (!response.ok)
    throw new ApiError(
      response.status === 401 || response.status === 403
        ? response.status
        : 502,
      response.status === 401
        ? 'Authentication expired or was rejected. Reconnect with valid credentials.'
        : response.status === 403
          ? 'This account does not have permission for the requested resource.'
          : `The endpoint returned HTTP ${response.status}.`,
      `HTTP_${response.status}`,
    )
  if (xml) return body
  try {
    return parseLossless(body, undefined, (value) => {
      const n = Number(value)
      return Number.isSafeInteger(n) ? n : value
    })
  } catch {
    throw new ApiError(502, 'The endpoint did not return valid JSON.')
  }
}

export function makeTransport(
  base: string,
  fetcher: typeof fetch = fetch,
): Transport {
  const origin = new URL(base).origin
  return async (spec, authorization, xml = false) => {
    const url = new URL(spec.path, origin)
    if (url.origin !== origin || !url.pathname.startsWith('/fmi/'))
      throw new ApiError(400, 'Request destination is outside this connection.')
    let response: Response
    try {
      response = await fetcher(url, {
        method: spec.method,
        headers: {
          Authorization: authorization,
          Accept: xml ? 'application/xml' : 'application/json',
          ...(spec.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(spec.body ? { body: JSON.stringify(spec.body) } : {}),
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new ApiError(
        502,
        'Could not reach the endpoint. Check the host, API access, and certificate trust. Requests time out after 20 seconds.',
      )
    }
    return readResponse(response, xml, spec.path.startsWith('/fmi/data/'))
  }
}
function dataResponse(value: unknown): ObjectValue {
  const body = object(value),
    messages = array(body.messages)
  if (!messages.length)
    throw new ApiError(502, 'Missing FileMaker response messages.')
  const first = object(messages[0]),
    code = String(first.code)
  if (code !== '0')
    throw new ApiError(
      code === '952' ? 401 : code === '401' ? 404 : 502,
      code === '952'
        ? 'The FileMaker session expired. Reconnect.'
        : `FileMaker returned error ${code}.`,
      code,
    )
  return object(body.response ?? {})
}
export async function authenticate(
  profile: Profile,
  auth: Auth,
  transport: Transport,
): Promise<Adapter> {
  let authorization: string
  let ownsToken = false
  if (profile.protocol === 'Data API') {
    if (auth.mode === 'token') authorization = `Bearer ${auth.token}`
    else {
      if (auth.mode !== 'password' && auth.mode !== 'lab')
        throw new ApiError(
          400,
          'Data API supports account login or an existing session token.',
        )
      const basic = `Basic ${Buffer.from(`${auth.username ?? ''}:${auth.password ?? ''}`).toString('base64')}`
      const response = dataResponse(
        await transport(
          {
            method: 'POST',
            path: `/fmi/data/${profile.apiVersion ?? 'vLatest'}/databases/${encodeURIComponent(profile.database)}/sessions`,
            body: {},
          },
          basic,
        ),
      )
      if (!text(response.token))
        throw new ApiError(
          502,
          'The login response did not contain a session token.',
        )
      authorization = `Bearer ${response.token}`
      ownsToken = true
    }
  } else {
    if (auth.mode === 'fmid') authorization = `FMID ${auth.token}`
    else if (auth.mode === 'password' || auth.mode === 'lab')
      authorization = `Basic ${Buffer.from(`${auth.username ?? ''}:${auth.password ?? ''}`).toString('base64')}`
    else
      throw new ApiError(
        400,
        'Use a FileMaker Server account or a FileMaker Cloud FMID token for OData.',
      )
  }
  return { profile, authorization, ownsToken, transport, cursors: new Map() }
}
function normalizeType(native: string): FieldType {
  const type = native.toLowerCase().replace(/^edm\./, '')
  if (['text', 'string', 'guid'].includes(type)) return 'text'
  if (
    [
      'number',
      'int16',
      'int32',
      'int64',
      'decimal',
      'double',
      'single',
      'byte',
      'sbyte',
    ].includes(type)
  )
    return 'number'
  if (type === 'date') return 'date'
  if (['timestamp', 'datetimeoffset', 'datetime'].includes(type))
    return 'timestamp'
  if (['time', 'timeofday', 'duration'].includes(type)) return 'time'
  if (['boolean', 'bool'].includes(type)) return 'boolean'
  if (['container', 'binary', 'stream'].includes(type)) return 'container'
  if (type.startsWith('collection(')) return 'json'
  return 'unknown'
}
function layoutNames(items: unknown): string[] {
  return array(items).flatMap((item) => {
    const row = object(item)
    return row.isFolder
      ? layoutNames(row.folderLayoutNames)
      : text(row.name)
        ? [text(row.name)]
        : []
  })
}
export async function discover(adapter: Adapter): Promise<Snapshot> {
  const { profile, transport, authorization } = adapter
  const base =
    profile.protocol === 'Data API'
      ? `/fmi/data/${profile.apiVersion ?? 'vLatest'}/databases/${encodeURIComponent(profile.database)}`
      : `/fmi/odata/v4/${encodeURIComponent(profile.database)}`
  const warnings: string[] = [],
    entities: Entity[] = [],
    relationships: Snapshot['relationships'] = []
  let complete = true
  if (profile.protocol === 'Data API') {
    const root = dataResponse(
      await transport(
        { method: 'GET', path: `${base}/layouts` },
        authorization,
      ),
    )
    const all = [...new Set(layoutNames(root.layouts))]
    const names = all.slice(0, 250)
    if (all.length > names.length) {
      warnings.push(
        `Discovery limited to ${names.length} of ${all.length} layouts. Narrow access or import a bounded snapshot.`,
      )
      complete = false
    }
    const discoveryStart = Date.now()
    for (const [index, name] of names.entries()) {
      if (Date.now() - discoveryStart > 40000) {
        complete = false
        warnings.push(
          'Discovery time budget reached. Remaining layouts are listed with metadata unavailable. Refresh to retry.',
        )
        for (const pending of names.slice(index))
          entities.push({
            name: pending,
            description: 'Metadata not inspected within the discovery budget.',
            fields: [],
            rows: [],
            count: null,
            kind: 'layout',
            warning: 'Metadata not inspected.',
          })
        break
      }
      try {
        const raw = dataResponse(
          await transport(
            {
              method: 'GET',
              path: `${base}/layouts/${encodeURIComponent(name)}`,
            },
            authorization,
          ),
        )
        const fields = array(raw.fieldMetaData)
          .map((value) => {
            const f = object(value),
              native = text(f.result) || text(f.type)
            return {
              name: text(f.name),
              type: normalizeType(native),
              nativeType: native,
              description: `${native || 'Unknown'} field exposed by layout ${name}.`,
              ...(typeof f.notEmpty === 'boolean'
                ? { required: f.notEmpty }
                : {}),
              ...(typeof f.autoEnter === 'boolean'
                ? { auto: f.autoEnter }
                : {}),
              ...(typeof f.global === 'boolean' ? { global: f.global } : {}),
              repetitions: number(f.maxRepeat) ?? 1,
            } satisfies Field
          })
          .filter((f) => f.name)
        entities.push({
          name,
          description: `Fields exposed by the ${name} layout.`,
          kind: 'layout',
          fields,
          rows: [],
          count: null,
          endpoint: `${base}/layouts/${encodeURIComponent(name)}/records`,
          source: 'FileMaker Data API metadata',
          raw,
        })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) throw error
        complete = false
        warnings.push(`Could not inspect layout ${name}.`)
        entities.push({
          name,
          description: 'Metadata unavailable for this layout.',
          fields: [],
          rows: [],
          count: null,
          kind: 'layout',
          warning: 'Metadata request failed.',
        })
      }
    }
    warnings.push(
      'The Data API exposes layout fields and portals, not a complete table or relationship graph. Counts are loaded when browsing records.',
    )
  } else {
    const raw = await transport(
      { method: 'GET', path: `${base}/$metadata` },
      authorization,
      true,
    )
    if (typeof raw !== 'string' || /<!DOCTYPE|<!ENTITY/i.test(raw))
      throw new ApiError(502, 'Unsupported XML declarations in OData metadata.')
    let parsed: ObjectValue
    try {
      parsed = object(
        new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '',
          removeNSPrefix: true,
          parseAttributeValue: false,
          parseTagValue: false,
          processEntities: false,
        }).parse(raw),
      )
    } catch {
      throw new ApiError(502, 'Invalid OData metadata XML.')
    }
    const schemas = array(object(object(parsed.Edmx).DataServices).Schema).map(
      object,
    )
    const types = new Map<string, ObjectValue>(),
      sets = new Map<string, string>()
    for (const schema of schemas) {
      for (const type of array(schema.EntityType).map(object)) {
        types.set(`${schema.Namespace}.${type.Name}`, type)
        if (schema.Alias) types.set(`${schema.Alias}.${type.Name}`, type)
      }
      for (const container of array(schema.EntityContainer).map(object))
        for (const set of array(container.EntitySet).map(object))
          sets.set(text(set.Name), text(set.EntityType))
    }
    if (sets.size > 250) {
      complete = false
      warnings.push(
        `Only the first 250 of ${sets.size} entity sets were inspected.`,
      )
    }
    for (const [name, typeName] of [...sets].slice(0, 250)) {
      const type = types.get(typeName)
      if (!type) {
        warnings.push(`No entity type was supplied for ${name}.`)
        complete = false
        continue
      }
      const keys = new Set(
        array(type.Key ? object(type.Key).PropertyRef : undefined).map((v) =>
          text(object(v).Name),
        ),
      )
      const fields: Field[] = array(type.Property)
        .map((value) => {
          const p = object(value),
            native = text(p.Type)
          return {
            name: text(p.Name),
            type: normalizeType(native),
            nativeType: native,
            description: `${native} property of ${name}.`,
            ...(p.Nullable !== undefined
              ? {
                  nullable: p.Nullable !== 'false',
                  required: p.Nullable === 'false',
                }
              : {}),
            key: keys.has(text(p.Name)),
          }
        })
        .filter((f) => f.name)
      entities.push({
        name,
        description: `OData entity set ${name}.`,
        kind: 'entity-set',
        fields,
        rows: [],
        count: null,
        endpoint: `${base}/${encodeURIComponent(name)}`,
        source: 'OData $metadata',
        raw: type,
      })
      for (const navigation of array(type.NavigationProperty).map(object)) {
        const navName = text(navigation.Name),
          targetType = text(navigation.Type).replace(
            /^Collection\((.*)\)$/,
            '$1',
          )
        const bindings = schemas
          .flatMap((s) => array(s.EntityContainer).map(object))
          .flatMap((c) => array(c.EntitySet).map(object))
          .filter((s) => s.Name === name)
          .flatMap((s) => array(s.NavigationPropertyBinding).map(object))
        const bound = bindings.find((b) => b.Path === navName),
          candidates = [...sets]
            .filter(([, t]) => t === targetType)
            .map(([n]) => n)
        const target = bound
          ? text(bound.Target).split('/').at(-1)!
          : candidates.length === 1
            ? candidates[0]
            : undefined
        if (target && sets.has(target))
          relationships.push({
            source: name,
            target,
            field: navName,
            label: text(navigation.Type).startsWith('Collection(')
              ? 'to many'
              : 'to one',
            evidence:
              'OData NavigationProperty from $metadata; direction denotes navigation, not inferred ownership.',
          })
        else
          warnings.push(
            `Navigation ${name}.${navName} has no unambiguous entity-set target.`,
          )
      }
      if (type.BaseType) {
        complete = false
        warnings.push(
          `${name} inherits ${text(type.BaseType)}; inherited properties require additional inspection.`,
        )
      }
    }
    warnings.push(
      'Only metadata exposed to this account is shown. Navigation direction does not establish business parent/child ownership.',
    )
  }
  const snapshot: Snapshot = {
    id: randomUUID(),
    profileId: profile.id,
    database: profile.database,
    protocol: profile.protocol,
    source: profile.lab ? 'Local practice server' : profile.host,
    inspectedAt: new Date().toISOString(),
    entities,
    relationships: relationships.filter(
      (r) =>
        entities.some((e) => e.name === r.source) &&
        entities.some((e) => e.name === r.target),
    ),
    warnings,
    complete,
  }
  adapter.snapshot = snapshot
  return snapshot
}

export async function records(
  adapter: Adapter,
  query: Query,
): Promise<RecordPage> {
  const entity = adapter.snapshot?.entities.find((e) => e.name === query.entity)
  if (!entity)
    throw new ApiError(400, 'Inspect this resource before requesting records.')
  let spec: RequestSpec
  try {
    spec = compileRequest(adapter.profile, entity, query)
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? error.message : 'Invalid filter.',
    )
  }
  if (query.cursor) {
    const next = adapter.cursors.get(query.cursor)
    if (!next)
      throw new ApiError(
        400,
        'This page cursor expired. Start again from the first page.',
      )
    const expected = `/fmi/odata/v4/${encodeURIComponent(adapter.profile.database)}/${encodeURIComponent(entity.name)}`
    if (
      adapter.profile.protocol !== 'OData' ||
      new URL(next, 'http://127.0.0.1').pathname !== expected
    )
      throw new ApiError(
        400,
        'The page cursor belongs to a different resource.',
      )
    spec = { method: 'GET', path: next }
  }
  const started = performance.now(),
    warnings: string[] = []
  let raw: unknown
  try {
    raw = await adapter.transport(spec, adapter.authorization)
  } catch (error) {
    if (
      adapter.profile.protocol === 'OData' &&
      !query.cursor &&
      error instanceof ApiError &&
      error.code === 'HTTP_400'
    ) {
      const retry = new URL(spec.path, 'http://127.0.0.1')
      if (!retry.searchParams.has('$count')) throw error
      retry.searchParams.delete('$count')
      spec = { method: 'GET', path: retry.pathname + retry.search }
      raw = await adapter.transport(spec, adapter.authorization)
      warnings.push(
        'The endpoint rejected a count request. Records were returned without a requested count.',
      )
    } else throw error
  }
  let page: RecordPage
  if (adapter.profile.protocol === 'Data API') {
    let response: ObjectValue
    try {
      response = dataResponse(raw)
    } catch (error) {
      if (error instanceof ApiError && error.code === '401')
        return {
          rows: [],
          recordMeta: [],
          total: entity.count ?? null,
          found: 0,
          hasNext: false,
          request: spec,
          elapsedMs: Math.round(performance.now() - started),
          warnings,
        }
      throw error
    }
    const items = array(response.data).map(object),
      info = object(response.dataInfo ?? {})
    const rows = items.map((i) => object(i.fieldData)),
      total = number(info.totalRecordCount),
      found = number(info.foundCount)
    const recordMeta = items.map((i) => ({
      recordId: String(i.recordId ?? ''),
      modId: typeof i.modId === 'string' ? i.modId : undefined,
      ...(i.portalData ? { portalData: i.portalData } : {}),
    }))
    page = {
      rows,
      recordMeta,
      total,
      found,
      hasNext:
        found !== null
          ? query.offset + rows.length < found
          : rows.length === query.limit,
      request: spec,
      elapsedMs: Math.round(performance.now() - started),
      warnings,
    }
  } else {
    const response = object(raw)
    if (!Array.isArray(response.value))
      throw new ApiError(502, 'Expected an OData collection response.')
    const rows = response.value.map(object),
      count = number(response['@odata.count']),
      link = text(response['@odata.nextLink'])
    let nextCursor: string | undefined
    if (link) {
      const origin = adapter.profile.lab
          ? 'http://127.0.0.1'
          : new URL(adapter.profile.host).origin,
        current = new URL(spec.path, origin),
        next = new URL(link, current)
      const expected = `/fmi/odata/v4/${encodeURIComponent(adapter.profile.database)}/${encodeURIComponent(entity.name)}`
      if (
        next.origin !== origin ||
        next.pathname !== expected ||
        next.username ||
        next.password ||
        next.hash
      )
        throw new ApiError(
          502,
          'The server returned a continuation link outside this resource.',
        )
      nextCursor = randomUUID()
      if (adapter.cursors.size > 500) adapter.cursors.clear()
      adapter.cursors.set(nextCursor, next.pathname + next.search)
    }
    const filtered = query.conditions.some((c) => c.value !== '')
    page = {
      rows,
      total: filtered ? (entity.count ?? null) : count,
      found: count,
      hasNext:
        !!nextCursor ||
        (count !== null
          ? query.offset + rows.length < count
          : rows.length === query.limit),
      nextCursor,
      request: spec,
      elapsedMs: Math.round(performance.now() - started),
      warnings,
    }
  }
  if (!query.conditions.some((c) => c.value !== '')) entity.count = page.total
  return page
}
export async function logout(adapter: Adapter) {
  if (adapter.profile.protocol !== 'Data API' || !adapter.ownsToken) return
  const token = adapter.authorization.slice(7)
  const path = `/fmi/data/${adapter.profile.apiVersion ?? 'vLatest'}/databases/${encodeURIComponent(adapter.profile.database)}/sessions/${encodeURIComponent(token)}`
  // DELETE is scoped to the session this process created; never to records.
  await adapter.transport({ method: 'DELETE', path }, adapter.authorization)
}
