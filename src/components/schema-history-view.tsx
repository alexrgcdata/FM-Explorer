import { useState } from 'react'
import {
  ArrowRight,
  Download,
  FlaskConical,
  History,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/workspace'
import {
  affectedRequests,
  compareSchemaVersions,
  labChangeExample,
  type SchemaVersion,
} from '@/lib/schema-history'
import { downloadFile } from '@/lib/generators'
import type { SavedRequest } from '@/lib/saved-requests'
import { Button } from './ui/button'
import { Choice, EmptyState } from './shared'

const labels = {
  added: 'Newly exposed',
  missing: 'No longer exposed',
  changed: 'Changed',
  unknown: 'Unknown / partial',
}
export function SchemaHistoryView({
  onOpenRequest,
}: {
  onOpenRequest: (request: SavedRequest) => void
}) {
  const w = useWorkspace(),
    versions = w.schemaVersions
  const [beforeId, setBeforeId] = useState(''),
    [afterId, setAfterId] = useState(''),
    [example, setExample] = useState<[SchemaVersion, SchemaVersion] | null>(
      null,
    ),
    [search, setSearch] = useState('')
  const before =
      example?.[0] ?? versions.find((v) => v.id === beforeId) ?? versions[1],
    after =
      example?.[1] ?? versions.find((v) => v.id === afterId) ?? versions[0]
  const comparison =
    before && after ? compareSchemaVersions(before, after) : null
  const impacts = comparison?.comparable
    ? affectedRequests(comparison.changes, w.savedRequests)
    : []
  const changes =
    comparison?.changes.filter((c) =>
      `${c.entity} ${c.field ?? ''} ${c.property} ${labels[c.kind]}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? []
  const items = versions.map((v, i) => ({
    value: v.id,
    label: `${new Date(v.inspectedAt).toLocaleString()} · ${i === 0 ? 'latest · ' : ''}${v.complete ? 'complete' : 'partial'} · ${v.id.slice(0, 6)}`,
  }))
  async function capture() {
    try {
      await w.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not capture schema.',
      )
    }
  }
  return (
    <>
      <div className="view-intro">
        <div>
          <h2>Know what changed.</h2>
          <p>
            Compare dated inspections. Find the requests worth checking again.
          </p>
        </div>
        <div className="saved-actions">
          {w.profile.lab && versions[0] && (
            <Button
              variant="outline"
              onClick={() => {
                setExample(labChangeExample(versions[0]))
                setSearch('')
              }}
            >
              <FlaskConical size={14} />
              Preview change example
            </Button>
          )}
          <Button
            onClick={() => void capture()}
            disabled={!w.session || w.busy}
          >
            <RefreshCw size={14} className={w.busy ? 'animate-spin' : ''} />
            {w.busy ? 'Inspecting…' : 'Capture current schema'}
          </Button>
        </div>
      </div>
      <div className="source-banner">
        <ShieldCheck size={15} />
        <span>
          Each connection or refresh saves a dated schema version. Up to 50
          versions per connection. No records, credentials, or restore
          capability.
        </span>
      </div>
      {example && (
        <div className="offline-banner" role="status">
          <FlaskConical size={15} />
          <span>
            Illustrative lab comparison: Email is no longer exposed, FullName
            becomes numeric, and AccountTier appears. Your database and saved
            history are unchanged.
          </span>
          <Button size="sm" variant="outline" onClick={() => setExample(null)}>
            Back to saved versions
          </Button>
        </div>
      )}
      {!versions.length ? (
        <div className="panel">
          <EmptyState
            title="Start your schema history"
            description="Connect to inspect a schema. Each later connection or refresh preserves another dated version."
          />
        </div>
      ) : (
        <>
          <div className="panel history-selector">
            <label>
              Earlier version
              <Choice
                label="Earlier schema version"
                value={before?.id ?? ''}
                onChange={(value) => {
                  setBeforeId(value)
                  setExample(null)
                }}
                items={
                  example
                    ? [{ value: example[0].id, label: 'Illustrative baseline' }]
                    : items
                }
              />
            </label>
            <ArrowRight size={17} />
            <label>
              Later version
              <Choice
                label="Later schema version"
                value={after?.id ?? ''}
                onChange={(value) => {
                  setAfterId(value)
                  setExample(null)
                }}
                items={
                  example
                    ? [
                        {
                          value: example[1].id,
                          label: 'Illustrative changed schema',
                        },
                      ]
                    : items
                }
              />
            </label>
          </div>
          <div className="version-metadata">
            {[before, after].map((v, i) => (
              <div className="panel" key={i}>
                <span className="eyebrow">
                  {i ? 'LATER INSPECTION' : 'EARLIER INSPECTION'}
                </span>
                {v ? (
                  <>
                    <strong>{new Date(v.inspectedAt).toLocaleString()}</strong>
                    <p>
                      {v.database} · {v.protocol} · {v.entities.length}{' '}
                      resources ·{' '}
                      {v.complete ? 'Discovery complete' : 'Partial discovery'}
                    </p>
                    <p>
                      {v.target ?? 'Target not saved in older version'} ·{' '}
                      {v.source}
                    </p>
                    <small>{v.accessScope}</small>
                    {v.warnings.length > 0 && (
                      <details>
                        <summary>{v.warnings.length} discovery notes</summary>
                        {v.warnings.map((note, j) => (
                          <p key={j}>{note}</p>
                        ))}
                      </details>
                    )}
                  </>
                ) : (
                  <p>Capture another schema to compare two inspections.</p>
                )}
              </div>
            ))}
          </div>
          {!comparison ? (
            <div className="panel">
              <EmptyState
                title="Your first baseline is saved"
                description="Capture current schema again for a real comparison, or preview the controlled lab example."
              />
            </div>
          ) : !comparison.comparable ? (
            <div className="error-banner" role="alert">
              {comparison.reason}
            </div>
          ) : (
            <>
              <div className="checks-summary">
                {(['added', 'missing', 'changed', 'unknown'] as const).map(
                  (kind) => (
                    <div key={kind}>
                      <strong className={kind === 'unknown' ? 'amber' : ''}>
                        {
                          comparison.changes.filter((c) => c.kind === kind)
                            .length
                        }
                      </strong>
                      <span>{labels[kind]}</span>
                    </div>
                  ),
                )}
              </div>
              <div className="panel">
                <div className="panel-toolbar">
                  <div>
                    <h3>Schema comparison</h3>
                    <p className="subtle-note">
                      {before?.id === after?.id
                        ? 'Same version selected.'
                        : `${comparison.changes.length} observed metadata differences.`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadFile(
                        `${w.profile.database}-schema-comparison.json`,
                        JSON.stringify(
                          {
                            format: 'fm-api-explorer.schema-comparison',
                            version: 1,
                            example: !!example,
                            exportedAt: new Date().toISOString(),
                            before,
                            after,
                            comparison,
                            affectedRequests: impacts.map(
                              ({ request, reasons }) => ({
                                id: request.id,
                                name: request.name,
                                revision: request.revision,
                                reasons: reasons.map((r) => r.id),
                              }),
                            ),
                          },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    <Download size={13} />
                    Export comparison
                  </Button>
                </div>
                <div className="history-search">
                  <input
                    aria-label="Search schema changes"
                    placeholder="Search resources, fields, or changes…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {changes.length ? (
                  <div
                    className="schema-diff-table"
                    role="region"
                    aria-label="Schema comparison columns, scroll horizontally"
                    tabIndex={0}
                  >
                    <p className="diff-scroll-hint">
                      Scroll horizontally to see all comparison columns.
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Change</th>
                          <th>Resource / field</th>
                          <th>Property</th>
                          <th>Earlier</th>
                          <th>Later</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <span
                                className={`check-status ${c.kind === 'missing' ? 'fail' : c.kind === 'added' ? 'pass' : c.kind === 'unknown' ? 'inconclusive' : 'pending'}`}
                              >
                                {labels[c.kind]}
                              </span>
                            </td>
                            <td>
                              <strong>
                                {c.entity}
                                {c.field ? `.${c.field}` : ''}
                              </strong>
                              <small>{c.message}</small>
                            </td>
                            <td>{c.property}</td>
                            <td>{c.before}</td>
                            <td>{c.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={
                      search
                        ? 'No matching changes'
                        : 'No observed structural differences'
                    }
                    description={
                      search
                        ? 'Try another field or resource name.'
                        : 'Counts, loaded records, descriptions, and inspection timestamps are excluded from the structural comparison.'
                    }
                  />
                )}
              </div>
              <div className="panel affected-requests">
                <div className="panel-toolbar">
                  <div>
                    <h3>Requests to review</h3>
                    <p className="subtle-note">
                      Potential impact based on query fields, sorting,
                      expectations, and exposed navigation. Checks are not run
                      automatically.
                    </p>
                  </div>
                  <span className="check-status">
                    {impacts.length} affected
                  </span>
                </div>
                {impacts.length ? (
                  impacts.map(({ request, reasons }) => (
                    <div className="affected-request" key={request.id}>
                      <History size={16} />
                      <div>
                        <strong>{request.name}</strong>
                        <p>
                          {[
                            ...new Set(
                              reasons.map(
                                (r) => `${r.field ?? r.entity}: ${r.property}`,
                              ),
                            ),
                          ].join(' · ')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenRequest(request)}
                      >
                        Review saved check
                        <ArrowRight size={12} />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="subtle-note history-empty">
                    No saved requests reference the changed metadata. This does
                    not establish that every integration is unaffected.
                  </p>
                )}
              </div>
              <details className="history-limits">
                <summary>Comparison scope & limitations</summary>
                {comparison.warnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
                <p>
                  Missing resources may reflect permissions, layout exposure, or
                  partial discovery. Renames appear as an addition and a missing
                  name. This comparison does not inspect scripts, calculation
                  dependencies, every relationship, or repair a FileMaker
                  solution.
                </p>
              </details>
            </>
          )}
        </>
      )}
    </>
  )
}
