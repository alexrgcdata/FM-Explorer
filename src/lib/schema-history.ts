import type { Snapshot } from './contracts'
import type { Profile, Field } from './data'
import type { SavedRequest } from './saved-requests'

export type SchemaVersion = Snapshot & {
  target?: string
  apiVersion?: string
  accessScope: string
}
export type SchemaChange = {
  id: string
  kind: 'added' | 'missing' | 'changed' | 'unknown'
  entity: string
  field?: string
  property: string
  before: string
  after: string
  message: string
}
export type SchemaComparison = {
  comparable: boolean
  reason?: string
  changes: SchemaChange[]
  warnings: string[]
}

// Whitelist schema properties. Never copy sample rows, record counts or raw response bodies.
export function makeSchemaVersion(
  snapshot: Snapshot,
  profile?: Profile,
): SchemaVersion {
  return {
    id: snapshot.id,
    profileId: snapshot.profileId,
    database: snapshot.database,
    protocol: snapshot.protocol,
    source: snapshot.source,
    inspectedAt: snapshot.inspectedAt,
    complete: snapshot.complete,
    warnings: [...snapshot.warnings],
    target: profile?.host,
    apiVersion: profile?.apiVersion,
    accessScope:
      'Account-visible metadata. Account identity and privileges were not fingerprinted; visibility changes may reflect permissions.',
    entities: snapshot.entities.map((e) => ({
      name: e.name,
      description: e.description,
      endpoint: e.endpoint,
      source: e.source,
      warning: e.warning,
      kind: e.kind,
      rows: [],
      fields: e.fields.map((f) => ({
        name: f.name,
        type: f.type,
        description: f.description,
        nativeType: f.nativeType,
        nullable: f.nullable,
        required: f.required,
        key: f.key,
        unique: f.unique,
        indexed: f.indexed,
        reference: f.reference,
        auto: f.auto,
        global: f.global,
        repetitions: f.repetitions,
      })),
    })),
    relationships: snapshot.relationships.map((r) => ({
      source: r.source,
      target: r.target,
      field: r.field,
      label: r.label,
      evidence: r.evidence,
    })),
  }
}
const show = (value: unknown) =>
  value === undefined ? 'Unknown' : String(value)
const attributes: (keyof Field)[] = [
  'type',
  'nativeType',
  'nullable',
  'required',
  'key',
  'unique',
  'indexed',
  'reference',
  'auto',
  'global',
  'repetitions',
]
export function compareSchemaVersions(
  before: SchemaVersion,
  after: SchemaVersion,
): SchemaComparison {
  const warnings = [
    ...new Set([
      ...before.warnings,
      ...after.warnings,
      before.accessScope,
      after.accessScope,
    ]),
  ]
  const mismatch =
    before.profileId !== after.profileId ||
    before.database !== after.database ||
    before.protocol !== after.protocol ||
    before.source !== after.source ||
    (before.target && after.target && before.target !== after.target) ||
    before.apiVersion !== after.apiVersion
  if (mismatch)
    return {
      comparable: false,
      reason:
        'Choose versions from the same connection, database, protocol, target, API version and metadata source.',
      changes: [],
      warnings,
    }
  if (!before.target || !after.target)
    warnings.push(
      'An older version has no saved target host. Verify that both inspections came from the same endpoint.',
    )
  if (!before.complete || !after.complete)
    warnings.push(
      'At least one inspection is partial. Missing metadata is shown as unknown, not a confirmed removal.',
    )
  const changes: SchemaChange[] = []
  const add = (change: Omit<SchemaChange, 'id'>) =>
    changes.push({
      ...change,
      id: JSON.stringify([
        change.entity,
        change.field,
        change.property,
        change.kind,
      ]),
    })
  const oldEntities = new Map(before.entities.map((e) => [e.name, e])),
    newEntities = new Map(after.entities.map((e) => [e.name, e]))
  for (const name of new Set([...oldEntities.keys(), ...newEntities.keys()])) {
    const old = oldEntities.get(name),
      next = newEntities.get(name)
    if (!old || !next) {
      const added = !!next,
        uncertain = added ? !before.complete : !after.complete
      add({
        kind: uncertain ? 'unknown' : added ? 'added' : 'missing',
        entity: name,
        property: 'Resource',
        before: old ? 'Observed' : 'Not observed',
        after: next ? 'Observed' : 'Not observed',
        message: uncertain
          ? 'Resource visibility cannot be established across a partial inspection.'
          : added
            ? 'Newly exposed resource.'
            : 'Resource no longer exposed to this connection; deletion is not established.',
      })
      continue
    }
    const oldFields = new Map(old.fields.map((f) => [f.name, f])),
      newFields = new Map(next.fields.map((f) => [f.name, f]))
    for (const field of new Set([...oldFields.keys(), ...newFields.keys()])) {
      const a = oldFields.get(field),
        b = newFields.get(field)
      if (!a || !b) {
        const added = !!b,
          uncertain = added
            ? !before.complete || !!old.warning
            : !after.complete || !!next.warning
        add({
          kind: uncertain ? 'unknown' : added ? 'added' : 'missing',
          entity: name,
          field,
          property: 'Field',
          before: a ? 'Observed' : 'Not observed',
          after: b ? 'Observed' : 'Not observed',
          message: uncertain
            ? 'Field visibility is unknown because metadata is partial.'
            : added
              ? 'Newly exposed field.'
              : 'Field no longer exposed; check saved requests before relying on it.',
        })
        continue
      }
      for (const property of attributes) {
        if (a[property] === b[property]) continue
        const uncertain = a[property] === undefined || b[property] === undefined
        add({
          kind: uncertain ? 'unknown' : 'changed',
          entity: name,
          field,
          property,
          before: show(a[property]),
          after: show(b[property]),
          message: uncertain
            ? 'Metadata availability changed; a database change is not established.'
            : 'Observed field metadata changed.',
        })
      }
    }
  }
  const edgeKey = (r: Snapshot['relationships'][number]) =>
    JSON.stringify([r.source, r.target, r.field])
  const oldEdges = new Map(before.relationships.map((r) => [edgeKey(r), r])),
    newEdges = new Map(after.relationships.map((r) => [edgeKey(r), r]))
  for (const key of new Set([...oldEdges.keys(), ...newEdges.keys()])) {
    const a = oldEdges.get(key),
      b = newEdges.get(key),
      r = b ?? a!
    if (a && b && a.label === b.label && a.evidence === b.evidence) continue
    const uncertain = !before.complete || !after.complete
    add({
      kind: uncertain
        ? 'unknown'
        : a && b
          ? 'changed'
          : b
            ? 'added'
            : 'missing',
      entity: r.source,
      field: r.field || undefined,
      property: `Navigation → ${r.target}`,
      before: a ? `${a.label} (${a.evidence})` : 'Not observed',
      after: b ? `${b.label} (${b.evidence})` : 'Not observed',
      message:
        'Exposed relationship/navigation metadata changed. This is not a full FileMaker dependency analysis.',
    })
  }
  return { comparable: true, changes, warnings }
}
export function affectedRequests(
  changes: SchemaChange[],
  requests: SavedRequest[],
) {
  return requests.flatMap((request) => {
    const fields = new Set([
      ...request.query.conditions.map((c) => c.field),
      ...request.expectations.fields.map((f) => f.name),
      ...(request.query.sort ? [request.query.sort.field] : []),
    ])
    const reasons = changes.filter(
      (c) =>
        c.entity === request.query.entity &&
        (!c.field ||
          fields.has(c.field) ||
          c.property.startsWith('Navigation')),
    )
    return reasons.length ? [{ request, reasons }] : []
  })
}
export function labChangeExample(
  current: SchemaVersion,
): [SchemaVersion, SchemaVersion] {
  const before = structuredClone(current),
    after = structuredClone(current)
  before.id = 'example-before'
  after.id = 'example-after'
  after.inspectedAt = new Date(
    new Date(before.inspectedAt).getTime() + 60000,
  ).toISOString()
  const customer = after.entities.find((e) => e.name === 'Customers')
  if (customer) {
    customer.fields = customer.fields.filter((f) => f.name !== 'Email')
    const name = customer.fields.find((f) => f.name === 'FullName')
    if (name) {
      name.type = 'number'
      name.nativeType = after.protocol === 'OData' ? 'Edm.Decimal' : 'number'
    }
    customer.fields.push({
      name: 'AccountTier',
      type: 'text',
      nativeType: after.protocol === 'OData' ? 'Edm.String' : 'text',
      description: 'Illustrative new field',
      nullable: true,
    })
  }
  return [before, after]
}
