import {
  ArrowRight,
  Code2,
  GitBranch,
  History,
  Table2,
  ClipboardCheck,
  Package,
} from 'lucide-react'
import type { Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'

const shortcuts = [
  {
    page: 'schema',
    title: 'Explore schema',
    detail: 'Inspect fields, types, and records',
    icon: Table2,
  },
  {
    page: 'history',
    title: 'Review changes',
    detail: 'Compare saved schema inspections',
    icon: History,
  },
  {
    page: 'requests',
    title: 'Check integrations',
    detail: 'Run saved read requests and expectations',
    icon: ClipboardCheck,
  },
  {
    page: 'query',
    title: 'Build a query',
    detail: 'Filter records and copy an API request',
    icon: Code2,
  },
  {
    page: 'handoff',
    title: 'Prepare a handoff',
    detail: 'Package schema, examples, and knowledge',
    icon: Package,
  },
] as const

export function WorkspaceDashboard({
  onNavigate,
  onEntity,
}: {
  onNavigate: (page: Page) => void
  onEntity: (name: string) => void
}) {
  const w = useWorkspace()
  const { profile, entities, relationships, snapshot, session } = w
  const counted = entities.filter((e) => typeof e.count === 'number')
  const stats = [
    {
      label:
        profile.protocol === 'Data API' ? 'Accessible layouts' : 'Entity sets',
      value: entities.length,
      detail: profile.protocol,
    },
    {
      label: 'Fields inspected',
      value: entities.reduce((sum, e) => sum + e.fields.length, 0),
      detail: 'Available metadata',
    },
    {
      label: 'Relationships',
      value: relationships.length,
      detail: 'Exposed evidence',
    },
    {
      label: 'Records reported',
      value: counted.length
        ? counted.reduce((sum, e) => sum + (e.count ?? 0), 0).toLocaleString()
        : '—',
      detail: `${counted.length} of ${entities.length} resources counted`,
    },
  ]
  const nodes = entities.slice(0, 6).map((entity, index) => ({
    entity,
    x: index % 2 ? 370 : 110,
    y: 48 + Math.floor(index / 2) * 92,
  }))
  const visibleLinks = relationships.filter(
    (r) =>
      nodes.some((n) => n.entity.name === r.source) &&
      nodes.some((n) => n.entity.name === r.target),
  )
  return (
    <div className="workspace-dashboard">
      <section className="dashboard-context" aria-label="Current database">
        <div>
          <span className="dashboard-kicker">
            CURRENT DATABASE · {profile.protocol}
          </span>
          <h2>{profile.database}</h2>
          <p>
            Explore the API-facing structure, check integration expectations,
            and prepare a documented handoff.
          </p>
        </div>
        <div className="dashboard-connection-facts">
          <span className={session ? 'dashboard-connected' : ''}>
            <i />
            {session
              ? profile.lab
                ? 'Local lab connected'
                : 'Connected'
              : 'Saved inspection'}
          </span>
          <span>
            {snapshot
              ? `Inspected ${new Date(snapshot.inspectedAt).toLocaleString()}`
              : 'Awaiting discovery'}
          </span>
          <span>
            {session
              ? `${session.latencyMs} ms connection check`
              : 'Reconnect for current records'}
          </span>
        </div>
      </section>
      <section
        className="dashboard-stat-strip"
        aria-label="Inspected database totals"
      >
        {stats.map((stat) => (
          <div key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </div>
        ))}
      </section>
      <div className="dashboard-work-grid">
        <section className="dashboard-section dashboard-start">
          <div className="dashboard-section-heading">
            <h2>Start here</h2>
            <span>Your developer workflow</span>
          </div>
          <div className="dashboard-shortcuts">
            {shortcuts.map((item) => (
              <button key={item.page} onClick={() => onNavigate(item.page)}>
                <item.icon size={19} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </section>
        <section className="dashboard-section dashboard-map">
          <div className="dashboard-section-heading">
            <h2>
              <GitBranch size={17} />
              Solution map
            </h2>
            <button
              className="quiet-link"
              onClick={() => onNavigate('relationships')}
            >
              Open graph <ArrowRight size={14} />
            </button>
          </div>
          {nodes.length ? (
            <svg
              viewBox="0 0 480 282"
              role="group"
              aria-label="Preview of exposed relationships"
            >
              {visibleLinks.map((r, i) => {
                const from = nodes.find((n) => n.entity.name === r.source)!
                const to = nodes.find((n) => n.entity.name === r.target)!
                return (
                  <path
                    key={`${r.source}-${r.target}-${i}`}
                    d={`M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`}
                  />
                )
              })}
              {nodes.map((n) => (
                <a
                  key={n.entity.name}
                  href="#"
                  aria-label={`Explore ${n.entity.name}`}
                  onClick={(event) => {
                    event.preventDefault()
                    onEntity(n.entity.name)
                  }}
                >
                  <rect
                    x={n.x - 95}
                    y={n.y - 22}
                    width="190"
                    height="44"
                    rx="6"
                  />
                  <text x={n.x} y={n.y + 5} textAnchor="middle">
                    {n.entity.name.length > 21
                      ? `${n.entity.name.slice(0, 20)}…`
                      : n.entity.name}
                  </text>
                </a>
              ))}
            </svg>
          ) : (
            <p className="subtle-note">
              No accessible resources were returned.
            </p>
          )}
          <p className="dashboard-map-note">
            {visibleLinks.length} exposed connections shown
            {entities.length > 6
              ? ` · ${nodes.length} of ${entities.length} resources`
              : ''}
            . Open the graph for relationship direction and paths.
          </p>
        </section>
      </div>
      <section className="dashboard-section dashboard-resources">
        <div className="dashboard-section-heading">
          <h2>{profile.protocol === 'Data API' ? 'Layouts' : 'Entities'}</h2>
          <span>{entities.length} accessible · select one to inspect</span>
        </div>
        <div className="dashboard-resource-list">
          {entities.map((entity) => (
            <button key={entity.name} onClick={() => onEntity(entity.name)}>
              <Table2 size={18} />
              <span>
                <strong>{entity.name}</strong>
                <small>{entity.description || 'No description supplied'}</small>
              </span>
              <span className="dashboard-resource-count">
                {entity.fields.length} fields
              </span>
              <span className="dashboard-resource-count">
                {typeof entity.count !== 'number'
                  ? 'Count unknown'
                  : `${entity.count.toLocaleString()} records`}
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>
      {snapshot && snapshot.warnings.length > 0 && (
        <details className="discovery-notes">
          <summary>
            {snapshot.complete ? 'Discovery notes' : 'Partial discovery'} ·{' '}
            {snapshot.warnings.length}
          </summary>
          <ul>
            {snapshot.warnings.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="subtle-note">
        This workspace shows what the selected account exposes through the API.
        Schema inspections document structure; they cannot restore a database.
      </p>
    </div>
  )
}
