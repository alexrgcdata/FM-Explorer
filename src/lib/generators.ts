import {
  entities as fixtures,
  relationships as fixtureRelationships,
  type Entity,
  type Field,
  type Profile,
  type Protocol,
} from './data'
import type { Snapshot } from './contracts'
import { compileRequest } from './queries'
export type { Condition } from './contracts'
export type ExportKind =
  'typescript' | 'jsonschema' | 'openapi' | 'postman' | 'markdown' | 'mcp'
type Context = { profile: Profile; snapshot?: Snapshot; auth?: string }
function typeName(name: string) {
  const result = name.replace(/[^A-Za-z0-9_$]/g, '_')
  return /^[A-Za-z_$]/.test(result) ? result : `Resource_${result}`
}
const commentText = (value: string) =>
  value.replaceAll('*/', '* /').replace(/[\r\n\u2028\u2029]/g, ' ')
function tsType(f: Field) {
  const type =
    f.repetitions && f.repetitions > 1
      ? 'unknown[]'
      : f.type === 'number'
        ? 'number | string'
        : f.type === 'boolean'
          ? 'boolean'
          : f.type === 'json'
            ? 'unknown[]'
            : f.type === 'unknown'
              ? 'unknown'
              : 'string'
  return `${type}${f.nullable !== false ? ' | null' : ''}`
}
function propertySchema(f: Field) {
  let types: string[] =
    f.type === 'number'
      ? ['number', 'string']
      : f.type === 'boolean'
        ? ['boolean']
        : f.type === 'json'
          ? ['array']
          : f.type === 'unknown'
            ? []
            : ['string']
  if (f.repetitions && f.repetitions > 1) types = ['array']
  if (f.nullable !== false && types.length) types.push('null')
  return {
    ...(types.length ? { type: types } : {}),
    description: f.description,
    ...(f.nativeType ? { 'x-native-type': f.nativeType } : {}),
  }
}
function schema(entity: Entity) {
  return {
    title: entity.name,
    type: 'object',
    properties: Object.fromEntries(
      entity.fields.map((f) => [f.name, propertySchema(f)]),
    ),
    required: entity.fields
      .filter((f) => f.required || f.key)
      .map((f) => f.name),
    additionalProperties: true,
  }
}
export function generate(
  entity: Entity,
  kind: ExportKind,
  protocol: Protocol,
  context?: Context,
): string {
  const database = context?.profile.database ?? 'Northstar_CRM',
    source = context?.snapshot?.source ?? entity.source ?? 'Bundled fixture',
    profile = context?.profile ?? {
      id: 'export',
      name: database,
      host: 'https://your-filemaker-host',
      database,
      protocol,
    },
    stamp = context?.snapshot?.inspectedAt ?? 'not recorded'
  const path =
    entity.endpoint ??
    compileRequest(profile, entity, {
      entity: entity.name,
      conditions: [],
      match: 'all',
      offset: 0,
      limit: 20,
    }).path.split('?')[0]
  if (kind === 'typescript')
    return `// ${commentText(entity.name)} — ${protocol}\n// Source: ${commentText(source)}; inspected: ${commentText(stamp)}\n// Numeric strings preserve decimals and large integers. Unknown nullability is permissive.\n\nexport interface ${typeName(entity.name)} {\n${entity.fields.map((f) => `  /** ${commentText(f.description)} */\n  ${JSON.stringify(f.name)}${f.required || f.key ? '' : '?'}: ${tsType(f)};`).join('\n\n')}\n}\n`
  if (kind === 'jsonschema')
    return JSON.stringify(
      {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        ...schema(entity),
        'x-source': source,
        'x-inspected-at': stamp,
      },
      null,
      2,
    )
  if (kind === 'openapi')
    return JSON.stringify(
      {
        openapi: '3.1.0',
        info: {
          title: `${database} — ${entity.name}`,
          version: '0.2.0',
          description: `Read endpoint discovered through ${protocol}. Credentials are placeholders. ${source}`,
        },
        servers: [
          { url: profile.lab ? 'http://127.0.0.1:4186' : profile.host },
        ],
        components: {
          securitySchemes:
            protocol === 'Data API'
              ? { FileMakerSession: { type: 'http', scheme: 'bearer' } }
              : {
                  FileMakerAccount: { type: 'http', scheme: 'basic' },
                  FileMakerCloud: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'Authorization',
                    description: 'FMID <Claris_ID_Token>',
                  },
                },
          schemas: { Record: schema(entity) },
        },
        paths: {
          [path]: {
            get: {
              summary: `Read ${entity.name}`,
              security:
                protocol === 'Data API'
                  ? [{ FileMakerSession: [] }]
                  : [{ FileMakerAccount: [] }, { FileMakerCloud: [] }],
              parameters: [
                {
                  name: protocol === 'Data API' ? '_limit' : '$top',
                  in: 'query',
                  schema: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 100,
                    default: 20,
                  },
                },
              ],
              responses: {
                '200': {
                  description:
                    'Native protocol envelope; record fields described by components.schemas.Record.',
                  content: {
                    'application/json': {
                      schema: { type: 'object', additionalProperties: true },
                    },
                  },
                },
                '401': { description: 'Authentication required' },
                '403': { description: 'Insufficient privileges' },
              },
            },
          },
        },
      },
      null,
      2,
    )
  if (kind === 'postman')
    return JSON.stringify(
      {
        info: {
          name: `${database} · ${entity.name}`,
          schema:
            'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
          {
            key: 'host',
            value: profile.lab ? 'http://127.0.0.1:4186' : profile.host,
          },
          { key: 'sessionToken', value: '' },
          { key: 'username', value: '' },
          { key: 'password', value: '' },
          { key: 'fmidToken', value: '' },
        ],
        item: [
          {
            name: `Read ${entity.name}`,
            request: {
              method: 'GET',
              header: [
                { key: 'Accept', value: 'application/json' },
                ...(context?.auth === 'FMID token'
                  ? [{ key: 'Authorization', value: 'FMID {{fmidToken}}' }]
                  : []),
              ],
              auth:
                protocol === 'Data API'
                  ? {
                      type: 'bearer',
                      bearer: [
                        {
                          key: 'token',
                          value: '{{sessionToken}}',
                          type: 'string',
                        },
                      ],
                    }
                  : context?.auth === 'FMID token'
                    ? { type: 'noauth' }
                    : {
                        type: 'basic',
                        basic: [
                          {
                            key: 'username',
                            value: '{{username}}',
                            type: 'string',
                          },
                          {
                            key: 'password',
                            value: '{{password}}',
                            type: 'string',
                          },
                        ],
                      },
              url: `{{host}}${path}?${protocol === 'Data API' ? '_limit' : '$top'}=20`,
            },
          },
        ],
      },
      null,
      2,
    )
  if (kind === 'mcp')
    return JSON.stringify(
      {
        name: `list_${entity.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`.slice(
          0,
          64,
        ),
        description: `Read ${entity.name} from ${database}. Definition template only; provide an authorized server-side handler.`,
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      null,
      2,
    )
  const rels = context?.snapshot?.relationships ?? fixtureRelationships
  return `# ${entity.name}\n\n${entity.description}\n\nProtocol: ${protocol}\nDatabase: ${database}\nSource: ${source}\nInspected: ${stamp}\nEndpoint: \`${path}\`\n\n## Fields\n\n| Field | Native type | Nullable | Key |\n| --- | --- | --- | --- |\n${entity.fields.map((f) => `| ${f.name.replaceAll('|', '\\|')} | ${f.nativeType ?? f.type} | ${f.nullable === undefined ? 'Unknown' : String(f.nullable)} | ${f.key ? 'Declared key' : '—'} |`).join('\n')}\n\n## Relationships\n\n${
    rels
      .filter((r) => r.source === entity.name || r.target === entity.name)
      .map(
        (r) =>
          `- ${r.source} → ${r.target} via ${r.field || 'unspecified join'}${'evidence' in r ? `: ${r.evidence}` : ''}`,
      )
      .join('\n') ||
    'No relationships exposed or declared. This does not establish that none exist.'
  }\n\n## Boundaries\n\nRead operations only. Keep credentials server-side. Layout metadata does not describe the whole FileMaker solution. Numeric payloads may be strings to preserve precision. No record values or credentials are included in this document.\n`
}
export function allMarkdown(
  protocol: Protocol,
  entities: Entity[] = fixtures,
  relationships:
    | Snapshot['relationships']
    | typeof fixtureRelationships = fixtureRelationships,
  database = 'Northstar_CRM',
  source = 'Inspected workspace schema',
) {
  const profile: Profile = {
    id: 'export',
    name: database,
    database,
    host: 'https://your-filemaker-host',
    protocol,
  }
  const snapshot: Snapshot = {
    id: 'export',
    profileId: 'export',
    database,
    protocol,
    source,
    inspectedAt: 'See resource provenance',
    entities,
    relationships: relationships.map((r) => ({
      ...r,
      evidence: 'evidence' in r ? String(r.evidence) : 'Declared fixture',
    })),
    warnings: [],
    complete: true,
  }
  return `# ${database} — schema context\n\n${entities.map((e) => generate(e, 'markdown', protocol, { profile, snapshot })).join('\n---\n\n')}`
}
export function downloadFile(
  name: string,
  content: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function compileQuery(
  entity: Entity,
  protocol: Protocol,
  conditions: import('./contracts').Condition[],
  match: 'all' | 'any',
  limit: number,
  profile?: Profile,
) {
  const request = compileRequest(
    profile ?? {
      id: 'preview',
      name: 'Preview',
      host: 'https://your-filemaker-host',
      database: 'Northstar_CRM',
      protocol,
    },
    entity,
    { entity: entity.name, conditions, match, limit, offset: 0 },
  )
  return `${request.method} ${request.path}${request.body ? `\n\n${JSON.stringify(request.body, null, 2)}` : ''}`
}
