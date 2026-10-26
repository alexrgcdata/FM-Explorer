import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  ClipboardCheck,
  Database,
  DatabaseZap,
  GitBranch,
  History,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
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
import { IconButton, TypeIcon } from './components/shared'
import { SchemaView } from './components/schema-view'
import { RecordsView } from './components/records-view'
import { QueryView } from './components/query-view'
import { GenerateView } from './components/generate-view'
import { ConnectionManager } from './components/connection-manager'
import { SavedRequestsView } from './components/saved-requests-view'
import { WorkspaceDashboard } from './components/workspace-dashboard'
import { EntityOverview } from './components/entity-overview'
import { EntityApi } from './components/entity-api'
import { EntityAi } from './components/entity-ai'
import {
  ResourceWorkspace,
  isEntityPage,
} from './components/resource-workspace'
import { SchemaHistoryView } from './components/schema-history-view'
import { WelcomeDialog } from './components/welcome-dialog'
import type { SavedRequest } from './lib/saved-requests'
import {
  ConnectionDialog,
  AuthenticationDialog,
} from './components/connect-dialogs'

const RelationshipView = lazy(() => import('./components/relationship-view'))
const HandoffView = lazy(() =>
  import('./components/handoff-view').then((module) => ({
    default: module.HandoffView,
  })),
)
const navigation = [
  { id: 'entity-overview', title: 'Entity overview', icon: Table2 },
  { id: 'api', title: 'Entity API', icon: Terminal },
  { id: 'overview', title: 'Dashboard', icon: LayoutDashboard },
  { id: 'schema', title: 'Schema explorer', icon: Table2 },
  { id: 'history', title: 'Schema history', icon: History },
  { id: 'records', title: 'Data browser', icon: Database },
  { id: 'relationships', title: 'Relationships', icon: GitBranch },
  { id: 'query', title: 'Query builder', icon: Terminal },
  { id: 'requests', title: 'Saved requests', icon: ClipboardCheck },
  { id: 'developer', title: 'Developer tools', icon: Code2 },
  { id: 'handoff', title: 'Handoff package', icon: Package },
  { id: 'ai', title: 'AI tools', icon: Sparkles },
] as const
const navLabels: Record<Page, string> = {
  overview: 'Dashboard',
  schema: 'Schema',
  history: 'History',
  records: 'Records',
  relationships: 'Relationships',
  query: 'Queries',
  requests: 'Saved checks',
  developer: 'Developer',
  handoff: 'Handoff',
  ai: 'AI tools',
  'entity-overview': 'Entity overview',
  api: 'API',
}
const descriptions: Record<Page, string> = {
  'entity-overview': 'Understand this entity.',
  api: 'Read access and integration expectations.',
  overview: 'Your database, schema, and integration tools in one workspace.',
  schema: 'Understand your structure. Find exactly what you need.',
  records: 'Your records, without the guesswork.',
  relationships: 'Follow the connections across your solution.',
  query: 'From a question to an API request.',
  developer: 'Your schema, translated into your stack.',
  ai: 'Make your solution understandable to agents.',
  requests: 'Reusable requests. Clear expectations. Repeatable checks.',
  history: 'Dated schemas. Visible changes. Integration impact.',
  handoff: 'Your schema, knowledge, and read integration. Ready to hand over.',
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
  const headerRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(154)
  const w = useWorkspace(),
    { profile, entities, relationships, snapshot, session } = w
  const [page, setPage] = useState<Page>('overview'),
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
    [welcomeOpen, setWelcomeOpen] = useState(false),
    [fieldFocus, setFieldFocus] = useState<string>(),
    [editingRequest, setEditingRequest] = useState<SavedRequest | undefined>()
  const entity = entities.find((e) => e.name === entityName) ?? entities[0],
    current = navigation.find((n) => n.id === page)!
  function navigate(next: Page) {
    setRequestFilter('')
    setPage(next)
    setSidebarOpen(false)
  }
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [page, w.ready])
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const observer = new ResizeObserver(() =>
      setHeaderHeight(header.getBoundingClientRect().height),
    )
    observer.observe(header)
    return () => observer.disconnect()
  }, [w.ready, w.startupError])
  useEffect(() => {
    if (w.ready && !w.startupError && !w.welcomeHidden) setWelcomeOpen(true)
  }, [w.ready, w.startupError, w.welcomeHidden])
  function selectEntity(
    name: string,
    next: Page = isEntityPage(page) ? page : 'entity-overview',
  ) {
    setEntityName(name)
    setFieldFocus(undefined)
    navigate(next === 'overview' ? 'entity-overview' : next)
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
    document.title = `${entity && isEntityPage(page) ? `${entity.name} · ` : ''}${current.title} · FM API Explorer`
    window.scrollTo(0, 0)
  }, [current.title, profile.id, entityName, page])
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
  const fieldCount = entities.reduce((n, e) => n + e.fields.length, 0)
  return (
    <div
      className={`app-shell object-shell restored-shell ${w.reducedMotion ? 'reduce-motion' : ''}`}
      style={
        { '--workbench-header-height': `${headerHeight}px` } as CSSProperties
      }
    >
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <header className="workbench-header" ref={headerRef}>
        <div className="workbench-primary-row">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault()
              navigate('overview')
            }}
          >
            <span className="brand-mark">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path
                  d="M13 7 3 20l10 13M27 7l10 13-10 13"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m15 24 10-8"
                  stroke="var(--purple)"
                  strokeWidth="2.5"
                />
                <circle cx="15" cy="24" r="3" fill="var(--foreground)" />
                <circle cx="25" cy="16" r="3" fill="var(--purple)" />
              </svg>
            </span>
            <span>
              <strong>
                FM API Explorer<span className="brand-dot">.</span>
              </strong>
              <small>API WORKBENCH</small>
            </span>
          </a>
          <button
            className="workbench-search"
            aria-label="Search workspace"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={17} />
            <span>Search entities & fields</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="workbench-connection">
            {' '}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="connection-switch"
                  aria-label={`Connection: ${profile.name}`}
                  title="Choose or manage a database connection"
                >
                  <Database size={17} className="connection-picker-icon" />
                  <span className="connection-label">
                    <small>Connection</small>
                    <strong>{profile.name}</strong>
                  </span>
                  <ChevronDown size={13} />
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
          </div>
          <div className="workbench-utilities">
            <IconButton
              label="Help & shortcuts"
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={18} />
            </IconButton>
            <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={18} />
            </IconButton>
          </div>
        </div>
        <div className="workbench-nav-row">
          <button
            className="resource-drawer-toggle"
            aria-label="Browse entities"
            aria-expanded={sidebarOpen}
            onClick={() => {
              setSidebarOpen(!sidebarOpen)
              if (w.resourceRailCollapsed)
                void w.setResourceRailCollapsed(false)
            }}
          >
            <Menu size={18} />
            Resources
          </button>
          <nav
            className="workspace-tabs"
            aria-label="Workspace navigation"
            ref={navRef}
          >
            {navigation
              .filter(
                (item) => item.id !== 'entity-overview' && item.id !== 'api',
              )
              .map((item) => (
                <button
                  key={item.id}
                  className={
                    page === item.id ||
                    (item.id === 'schema' &&
                      (page === 'entity-overview' || page === 'api'))
                      ? 'active'
                      : ''
                  }
                  aria-current={
                    page === item.id ||
                    (item.id === 'schema' &&
                      (page === 'entity-overview' || page === 'api'))
                      ? 'page'
                      : undefined
                  }
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={17} />
                  <span>{navLabels[item.id]}</span>
                </button>
              ))}
          </nav>
        </div>
      </header>
      <div
        className={`workbench-frame ${w.resourceRailCollapsed ? 'rail-collapsed' : ''}`}
      >
        {sidebarOpen && (
          <button
            className="resource-rail-backdrop"
            aria-label="Dismiss resources"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`resource-rail ${sidebarOpen ? 'is-open' : ''}`}
          aria-label="Resource navigation"
        >
          <div className="resource-rail-title">
            <span>
              <Database size={16} />
              {!w.resourceRailCollapsed && 'Resources'}
            </span>
            <IconButton
              label={
                sidebarOpen
                  ? 'Close resources'
                  : w.resourceRailCollapsed
                    ? 'Expand resources'
                    : 'Collapse resources'
              }
              onClick={() => {
                if (sidebarOpen) setSidebarOpen(false)
                else void w.setResourceRailCollapsed(!w.resourceRailCollapsed)
              }}
            >
              {w.resourceRailCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </IconButton>
          </div>
          {w.resourceRailCollapsed ? (
            <div className="resource-mini-list">
              {resources.map((item) => (
                <button
                  key={item.name}
                  title={item.name}
                  aria-label={`Open ${item.name}`}
                  className={entity?.name === item.name ? 'active' : ''}
                  onClick={() => selectEntity(item.name)}
                >
                  {item.name.slice(0, 2)}
                </button>
              ))}
            </div>
          ) : (
            <div className="resource-rail-scroll">
              {' '}
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
                    {profile.protocol === 'Data API'
                      ? 'LAYOUTS'
                      : 'ENTITY SETS'}
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
          )}
          <div className="resource-rail-footer">
            {w.resourceRailCollapsed ? (
              <a
                href="https://rgcdata.com/"
                target="_blank"
                rel="noopener noreferrer"
                title="Alex Seidler · RGC Data Solutions"
              >
                AS
              </a>
            ) : (
              <>
                <span>
                  {entities.length}{' '}
                  {profile.protocol === 'OData' ? 'entity sets' : 'layouts'} ·{' '}
                  {fieldCount} fields
                </span>
                <a
                  href="https://rgcdata.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Alex Seidler / RGC Data
                  <ArrowUpRight size={13} />
                </a>
              </>
            )}
          </div>
        </aside>
        <div className="workbench-main">
          <main id="main-content" className="main-content" tabIndex={-1}>
            <div
              className={`page-heading ${isEntityPage(page) && entity ? 'entity-page-heading' : ''}`}
            >
              <div>
                <div className="page-overline">
                  <span className="amber-square" />
                  YOUR DEVELOPER WORKBENCH
                </div>
                <h1>
                  {page === 'overview' ? profile.database : current.title}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {page === 'overview'
                    ? `Database overview · ${profile.protocol}`
                    : descriptions[page]}
                </p>
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
            {profile.lab && !isEntityPage(page) && page !== 'overview' && (
              <div className="source-banner">
                <ShieldCheck size={14} />
                <span>
                  {profile.name} · synthetic practice database. No external
                  server is connected.
                </span>
                <button onClick={() => setConnectionOpen(true)}>
                  Add real endpoint
                  <ArrowUpRight size={12} />
                </button>
              </div>
            )}
            {snapshot &&
              !session &&
              !isEntityPage(page) &&
              page !== 'overview' && (
                <div className="offline-banner">
                  <Unplug size={15} />
                  Saved schema from{' '}
                  {new Date(snapshot.inspectedAt).toLocaleString()}. Reconnect
                  for current records.
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
            ) : page === 'handoff' ? (
              <Suspense
                fallback={
                  <p className="subtle-note">Loading handoff workspace…</p>
                }
              >
                <HandoffView key={profile.id} />
              </Suspense>
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
                <Button
                  onClick={() => setAuthProfile(profile)}
                  disabled={w.busy}
                >
                  {profile.lab ? 'Connect local lab' : 'Authenticate & connect'}
                  <ArrowRight size={14} />
                </Button>
                <Button variant="ghost" onClick={() => setConnectionOpen(true)}>
                  Add another connection
                </Button>
              </section>
            ) : (
              <>
                {snapshot.warnings.length > 0 &&
                  !isEntityPage(page) &&
                  page !== 'overview' && (
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
                {page === 'overview' && (
                  <WorkspaceDashboard
                    onNavigate={navigate}
                    onEntity={(name) => selectEntity(name, 'schema')}
                  />
                )}
                {!entity && page !== 'overview' ? (
                  <div className="empty-state">
                    <Database size={27} />
                    <h3>No accessible resources were returned.</h3>
                    <p>Check account privileges and discovery notes.</p>
                  </div>
                ) : (
                  entity && (
                    <ResourceWorkspace
                      page={page}
                      entity={entity}
                      onNavigate={navigate}
                      onConnect={() => setAuthProfile(profile)}
                    >
                      {page === 'entity-overview' && (
                        <EntityOverview
                          key={profile.id + entity.name}
                          entity={entity}
                          onNavigate={navigate}
                          onEntity={(name) =>
                            selectEntity(name, 'entity-overview')
                          }
                        />
                      )}
                      {page === 'api' && (
                        <EntityApi entity={entity} onNavigate={navigate} />
                      )}
                      {page === 'ai' && (
                        <EntityAi
                          key={profile.id + entity.name}
                          entity={entity}
                          onNavigate={navigate}
                        />
                      )}
                      {page === 'schema' && (
                        <SchemaView
                          key={`${profile.id}:${entity.name}:${fieldFocus ?? ''}`}
                          initialField={fieldFocus}
                          entity={entity}
                          protocol={profile.protocol}
                          onRecords={() => navigate('records')}
                          onRelationships={() => navigate('relationships')}
                        />
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
                            key={`${snapshot.id}:${entity.name}`}
                            initialEntity={entity.name}
                            onOpen={(name) => selectEntity(name, 'schema')}
                          />
                        </Suspense>
                      )}
                      {page === 'developer' && (
                        <GenerateView
                          key={`${profile.id}:${page}`}
                          entity={entity}
                          entities={entities}
                          protocol={profile.protocol}
                        />
                      )}
                    </ResourceWorkspace>
                  )
                )}
              </>
            )}
            <footer className="workspace-footer">
              <span>
                <ShieldCheck size={12} />
                Read-only workspace<span className="footer-dot">·</span>
                IndexedDB storage
              </span>
              <span>
                <Activity size={12} />
                {session
                  ? `${session.latencyMs} ms connection check`
                  : snapshot
                    ? 'Saved schema'
                    : 'Ready to connect'}
                <span className="footer-dot">·</span>v0.6.2
              </span>
            </footer>
          </main>
        </div>
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
      <WelcomeDialog
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        onNavigate={navigate}
        onConnections={() => setManagerOpen(true)}
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
          <Button
            variant="outline"
            onClick={() => {
              setHelpOpen(false)
              setWelcomeOpen(true)
            }}
          >
            Welcome & quick start
            <ArrowRight size={15} />
          </Button>
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
