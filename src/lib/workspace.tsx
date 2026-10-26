import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import type { Entity, Profile } from './data'
import {
  labProfiles,
  type ActivityEntry,
  type Auth,
  type Query,
  type RecordPage,
  type SessionInfo,
  type Snapshot,
} from './contracts'
import { api, bootstrap, ClientError } from './api'
import * as storage from './storage'
import {
  evaluateCheck,
  savedRequestSchema,
  type CheckRun,
  type SavedRequest,
} from './saved-requests'

function useWorkspaceState() {
  const [ready, setReady] = useState(false),
    [startupError, setStartupError] = useState(''),
    [storageError, setStorageError] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>(labProfiles),
    [activeId, setActiveId] = useState('lab-data'),
    [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({}),
    [sessions, setSessions] = useState<Record<string, SessionInfo>>({}),
    [activity, setActivity] = useState<ActivityEntry[]>([]),
    [favorites, setFavorites] = useState<Record<string, string[]>>({}),
    [busy, setBusy] = useState(false)
  const [compact, setCompactState] = useState(false),
    [reducedMotion, setMotionState] = useState(false)
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]),
    [checkRuns, setCheckRuns] = useState<CheckRun[]>([])
  const mounted = useRef(true),
    connecting = useRef(false)
  const profile = profiles.find((p) => p.id === activeId) ?? profiles[0],
    snapshot = snapshots[profile.id],
    session = sessions[profile.id]
  async function persist(action: Promise<unknown>) {
    try {
      await action
    } catch {
      setStorageError(
        'IndexedDB could not save this change. Your current session is still usable; browser storage may be full or unavailable.',
      )
    }
  }
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    ;(async () => {
      try {
        await storage.migrateLegacy()
        const saved = await storage.getProfiles()
        for (const p of labProfiles) await storage.saveProfile(p)
        const list = [
          ...labProfiles,
          ...saved.filter(
            (p) => !p.lab && !labProfiles.some((l) => l.id === p.id),
          ),
        ]
        const cached = (
          await Promise.all(list.map((p) => storage.getSnapshot(p.id)))
        ).filter((s): s is Snapshot => !!s)
        const selected = await storage.preference('active-profile', 'lab-data')
        const favs = await storage.preference<Record<string, string[]>>(
          'favorites',
          {},
        )
        const history = await storage.getActivity()
        const requests = await storage.getRequests(),
          runs = await storage.getCheckRuns()
        if (cancelled) return
        setProfiles(list)
        setSnapshots(Object.fromEntries(cached.map((s) => [s.profileId, s])))
        setActiveId(list.some((p) => p.id === selected) ? selected : 'lab-data')
        setFavorites(favs)
        setActivity(history)
        setSavedRequests(requests)
        setCheckRuns(runs)
        setCompactState(await storage.preference('compact', false))
        setMotionState(await storage.preference('reduced-motion', false))
        await bootstrap()
        const found = await api.sessions()
        if (!cancelled)
          setSessions(
            Object.fromEntries(found.sessions.map((s) => [s.profileId, s])),
          )
      } catch (error) {
        if (!cancelled)
          setStartupError(
            error instanceof Error
              ? error.message
              : 'Could not open the workspace.',
          )
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [])
  async function log(
    profileId: string,
    action: string,
    success: boolean,
    detail: string,
    durationMs?: number,
  ) {
    const entry: ActivityEntry = {
      id: crypto.randomUUID(),
      profileId,
      at: new Date().toISOString(),
      action,
      success,
      detail,
      durationMs,
    }
    if (mounted.current)
      setActivity((current) => [entry, ...current].slice(0, 200))
    await persist(storage.saveActivity(entry))
  }
  async function selectProfile(id: string) {
    setActiveId(id)
    await persist(storage.setPreference('active-profile', id))
  }
  async function addProfile(p: Profile) {
    setProfiles((current) => [...current.filter((v) => v.id !== p.id), p])
    await persist(storage.saveProfile(p))
    await selectProfile(p.id)
    await log(
      p.id,
      'Profile saved',
      true,
      'Nonsecret connection profile saved in IndexedDB.',
    )
  }
  async function connect(p: Profile, auth: Auth) {
    if (connecting.current)
      throw new Error('A connection attempt is already running.')
    connecting.current = true
    setBusy(true)
    const start = performance.now()
    try {
      const previous = sessions[p.id]
      if (previous) await api.disconnect(previous.id).catch(() => {})
      setSessions((current) => {
        const next = { ...current }
        delete next[p.id]
        return next
      })
      const result = await api.connect(p, auth)
      setSessions((current) => ({ ...current, [p.id]: result.session }))
      setSnapshots((current) => ({ ...current, [p.id]: result.snapshot }))
      await persist(storage.saveSnapshot(result.snapshot))
      await selectProfile(p.id)
      await log(
        p.id,
        'Connected',
        true,
        `${result.snapshot.entities.length} accessible resources inspected. ${result.snapshot.complete ? 'Discovery completed.' : 'Partial discovery; see warnings.'}`,
        Math.round(performance.now() - start),
      )
      toast.success(`Connected to ${p.name}`)
    } catch (error) {
      await log(
        p.id,
        'Connection failed',
        false,
        error instanceof Error ? error.message : 'Connection failed.',
        Math.round(performance.now() - start),
      )
      throw error
    } finally {
      connecting.current = false
      setBusy(false)
    }
  }
  async function refresh(profileId = profile.id) {
    const connected = sessions[profileId]
    if (!connected) throw new Error('Connect before refreshing metadata.')
    setBusy(true)
    try {
      const result = await api.refresh(connected.id)
      setSnapshots((current) => ({ ...current, [profileId]: result.snapshot }))
      setSessions((current) => ({ ...current, [profileId]: result.session }))
      await persist(storage.saveSnapshot(result.snapshot))
      await log(
        profileId,
        'Schema refreshed',
        true,
        `${result.snapshot.entities.length} resources inspected.`,
        result.session.latencyMs,
      )
      toast.success('Schema snapshot refreshed')
    } catch (error) {
      handleAuthError(error, profileId)
      await log(
        profileId,
        'Refresh failed',
        false,
        error instanceof Error ? error.message : 'Refresh failed.',
      )
      throw error
    } finally {
      setBusy(false)
    }
  }
  function handleAuthError(error: unknown, id: string) {
    if (error instanceof ClientError && error.status === 401)
      setSessions((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
  }
  async function disconnect(id = profile.id) {
    const connected = sessions[id]
    if (connected) {
      const result = await api.disconnect(connected.id).catch(() => ({
        warning:
          'The service could not confirm remote logout. Local access was cleared.',
      }))
      if (result.warning) toast.warning(result.warning)
    }
    setSessions((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    await log(
      id,
      'Disconnected',
      true,
      'Local authorization cleared. Schema remains available offline.',
    )
  }
  async function remove(id: string) {
    if (profiles.find((p) => p.id === id)?.lab) return
    await disconnect(id)
    await persist(storage.removeProfile(id))
    setProfiles((current) => current.filter((p) => p.id !== id))
    setSnapshots((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setActivity((current) => current.filter((e) => e.profileId !== id))
    setSavedRequests((current) => current.filter((r) => r.profileId !== id))
    setCheckRuns((current) => current.filter((r) => r.profileId !== id))
    if (activeId === id) await selectProfile('lab-data')
  }
  async function loadRecords(
    query: Query,
    signal?: AbortSignal,
  ): Promise<RecordPage> {
    const current = sessions[profile.id]
    if (!current) throw new Error('Reconnect to browse current records.')
    try {
      return await api.records(current.id, query, signal)
    } catch (error) {
      handleAuthError(error, profile.id)
      throw error
    }
  }
  async function execute(query: Query, signal?: AbortSignal) {
    const start = performance.now()
    try {
      const result = await loadRecords(query, signal)
      await log(
        profile.id,
        'Query executed',
        true,
        `${result.rows.length} records returned. Filter values are not logged.`,
        Math.round(performance.now() - start),
      )
      return result
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        await log(
          profile.id,
          'Query failed',
          false,
          error instanceof Error ? error.message : 'Query failed.',
        )
      throw error
    }
  }
  async function toggleFavorite(name: string) {
    const current = favorites[profile.id] ?? []
    const next = {
      ...favorites,
      [profile.id]: current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name],
    }
    setFavorites(next)
    await persist(storage.setPreference('favorites', next))
  }
  async function saveRequest(value: SavedRequest) {
    const safe = savedRequestSchema.parse(value)
    if (safe.profileId !== profile.id || safe.protocol !== profile.protocol)
      throw new Error('This request belongs to another connection.')
    if (
      !savedRequests.some((r) => r.id === safe.id) &&
      savedRequests.filter((r) => r.profileId === profile.id).length >= 100
    )
      throw new Error('Keep up to 100 saved requests per connection.')
    await storage.saveRequest(safe)
    setSavedRequests((current) => [
      safe,
      ...current.filter((r) => r.id !== safe.id),
    ])
    toast.success('Request and checks saved in IndexedDB')
    return safe
  }
  async function deleteSavedRequest(id: string) {
    const saved = savedRequests.find(
      (r) => r.id === id && r.profileId === profile.id,
    )
    if (!saved) return
    await storage.deleteRequest(id)
    setSavedRequests((current) => current.filter((r) => r.id !== id))
    setCheckRuns((current) => current.filter((r) => r.requestId !== id))
    toast.success('Saved request and its results removed')
  }
  async function runSavedRequest(id: string, signal?: AbortSignal) {
    const definition = savedRequests.find(
      (r) => r.id === id && r.profileId === profile.id,
    )
    if (!definition)
      throw new Error('Saved request not found in this connection.')
    if (!session) throw new Error('Reconnect before running saved checks.')
    let run: CheckRun
    try {
      if (definition.protocol !== profile.protocol)
        throw new Error('The saved protocol does not match this connection.')
      const entity = snapshot?.entities.find(
        (e) => e.name === definition.query.entity,
      )
      if (!entity)
        throw new Error(
          'The saved resource is absent from the inspected schema. Refresh or update the request.',
        )
      const response = await execute(definition.query, signal)
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      run = {
        ...evaluateCheck(definition, response),
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      }
    } catch (error) {
      if (signal?.aborted) throw error
      run = {
        id: crypto.randomUUID(),
        requestId: definition.id,
        profileId: definition.profileId,
        requestName: definition.name,
        requestRevision: definition.revision,
        entity: definition.query.entity,
        at: new Date().toISOString(),
        status: 'error',
        returnedRows: null,
        matchingRows: null,
        durationMs: null,
        details: [],
        error:
          error instanceof Error
            ? error.message
            : 'The request could not be executed.',
      }
    }
    await storage.saveCheckRun(run)
    setCheckRuns((current) => [run, ...current].slice(0, 200))
    return run
  }
  async function setCompact(value: boolean) {
    setCompactState(value)
    await persist(storage.setPreference('compact', value))
  }
  async function setReducedMotion(value: boolean) {
    setMotionState(value)
    await persist(storage.setPreference('reduced-motion', value))
  }
  function inspectRows(
    entityName: string,
    rows: Entity['rows'],
    count: number | null,
  ) {
    setSnapshots((current) => {
      const snap = current[profile.id]
      if (!snap) return current
      return {
        ...current,
        [profile.id]: {
          ...snap,
          entities: snap.entities.map((e) =>
            e.name === entityName
              ? { ...e, rows: rows.slice(0, 1), count: count ?? e.count }
              : e,
          ),
        },
      }
    })
  }
  async function forgetSnapshots() {
    await persist(
      (async () => {
        await (await storage.database).clear('snapshots')
      })(),
    )
    setSnapshots({})
    toast.success('Saved schema snapshots cleared')
  }
  return {
    ready,
    startupError,
    storageError,
    profiles,
    profile,
    snapshot,
    session,
    sessions,
    entities: snapshot?.entities ?? [],
    relationships: snapshot?.relationships ?? [],
    activity,
    busy,
    favorites: favorites[profile.id] ?? [],
    compact,
    reducedMotion,
    selectProfile,
    addProfile,
    connect,
    refresh,
    disconnect,
    remove,
    loadRecords,
    execute,
    toggleFavorite,
    setCompact,
    setReducedMotion,
    inspectRows,
    forgetSnapshots,
    savedRequests: savedRequests.filter((r) => r.profileId === profile.id),
    checkRuns: checkRuns.filter((r) => r.profileId === profile.id),
    saveRequest,
    deleteSavedRequest,
    runSavedRequest,
  }
}
type Workspace = ReturnType<typeof useWorkspaceState>
const Context = createContext<Workspace | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceState()
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useWorkspace() {
  const value = useContext(Context)
  if (!value) throw new Error('Workspace provider is missing.')
  return value
}
