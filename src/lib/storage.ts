import { openDB, type DBSchema } from 'idb'
import type { Profile } from './data'
import type { ActivityEntry, Snapshot } from './contracts'
import { makeSchemaVersion, type SchemaVersion } from './schema-history'
import {
  savedRequestSchema,
  type CheckRun,
  type SavedRequest,
} from './saved-requests'

interface ExplorerDB extends DBSchema {
  profiles: { key: string; value: Profile }
  snapshots: { key: string; value: Snapshot }
  schemaVersions: {
    key: string
    value: SchemaVersion
    indexes: { 'by-profile': string }
  }
  preferences: { key: string; value: unknown }
  requests: {
    key: string
    value: SavedRequest
    indexes: { 'by-profile': string }
  }
  checkRuns: {
    key: string
    value: CheckRun
    indexes: { 'by-request': string; 'by-time': string }
  }
  activity: {
    key: string
    value: ActivityEntry
    indexes: { 'by-time': string }
  }
}
export const database = openDB<ExplorerDB>('fm-api-explorer', 3, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      db.createObjectStore('profiles', { keyPath: 'id' })
      db.createObjectStore('snapshots', { keyPath: 'profileId' })
      db.createObjectStore('preferences')
      db.createObjectStore('activity', { keyPath: 'id' }).createIndex(
        'by-time',
        'at',
      )
    }
    if (oldVersion < 2) {
      db.createObjectStore('requests', { keyPath: 'id' }).createIndex(
        'by-profile',
        'profileId',
      )
      const runs = db.createObjectStore('checkRuns', { keyPath: 'id' })
      runs.createIndex('by-request', 'requestId')
      runs.createIndex('by-time', 'at')
    }
    if (oldVersion < 3) {
      const versions = db.createObjectStore('schemaVersions', { keyPath: 'id' })
      versions.createIndex('by-profile', 'profileId')
      const request = transaction.objectStore('snapshots').openCursor()
      void request.then(async function migrate(cursor) {
        if (!cursor) return
        await versions.put(makeSchemaVersion(cursor.value))
        await migrate(await cursor.continue())
      })
    }
  },
  blocking(_current, _next, event) {
    const target = event.target
    if (target && 'close' in target && typeof target.close === 'function')
      target.close()
  },
})
export async function saveProfile(profile: Profile) {
  const safe: Profile = {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    database: profile.database,
    protocol: profile.protocol,
    ...(profile.lab ? { lab: true } : {}),
    ...(profile.apiVersion ? { apiVersion: profile.apiVersion } : {}),
  }
  await (await database).put('profiles', safe)
}
export async function getProfiles() {
  return (await database).getAll('profiles')
}
export async function saveSnapshot(snapshot: Snapshot, profile?: Profile) {
  const safe = {
    ...snapshot,
    entities: snapshot.entities.map((e) => ({ ...e, rows: [] })),
  }
  const db = await database,
    tx = db.transaction(['snapshots', 'schemaVersions'], 'readwrite')
  await tx.objectStore('snapshots').put(safe)
  if (!(await tx.objectStore('schemaVersions').get(snapshot.id)))
    await tx
      .objectStore('schemaVersions')
      .add(makeSchemaVersion(snapshot, profile))
  const versions = await tx
    .objectStore('schemaVersions')
    .index('by-profile')
    .getAll(snapshot.profileId)
  versions.sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))
  for (const old of versions.slice(50))
    await tx.objectStore('schemaVersions').delete(old.id)
  await tx.done
}
export async function getSchemaVersions(profileId: string) {
  return (
    await (
      await database
    ).getAllFromIndex('schemaVersions', 'by-profile', profileId)
  ).sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))
}
export async function clearSnapshots() {
  const db = await database,
    tx = db.transaction(['snapshots', 'schemaVersions'], 'readwrite')
  await tx.objectStore('snapshots').clear()
  await tx.objectStore('schemaVersions').clear()
  await tx.done
}
export async function getSnapshot(id: string) {
  return (await database).get('snapshots', id)
}
export async function removeProfile(id: string) {
  const db = await database
  const tx = db.transaction(
    [
      'profiles',
      'snapshots',
      'schemaVersions',
      'activity',
      'requests',
      'checkRuns',
    ],
    'readwrite',
  )
  await tx.objectStore('profiles').delete(id)
  await tx.objectStore('snapshots').delete(id)
  for (const key of await tx
    .objectStore('schemaVersions')
    .index('by-profile')
    .getAllKeys(id))
    await tx.objectStore('schemaVersions').delete(key)
  const logs = await tx.objectStore('activity').getAll()
  for (const log of logs)
    if (log.profileId === id) await tx.objectStore('activity').delete(log.id)
  for (const request of await tx
    .objectStore('requests')
    .index('by-profile')
    .getAll(id))
    await tx.objectStore('requests').delete(request.id)
  for (const run of await tx.objectStore('checkRuns').getAll())
    if (run.profileId === id) await tx.objectStore('checkRuns').delete(run.id)
  await tx.done
}
export async function saveRequest(value: SavedRequest) {
  const safe = savedRequestSchema.parse(value)
  await (await database).put('requests', safe)
  return safe
}
export async function getRequests() {
  const values = await (await database).getAll('requests')
  return values
    .map((value) => savedRequestSchema.parse(value))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
export async function deleteRequest(id: string) {
  const db = await database,
    tx = db.transaction(['requests', 'checkRuns'], 'readwrite')
  await tx.objectStore('requests').delete(id)
  for (const key of await tx
    .objectStore('checkRuns')
    .index('by-request')
    .getAllKeys(id))
    await tx.objectStore('checkRuns').delete(key)
  await tx.done
}
export async function saveCheckRun(run: CheckRun) {
  const db = await database,
    tx = db.transaction('checkRuns', 'readwrite')
  await tx.store.put(run)
  const keys = await tx.store.index('by-time').getAllKeys()
  for (const key of keys.slice(0, Math.max(0, keys.length - 200)))
    await tx.store.delete(key)
  await tx.done
}
export async function getCheckRuns() {
  return (
    await (await database).getAllFromIndex('checkRuns', 'by-time')
  ).reverse()
}
export async function preference<T>(key: string, fallback: T): Promise<T> {
  const value = await (await database).get('preferences', key)
  return value === undefined ? fallback : (value as T)
}
export async function setPreference(key: string, value: unknown) {
  await (await database).put('preferences', value, key)
}
export async function saveActivity(entry: ActivityEntry) {
  const db = await database
  const tx = db.transaction('activity', 'readwrite')
  await tx.store.put(entry)
  const keys = await tx.store.index('by-time').getAllKeys()
  for (const key of keys.slice(0, Math.max(0, keys.length - 200)))
    await tx.store.delete(key)
  await tx.done
}
export async function getActivity() {
  return (
    await (await database).getAllFromIndex('activity', 'by-time')
  ).reverse()
}
export async function migrateLegacy() {
  const db = await database
  if (await db.get('preferences', 'legacy-migrated')) return
  try {
    const old: unknown = JSON.parse(
      localStorage.getItem('fm-explorer-profiles') ?? '[]',
    )
    if (Array.isArray(old))
      for (const row of old) {
        if (
          row &&
          typeof row === 'object' &&
          typeof row.id === 'string' &&
          typeof row.name === 'string' &&
          typeof row.host === 'string' &&
          typeof row.database === 'string' &&
          ['Data API', 'OData'].includes(row.protocol) &&
          !row.sample
        ) {
          await saveProfile({
            id: row.id,
            name: row.name,
            host: row.host,
            database: row.database,
            protocol: row.protocol,
          })
        }
      }
  } catch {
    /* A corrupt legacy setting must not prevent opening IndexedDB. */
  }
  await db.put('preferences', true, 'legacy-migrated')
}
