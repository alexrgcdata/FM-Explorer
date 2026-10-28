import { z } from 'zod'
import type { Profile } from './data'
import { labProfiles } from './contracts'
import { readEndpoint, validateDatabaseName } from './connection-setup'
import { makeSchemaVersion, type SchemaVersion } from './schema-history'
import { savedRequestSchema, type SavedRequest } from './saved-requests'
import { knowledgeNoteSchema, type KnowledgeNote } from './knowledge'
import { database } from './storage'

export const workspaceFileLimit = 10 * 1024 * 1024
const text = z.string().max(4000)
const name = z.string().min(1).max(500)
const id = z.string().min(1).max(100)
const protocol = z.enum(['Data API', 'OData'])
const profileSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    host: z.string().max(1000),
    database: z.string().min(1).max(200),
    protocol,
    lab: z.literal(true).optional(),
    apiVersion: z.enum(['v1', 'v2', 'vLatest']).optional(),
  })
  .superRefine((p, ctx) => {
    try {
      if (p.lab) {
        const lab = labProfiles.find((l) => l.id === p.id)
        if (
          !lab ||
          lab.name !== p.name ||
          lab.host !== p.host ||
          lab.database !== p.database ||
          lab.protocol !== p.protocol ||
          lab.apiVersion !== p.apiVersion
        )
          throw new Error('The bundled lab connection does not match.')
      } else {
        if (labProfiles.some((l) => l.id === p.id))
          throw new Error(
            'A real connection cannot use a bundled lab identifier.',
          )
        if (readEndpoint(p.host).host !== p.host)
          throw new Error(
            'Connection hosts must be HTTPS origins without paths or credentials.',
          )
        validateDatabaseName(p.database)
      }
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'Invalid connection.',
      })
    }
  })
const fieldSchema = z.object({
  name,
  description: text,
  type: z.enum([
    'text',
    'number',
    'date',
    'timestamp',
    'boolean',
    'time',
    'container',
    'json',
    'unknown',
  ]),
  required: z.boolean().optional(),
  key: z.boolean().optional(),
  reference: text.optional(),
  auto: z.boolean().optional(),
  nativeType: text.optional(),
  nullable: z.boolean().optional(),
  unique: z.boolean().optional(),
  indexed: z.boolean().optional(),
  global: z.boolean().optional(),
  repetitions: z.number().int().min(1).max(100000).optional(),
})
const versionSchema = z.object({
  id,
  profileId: id,
  database: name,
  protocol,
  source: text,
  inspectedAt: z.string().datetime(),
  complete: z.boolean(),
  warnings: z.array(text).max(1000),
  target: text.optional(),
  apiVersion: z.enum(['v1', 'v2', 'vLatest']).optional(),
  accessScope: text,
  entities: z
    .array(
      z.object({
        name,
        description: text,
        fields: z.array(fieldSchema).max(10000),
        rows: z.array(z.never()).max(0),
        endpoint: text.optional(),
        source: text.optional(),
        warning: text.optional(),
        kind: z.enum(['layout', 'entity-set']).optional(),
      }),
    )
    .max(2000),
  relationships: z
    .array(
      z.object({
        source: name,
        target: name,
        field: text,
        label: text,
        evidence: text,
      }),
    )
    .max(10000),
})
const archiveSchema = z
  .object({
    format: z.literal('fm-explorer-workspace'),
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    profile: profileSchema,
    schemaVersions: z.array(versionSchema).max(50),
    savedRequests: z.array(savedRequestSchema).max(100),
    knowledgeNotes: z.array(knowledgeNoteSchema).max(200),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const list of [
      value.schemaVersions,
      value.savedRequests,
      value.knowledgeNotes,
    ]) {
      if (new Set(list.map((item) => item.id)).size !== list.length)
        ctx.addIssue({
          code: 'custom',
          message: 'Duplicate item identifiers are not allowed.',
        })
      if (list.some((item) => item.profileId !== value.profile.id))
        ctx.addIssue({
          code: 'custom',
          message: 'Every item must belong to the exported connection.',
        })
    }
    if (
      value.schemaVersions.some(
        (v) =>
          v.protocol !== value.profile.protocol ||
          v.database !== value.profile.database ||
          (v.target && v.target !== value.profile.host),
      ) ||
      value.savedRequests.some((r) => r.protocol !== value.profile.protocol)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Schema and request sources must match the connection.',
      })
  })
export type WorkspaceArchive = z.infer<typeof archiveSchema>

export function buildWorkspaceArchive(input: {
  profile: Profile
  schemaVersions: SchemaVersion[]
  savedRequests: SavedRequest[]
  knowledgeNotes: KnowledgeNote[]
}): WorkspaceArchive {
  return archiveSchema.parse({
    format: 'fm-explorer-workspace',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: input.profile,
    schemaVersions: input.schemaVersions.map((v) => ({
      ...makeSchemaVersion(v),
      target: v.target,
      apiVersion: v.apiVersion,
      accessScope: v.accessScope,
    })),
    savedRequests: input.savedRequests,
    knowledgeNotes: input.knowledgeNotes,
  })
}

export function parseWorkspaceArchive(
  content: string,
  previewOnly = false,
): WorkspaceArchive {
  if (new TextEncoder().encode(content).byteLength > workspaceFileLimit)
    throw new Error('Choose a workspace JSON file smaller than 10 MB.')
  let input: unknown
  try {
    input = JSON.parse(content)
  } catch {
    throw new Error(
      'This file is not valid JSON. Choose an FM Explorer workspace export.',
    )
  }
  const result = archiveSchema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(
      `This workspace file cannot be imported: ${issue.message} (${issue.path.join('.') || 'file'}).`,
    )
  }
  if (previewOnly && !result.data.profile.lab)
    throw new Error(
      'The website demo imports bundled lab workspaces only. Use the local application for real connection workspaces.',
    )
  return result.data
}

// Validate again at the persistence boundary. A single transaction prevents partial restores.
// Existing definitions are never overwritten; imported items receive new identifiers.
export async function importWorkspaceArchive(
  input: WorkspaceArchive,
  previewOnly = false,
) {
  const archive = parseWorkspaceArchive(JSON.stringify(input), previewOnly)
  const db = await database
  const tx = db.transaction(
    ['profiles', 'snapshots', 'schemaVersions', 'requests', 'knowledgeNotes'],
    'readwrite',
  )
  try {
    const profiles = await tx.objectStore('profiles').getAll()
    const existing = profiles.find(
      (p) =>
        p.name === archive.profile.name &&
        p.lab === archive.profile.lab &&
        p.host === archive.profile.host &&
        p.database === archive.profile.database &&
        p.protocol === archive.profile.protocol &&
        p.apiVersion === archive.profile.apiVersion,
    )
    const profile: Profile = existing ?? {
      ...archive.profile,
      id: archive.profile.lab ? archive.profile.id : crypto.randomUUID(),
    }
    const requests = await tx
      .objectStore('requests')
      .index('by-profile')
      .count(profile.id)
    const notes = await tx
      .objectStore('knowledgeNotes')
      .index('by-profile')
      .count(profile.id)
    if (
      requests + archive.savedRequests.length > 100 ||
      notes + archive.knowledgeNotes.length > 200
    )
      throw new Error(
        'This connection would exceed 100 saved checks or 200 notes. Remove unneeded items before importing; nothing was changed.',
      )
    if (!existing) await tx.objectStore('profiles').add(profile)
    const existingVersions = await tx
      .objectStore('schemaVersions')
      .index('by-profile')
      .count(profile.id)
    const versions = [...archive.schemaVersions]
      .sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))
      .slice(0, Math.max(0, 50 - existingVersions))
    for (const version of versions)
      await tx
        .objectStore('schemaVersions')
        .add({ ...version, id: crypto.randomUUID(), profileId: profile.id })
    if (!(await tx.objectStore('snapshots').get(profile.id)) && versions[0])
      await tx
        .objectStore('snapshots')
        .put({ ...versions[0], id: crypto.randomUUID(), profileId: profile.id })
    for (const request of archive.savedRequests)
      await tx
        .objectStore('requests')
        .add({ ...request, id: crypto.randomUUID(), profileId: profile.id })
    for (const note of archive.knowledgeNotes)
      await tx
        .objectStore('knowledgeNotes')
        .add({ ...note, id: crypto.randomUUID(), profileId: profile.id })
    await tx.done
    return {
      profile,
      versions: versions.length,
      skippedVersions: archive.schemaVersions.length - versions.length,
      requests: archive.savedRequests.length,
      notes: archive.knowledgeNotes.length,
    }
  } catch (error) {
    try {
      tx.abort()
    } catch {
      /* The transaction may already have aborted. */
    }
    await tx.done.catch(() => {})
    throw error
  }
}
