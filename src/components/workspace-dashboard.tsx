import { ArrowRight, GitBranch } from 'lucide-react'
import type { Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { publicPreview } from '@/lib/runtime'

const shortcuts = [
  {
    page: 'schema',
    title: 'Explore fields & types',
    detail: 'Start with the structure of a resource.',
  },
  {
    page: 'records',
    title: 'Browse the records',
    detail: 'Connect to see current values and search the data.',
  },
  {
    page: 'relationships',
    title: 'Follow relationships',
    detail: 'See the connections exposed by this API.',
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
            {profile.lab ? 'Synthetic local lab' : 'Connection status'} ·{' '}
            {profile.protocol}
          </span>
        </div>
        <div className="dashboard-connection-facts">
          <span className={session ? 'dashboard-connected' : ''}>
            <i />
            {session
              ? publicPreview
                ? 'Preview ready'
                : profile.lab
                  ? 'Local lab connected'
                  : 'Connected'
              : 'Saved inspection'}
          </span>
          <span>
            {snapshot
              ? `Inspected ${new Date(snapshot.inspectedAt).toLocaleString()}`
              : 'Awaiting discovery'}
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
          <div className="dashboard-guide-heading">
            <span className="dashboard-guide-eyebrow">START HERE</span>
            <h2>Get to know this database</h2>
            <p>Structure first. Then the records and how they connect.</p>
          </div>
          <div className="dashboard-shortcuts">
            {shortcuts.map((item, index) => (
              <button
                key={item.page}
                className={index === 0 ? 'suggested-first-step' : ''}
                onClick={() => onNavigate(item.page)}
              >
                <span className="dashboard-step-number">{index + 1}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <details className="dashboard-sql-guide">
            <summary>Coming from MySQL?</summary>
            <p>
              Fields are columns; records are rows. The FileMaker Data API
              exposes layouts—views onto a solution, rather than a complete
              table inventory. OData exposes entity sets. Start by choosing a
              resource, then inspect its fields.
            </p>
          </details>
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
