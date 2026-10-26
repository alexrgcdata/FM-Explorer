import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Code2,
  ClipboardCheck,
  Database,
  DatabaseZap,
  GitBranch,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  Terminal,
  Unplug,
  X,
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import type { Page, Profile } from './lib/data'
import { WorkspaceProvider, useWorkspace } from './lib/workspace'
import { allMarkdown, downloadFile } from './lib/generators'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu'
import { Switch } from './components/ui/switch'
import { TooltipProvider } from './components/ui/tooltip'
import { Choice, IconButton, TypeIcon } from './components/shared'
import { SchemaView } from './components/schema-view'
import { RecordsView } from './components/records-view'
import { QueryView } from './components/query-view'
import { GenerateView } from './components/generate-view'
import { ConnectionManager } from './components/connection-manager'
import { SavedRequestsView } from './components/saved-requests-view'
import { SchemaHistoryView } from './components/schema-history-view'
import type { SavedRequest } from './lib/saved-requests'
import {
  ConnectionDialog,
  AuthenticationDialog,
} from './components/connect-dialogs'

const RelationshipView = lazy(() => import('./components/relationship-view'))
const navigation = [
  { id: 'overview', title: 'Overview', icon: LayoutDashboard },
  { id: 'schema', title: 'Schema explorer', icon: Table2 },
  { id: 'history', title: 'Schema history', icon: History },
  { id: 'records', title: 'Data browser', icon: Database },
  { id: 'relationships', title: 'Relationships', icon: GitBranch },
  { id: 'query', title: 'Query builder', icon: Terminal },
  { id: 'requests', title: 'Saved requests', icon: ClipboardCheck },
  { id: 'developer', title: 'Developer tools', icon: Code2 },
  { id: 'ai', title: 'AI tools', icon: Sparkles },
] as const
const descriptions: Record<Page, string> = {
  overview: 'A clearer view of your FileMaker solution.',
  schema: 'Understand your structure. Find exactly what you need.',
  records: 'Your records, without the guesswork.',
  relationships: 'Follow the connections across your solution.',
  query: 'From a question to an API request.',
  developer: 'Your schema, translated into your stack.',
  ai: 'Make your solution understandable to agents.',
  requests: 'Reusable requests. Clear expectations. Repeatable checks.',
  history: 'Dated schemas. Visible changes. Integration impact.',
}
export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <WorkspaceProvider>
        <Explorer />
      </WorkspaceProvider>
    </TooltipProvider>
  )
}
function Explorer() {
  const w = useWorkspace(),
    { profile, entities, relationships, snapshot, session } = w
  const [page, setPage] = useState<Page>('schema'),
    [requestFilter, setRequestFilter] = useState(''),
    [entityName, setEntityName] = useState('Customers'),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [treeOpen, setTreeOpen] = useState(true),
    [expanded, setExpanded] = useState<string | null>(null),
    [resourceSearch, setResourceSearch] = useState(''),
    [searchOpen, setSearchOpen] = useState(false),
    [globalSearch, setGlobalSearch] = useState(''),
    [connectionOpen, setConnectionOpen] = useState(false),
    [managerOpen, setManagerOpen] = useState(false),
    [authProfile, setAuthProfile] = useState<Profile | null>(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [fieldFocus, setFieldFocus] = useState<string>(),
    [editingRequest, setEditingRequest] = useState<SavedRequest | undefined>()
  const entity = entities.find((e) => e.name === entityName) ?? entities[0],
    current = navigation.find((n) => n.id === page)!
  function navigate(next: Page) {
    setRequestFilter('')
    setPage(next)
    setSidebarOpen(false)
  }
  function selectEntity(name: string, next: Page = page) {
    setEntityName(name)
    setFieldFocus(undefined)
    navigate(['overview', 'relationships'].includes(next) ? 'schema' : next)
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
  useEffect(() => {
    document.title = `${current.title} · FM API Explorer`
    window.scrollTo(0, 0)
  }, [current.title, profile.id, entityName])
  async function refresh() {
    try {
      await w.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refresh failed.')
    }
  }
  const matches = entities
    .flatMap((e) => [
      ...(e.name.toLowerCase().includes(globalSearch.toLowerCase())
        ? [{ entity: e.name, label: e.name, type: 'Resource' }]
        : []),
      ...e.fields
        .filter(
          (f) =>
            globalSearch.length > 0 &&
            `${f.name} ${f.nativeType ?? f.type}`
              .toLowerCase()
              .includes(globalSearch.toLowerCase()),
        )
        .map((f) => ({ entity: e.name, label: f.name, type: 'Field' })),
    ])
    .slice(0, 40)
  if (!w.ready)
    return (
      <div className="loading-panel">
        <RefreshCw size={23} className="animate-spin" />
        Opening IndexedDB workspace…
      </div>
    )
  if (w.startupError)
    return (
      <div className="startup-error panel">
        <DatabaseZap size={30} className="amber" />
        <h1>Let’s reopen your workspace.</h1>
        <p role="alert">{w.startupError}</p>
        <p>
          Start the local service with <code>npm start</code>. Browser storage
          must allow IndexedDB.
        </p>
        <Button onClick={() => location.reload()}>Try again</Button>
      </div>
    )
  const resources = entities
    .filter((e) =>
      `${e.name} ${e.fields.map((f) => f.name).join(' ')}`
        .toLowerCase()
        .includes(resourceSearch.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(w.favorites.includes(b.name)) -
        Number(w.favorites.includes(a.name)),
    )
  const fieldCount = entities.reduce((n, e) => n + e.fields.length, 0),
    counted = entities.filter((e) => typeof e.count === 'number'),
    recordCount = counted.reduce((n, e) => n + (e.count ?? 0), 0)
  return (
    <div className={`app-shell ${w.reducedMotion ? 'reduce-motion' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      {sidebarOpen && (
        <button
          aria-label="Dismiss navigation"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            navigate('overview')
          }}
        >
          <span className="brand-mark">
            <DatabaseZap size={23} strokeWidth={1.8} />
          </span>
          <span>
            <strong>
              FM API Explorer<span className="brand-dot">.</span>
            </strong>
            <small>YOUR FILEMAKER, UNPACKED</small>
          </span>
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="connection-switch">
              <span className="connection-avatar">
                {profile.name[0]}
                <span className={!session ? 'offline-dot' : ''} />
              </span>
              <span className="connection-label">
                <strong>{profile.name}</strong>
                <small>
                  {profile.lab
                    ? 'Local lab'
                    : session
                      ? 'Connected'
                      : 'Saved profile'}{' '}
                  · {profile.protocol}
                </small>
              </span>
              <ChevronsUpDown size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="connection-menu">
            <DropdownMenuLabel>Connections</DropdownMenuLabel>
            {w.profiles.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => {
                  void w.selectProfile(p.id)
                }}
              >
                <Database size={15} />
                <span>
                  {p.name}
                  <small className="menu-subtitle">
                    {p.protocol} ·{' '}
                    {w.sessions[p.id]
                      ? 'Connected'
                      : p.lab
                        ? 'Local practice'
                        : 'Disconnected'}
                  </small>
                </span>
                {p.id === profile.id && (
                  <Check size={13} className="ml-auto amber" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setManagerOpen(true)}>
              <Settings2 size={14} />
              Manage connections
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConnectionOpen(true)}>
              <Plus size={14} />
              New connection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button className="sidebar-search" onClick={() => setSearchOpen(true)}>
          <Search size={14} />
          <span>Quick search…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="sidebar-scroll">
          <div className="nav-caption">WORKSPACE</div>
          <nav className="main-nav">
            {navigation.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={17} strokeWidth={1.7} />
                <span>{item.title}</span>
                {item.id === 'ai' && <span className="new-label">NEW</span>}
                {page === item.id && <span className="active-dot" />}
              </button>
            ))}
          </nav>
          <div className="resource-heading">
            <button
              onClick={() => setTreeOpen(!treeOpen)}
              aria-expanded={treeOpen}
            >
              {treeOpen ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <span>
                {profile.protocol === 'Data API' ? 'LAYOUTS' : 'ENTITY SETS'}
              </span>
              <span className="resource-count">{entities.length}</span>
            </button>
            <IconButton
              label="Find a resource"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={12} />
            </IconButton>
          </div>
          {treeOpen && (
            <div className="resource-tree">
              <div className="resource-filter">
                <Search size={12} />
                <input
                  aria-label="Filter resources"
                  placeholder="Filter resources…"
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                />
              </div>
              {resources.map((e) => (
                <div key={e.name}>
                  <div
                    className={`resource-row ${entity?.name === e.name && page !== 'overview' ? 'selected' : ''}`}
                  >
                    <button
                      className="expand-resource"
                      aria-label={`${expanded === e.name ? 'Collapse' : 'Expand'} ${e.name} fields`}
                      aria-expanded={expanded === e.name}
                      onClick={() =>
                        setExpanded(expanded === e.name ? null : e.name)
                      }
                    >
                      {expanded === e.name ? (
                        <ChevronDown size={11} />
                      ) : (
                        <ChevronRight size={11} />
                      )}
                    </button>
                    <button
                      className="resource-select"
                      onClick={() => selectEntity(e.name)}
                    >
                      <Table2 size={13} />
                      <span>{e.name}</span>
                      {w.favorites.includes(e.name) && (
                        <Star size={10} className="amber fill-current" />
                      )}
                      <span>{e.fields.length}</span>
                    </button>
                  </div>
                  {expanded === e.name && (
                    <div className="tree-fields">
                      {e.fields.map((f) => (
                        <button
                          key={f.name}
                          onClick={() => {
                            setEntityName(e.name)
                            setFieldFocus(f.name)
                            navigate('schema')
                          }}
                        >
                          <TypeIcon type={f.type} />
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!resources.length && (
                <p className="tree-empty">
                  {snapshot
                    ? 'No matching resources.'
                    : 'Connect to discover resources.'}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="local-icon">
              <ShieldCheck size={17} />
            </span>
            <span>
              <strong>Local. Private. Yours.</strong>
              <small>IndexedDB · read-only access</small>
            </span>
          </div>
          <div className="sidebar-utilities">
            <button onClick={() => setManagerOpen(true)}>
              <Database size={15} />
              Connections
              <ArrowUpRight size={12} />
            </button>
            <button onClick={() => setHelpOpen(true)}>
              <CircleHelp size={15} />
              Help & shortcuts
            </button>
            <button onClick={() => setSettingsOpen(true)}>
              <Settings2 size={15} />
              Settings
            </button>
          </div>
          <div className="workspace-user">
            <span className="user-avatar">AS</span>
            <div>
              <strong>Your workspace</strong>
              <small>Personal · Local service</small>
            </div>
            <span className="local-badge">LOCAL</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <IconButton
            label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            className="mobile-nav-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </IconButton>
          <div className="breadcrumb">
            <Database size={14} />
            <span>{profile.database}</span>
            <ChevronRight size={12} />
            <strong>{current.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="top-protocol">
              <Braces size={12} />
              {profile.protocol}
            </span>
            <span
              className={`connection-status ${session ? '' : 'disconnected'}`}
            >
              <span />
              {session
                ? profile.lab
                  ? 'Local lab connected'
                  : 'Connected'
                : snapshot
                  ? 'Offline snapshot'
                  : 'Disconnected'}
            </span>
            <span className="topbar-divider" />
            <IconButton
              label="Search workspace"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
            </IconButton>
            <IconButton
              label="Connection manager"
              onClick={() => setManagerOpen(true)}
            >
              <Database size={16} />
            </IconButton>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="page-overline">
                <span className="amber-square" />
                YOUR DEVELOPER WORKBENCH
              </div>
              <h1>
                {current.title}
                <span className="heading-dot">.</span>
              </h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              {snapshot && (
                <>
                  <IconButton
                    label="Refresh schema"
                    disabled={w.busy || !session}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw
                      size={15}
                      className={w.busy ? 'animate-spin' : ''}
                    />
                  </IconButton>
                  <Button
                    variant="outline"
                    onClick={() =>
                      downloadFile(
                        `${profile.database}-schema.md`,
                        allMarkdown(
                          profile.protocol,
                          entities,
                          relationships,
                          profile.database,
                        ),
                        'text/markdown',
                      )
                    }
                  >
                    <ArrowDownToLine size={14} />
                    Export schema
                  </Button>
                </>
              )}
              {!session && (
                <Button
                  onClick={() => setAuthProfile(profile)}
                  disabled={w.busy}
                >
                  <Unplug size={14} />
                  {snapshot ? 'Reconnect' : 'Connect'}
                </Button>
              )}
            </div>
          </div>
          {w.storageError && (
            <div className="error-banner" role="alert">
              {w.storageError}
            </div>
          )}
          {profile.lab && (
            <div className="source-banner">
              <ShieldCheck size={14} />
              <span>
                Local FileMaker Lab · synthetic practice database. No external
                server is connected.
              </span>
              <button onClick={() => setConnectionOpen(true)}>
                Add real endpoint
                <ArrowUpRight size={12} />
              </button>
            </div>
          )}
          {snapshot && !session && (
            <div className="offline-banner">
              <Unplug size={15} />
              Saved schema from{' '}
              {new Date(snapshot.inspectedAt).toLocaleString()}. Reconnect for
              current records.
            </div>
          )}
          {page === 'requests' ? (
            <SavedRequestsView
              key={`${profile.id}:${requestFilter}`}
              initialSearch={requestFilter}
              onOpenBuilder={(request) => {
                setEditingRequest(request)
                if (request) setEntityName(request.query.entity)
                navigate('query')
              }}
            />
          ) : page === 'history' ? (
            <SchemaHistoryView
              key={profile.id}
              onOpenRequest={(request) => {
                navigate('requests')
                setRequestFilter(request.name)
              }}
            />
          ) : !snapshot ? (
            <section className="unconnected panel">
              <div className="unconnected-icon">
                <DatabaseZap size={30} />
              </div>
              <span className="eyebrow">YOUR NEXT CONNECTION</span>
              <h2>
                {profile.lab
                  ? 'Meet your local FileMaker lab.'
                  : `Connect to ${profile.name}.`}
              </h2>
              <p>
                {profile.lab
                  ? 'A synthetic CRM with six resources. Connect to exercise authentication, metadata discovery, pagination, and queries through the local service.'
                  : 'Sign in with a database account or use an existing API token. Credentials stay in service memory; profiles and schema snapshots are saved in IndexedDB.'}
              </p>
              <div className="connection-summary">
                <span>
                  Endpoint<strong>{profile.host}</strong>
                </span>
                <span>
                  Database<strong>{profile.database}</strong>
                </span>
                <span>
                  Protocol<strong>{profile.protocol}</strong>
                </span>
              </div>
              <Button onClick={() => setAuthProfile(profile)} disabled={w.busy}>
                {profile.lab ? 'Connect local lab' : 'Authenticate & connect'}
                <ArrowRight size={14} />
              </Button>
              <Button variant="ghost" onClick={() => setConnectionOpen(true)}>
                Add another connection
              </Button>
            </section>
          ) : (
            <>
              {snapshot.warnings.length > 0 && (
                <details className="discovery-notes">
                  <summary>
                    {snapshot.complete
                      ? 'Discovery notes'
                      : 'Partial schema discovery'}{' '}
                    · {snapshot.warnings.length}{' '}
                    {snapshot.warnings.length === 1 ? 'note' : 'notes'}
                  </summary>
                  <ul>
                    {snapshot.warnings.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </details>
              )}
              {(page === 'schema' || page === 'overview') && (
                <div className="stats-grid">
                  <Stat
                    icon={Table2}
                    value={entities.length}
                    label={
                      profile.protocol === 'Data API'
                        ? 'Layouts'
                        : 'Entity sets'
                    }
                    detail="Accessible resources"
                  />
                  <Stat
                    icon={Braces}
                    value={fieldCount}
                    label="Fields"
                    detail="Inspected metadata"
                  />
                  <Stat
                    icon={GitBranch}
                    value={relationships.length}
                    label="Relationships"
                    detail="Available evidence"
                  />
                  <Stat
                    icon={Database}
                    value={counted.length ? recordCount : '—'}
                    label="Records reported"
                    detail={`${counted.length}/${entities.length} resource counts`}
                  />
                </div>
              )}
              {page === 'overview' && (
                <>
                  <section className="overview-welcome panel">
                    <div>
                      <span className="eyebrow">
                        <span className="tiny-dot" />
                        {profile.database}
                      </span>
                      <h2>
                        Everything connects.
                        <br />
                        <span>Start exploring.</span>
                      </h2>
                      <p>
                        {entities.length} accessible resources. Last inspected{' '}
                        {new Date(snapshot.inspectedAt).toLocaleString()}.
                      </p>
                      <Button onClick={() => navigate('schema')}>
                        Explore your schema
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                    <div className="overview-visual" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="orbit-core">
                        <DatabaseZap size={40} />
                      </div>
                      {entities.slice(0, 3).map((e, i) => (
                        <span
                          key={e.name}
                          className={`orbit-label ${['orbit-customer', 'orbit-order', 'orbit-product'][i]}`}
                        >
                          <Table2 size={14} />
                          {e.name}
                        </span>
                      ))}
                    </div>
                  </section>
                  <div className="section-label">
                    <h3>Your resources</h3>
                    <span>{entities.length} available</span>
                  </div>
                  <div className="resource-cards">
                    {entities.map((e) => (
                      <button
                        key={e.name}
                        className="panel resource-card"
                        onClick={() => selectEntity(e.name, 'schema')}
                      >
                        <span className="resource-card-icon">
                          <Table2 size={19} />
                        </span>
                        <ArrowUpRight size={15} className="card-arrow" />
                        <h3>{e.name}</h3>
                        <p>{e.description}</p>
                        <div>
                          <span>{e.fields.length} fields</span>
                          <span>{e.count ?? '—'} records</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!entity && page !== 'overview' ? (
                <div className="empty-state">
                  <Database size={27} />
                  <h3>No accessible resources were returned.</h3>
                  <p>Check account privileges and discovery notes.</p>
                </div>
              ) : (
                entity && (
                  <>
                    {page === 'schema' && (
                      <SchemaView
                        key={`${profile.id}:${entity.name}:${fieldFocus ?? ''}`}
                        initialField={fieldFocus}
                        isFavorite={w.favorites.includes(entity.name)}
                        onFavorite={() => void w.toggleFavorite(entity.name)}
                        entity={entity}
                        protocol={profile.protocol}
                        onRecords={() => navigate('records')}
                        onGenerate={() => navigate('developer')}
                        onRelationships={() => navigate('relationships')}
                      />
                    )}
                    {(page === 'records' || page === 'query') && (
                      <div className="resource-selector">
                        <Table2 size={14} />
                        <span>Resource</span>
                        <Choice
                          label="Selected resource"
                          value={entity.name}
                          onChange={(name) => selectEntity(name)}
                          items={entities.map((e) => ({
                            value: e.name,
                            label: e.name,
                          }))}
                        />
                      </div>
                    )}
                    {page === 'records' && (
                      <RecordsView
                        key={`${profile.id}:${entity.name}`}
                        entity={entity}
                        compact={w.compact}
                      />
                    )}
                    {page === 'query' && (
                      <QueryView
                        key={`${profile.id}:${entity.name}:${editingRequest?.id ?? 'new'}`}
                        entity={entity}
                        protocol={profile.protocol}
                        savedRequest={
                          editingRequest?.profileId === profile.id &&
                          editingRequest.query.entity === entity.name
                            ? editingRequest
                            : undefined
                        }
                        onOpenSaved={() => navigate('requests')}
                      />
                    )}
                    {page === 'relationships' && (
                      <Suspense
                        fallback={
                          <div className="loading-panel">
                            <RefreshCw size={20} className="animate-spin" />
                            Loading graph…
                          </div>
                        }
                      >
                        <RelationshipView
                          key={snapshot.id}
                          initialEntity={entity.name}
                          onOpen={(name) => selectEntity(name, 'schema')}
                        />
                      </Suspense>
                    )}
                    {(page === 'developer' || page === 'ai') && (
                      <GenerateView
                        key={`${profile.id}:${page}`}
                        entity={entity}
                        entities={entities}
                        protocol={profile.protocol}
                        ai={page === 'ai'}
                        onEntity={setEntityName}
                      />
                    )}
                  </>
                )
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={12} />
              Read-only workspace<span className="footer-dot">·</span>IndexedDB
              storage
            </span>
            <span>
              <Activity size={12} />
              {session
                ? `${session.latencyMs} ms connection check`
                : snapshot
                  ? 'Saved schema'
                  : 'Ready to connect'}
              <span className="footer-dot">·</span>v0.3.0
            </span>
          </footer>
        </main>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="search-dialog">
          <DialogHeader>
            <DialogTitle>
              <Search size={18} />
              Search your workspace
            </DialogTitle>
            <DialogDescription>
              Search inspected resources, field names, and native types.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Search workspace resources"
            placeholder="Search resources or fields…"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          <div className="search-results">
            {matches.map((result) => (
              <button
                key={`${result.entity}:${result.type}:${result.label}`}
                onClick={() => {
                  setEntityName(result.entity)
                  setFieldFocus(
                    result.type === 'Field' ? result.label : undefined,
                  )
                  navigate('schema')
                  setSearchOpen(false)
                }}
              >
                {result.type === 'Resource' ? (
                  <Table2 size={16} />
                ) : (
                  <Braces size={16} />
                )}
                <span>
                  <strong>{result.label}</strong>
                  <small>
                    {result.entity} · {result.type}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {!matches.length && (
              <p className="empty-search">
                {snapshot
                  ? 'No matching resources or fields.'
                  : 'Connect to discover searchable schema.'}
              </p>
            )}
          </div>
          <div className="search-hint">
            <kbd>Esc</kbd> to close
          </div>
        </DialogContent>
      </Dialog>
      <ConnectionDialog
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
        onAuthenticate={setAuthProfile}
      />
      <AuthenticationDialog
        key={authProfile?.id ?? 'closed'}
        profile={authProfile}
        onClose={() => setAuthProfile(null)}
      />
      <ConnectionManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onConnect={(p) => {
          setManagerOpen(false)
          setAuthProfile(p)
        }}
        onAdd={() => {
          setManagerOpen(false)
          setConnectionOpen(true)
        }}
      />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace settings</DialogTitle>
            <DialogDescription>
              Preferences and schema snapshots are stored in IndexedDB.
            </DialogDescription>
          </DialogHeader>
          <div className="setting-row">
            <label htmlFor="compact-rows">
              <strong>Compact record rows</strong>
              <span>Fit more records into the data browser.</span>
            </label>
            <Switch
              id="compact-rows"
              checked={w.compact}
              onCheckedChange={(value) => void w.setCompact(value)}
            />
          </div>
          <div className="setting-row">
            <label htmlFor="reduced-motion">
              <strong>Reduce motion</strong>
              <span>Keep transitions and graph animations still.</span>
            </label>
            <Switch
              id="reduced-motion"
              checked={w.reducedMotion}
              onCheckedChange={(value) => void w.setReducedMotion(value)}
            />
          </div>
          <div className="info-banner">
            <ShieldCheck size={16} />
            <p>
              Passwords and tokens are never stored in IndexedDB. Record pages
              stay in memory. Saved schema may contain private names and
              metadata.
            </p>
          </div>
          <Button variant="outline" onClick={() => void w.forgetSnapshots()}>
            Clear saved schemas & version history
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your FileMaker workbench</DialogTitle>
            <DialogDescription>
              Use the local lab or connect an approved FileMaker endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="help-steps">
            <div>
              <span>01</span>
              <p>
                <strong>Connect</strong>Choose a profile, use an account or
                token, and inspect accessible schema.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Explore</strong>Browse server pages, sort and filter,
                inspect raw JSON, and follow available relationship evidence.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Build</strong>Execute read queries and export typed
                interfaces, specifications, collections, and agent context.
              </p>
            </div>
          </div>
          <div className="shortcut-row">
            <span>Search workspace</span>
            <kbd>Ctrl / ⌘ K</kbd>
          </div>
          <div className="shortcut-row">
            <span>Quick search</span>
            <kbd>/</kbd>
          </div>
          <div className="info-banner">
            <ShieldCheck size={16} />
            <p>
              Data API is layout-based. OData navigation and schema depend on
              what your account can access. No record writes or FileMaker
              scripts are offered.
            </p>
          </div>
          <a
            className="external-link"
            href="https://help.claris.com/en/data-api-guide/"
            target="_blank"
            rel="noreferrer"
          >
            Claris API documentation
            <ArrowUpRight size={14} />
          </a>
        </DialogContent>
      </Dialog>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </div>
  )
}
function Stat({
  icon: Icon,
  value,
  label,
  detail,
}: {
  icon: typeof Table2
  value: number | string
  label: string
  detail: string
}) {
  return (
    <div className="stat-card">
      <div>
        <span className="stat-label">{label}</span>
        <Icon size={16} strokeWidth={1.7} />
      </div>
      <strong>
        {value}
        <span>{detail}</span>
      </strong>
    </div>
  )
}
