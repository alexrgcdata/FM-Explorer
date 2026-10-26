import { useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import type { Entity, Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import { KnowledgeDialog } from './knowledge-dialog'

export function EntityOverview({
  entity,
  onNavigate,
  onEntity,
}: {
  entity: Entity
  onNavigate: (page: Page) => void
  onEntity: (name: string) => void
}) {
  const w = useWorkspace(),
    [noteOpen, setNoteOpen] = useState(false)
  const keys = entity.fields.filter((f) => f.key),
    links = w.relationships.filter(
      (r) => r.source === entity.name || r.target === entity.name,
    )
  const related = [
    ...new Set(
      links.map((r) => (r.source === entity.name ? r.target : r.source)),
    ),
  ]
  const notes = w.knowledgeNotes.filter((n) => n.entity === entity.name),
    checks = w.savedRequests.filter((r) => r.query.entity === entity.name)
  return (
    <div className="entity-overview-reading">
      <section className="entity-reading-section">
        <h2>What we know</h2>
        <dl className="entity-known-facts">
          <div>
            <dt>Identity</dt>
            <dd>
              {keys.length
                ? keys.map((f) => f.name).join(', ')
                : 'No key declared in the available metadata'}
            </dd>
          </div>
          <div>
            <dt>Record count</dt>
            <dd>
              {typeof entity.count === 'number'
                ? `${entity.count.toLocaleString()} reported by the API`
                : 'Not yet reported'}
              <button
                className="quiet-link"
                onClick={() => onNavigate('records')}
              >
                Browse records <ArrowRight size={13} />
              </button>
            </dd>
          </div>
          <div>
            <dt>Business context</dt>
            <dd>
              {notes.some((n) => n.status === 'confirmed')
                ? `${notes.filter((n) => n.status === 'confirmed').length} human-confirmed ${notes.filter((n) => n.status === 'confirmed').length === 1 ? 'note' : 'notes'}`
                : 'Not yet confirmed by a developer'}
            </dd>
          </div>
        </dl>
      </section>
      <section className="entity-reading-section">
        <h2>Connected entities</h2>
        {related.length ? (
          <div className="entity-related-list">
            {related.map((name) => (
              <button key={name} onClick={() => onEntity(name)}>
                <strong>{name}</strong>
                <span>
                  {links
                    .filter((r) => r.source === name || r.target === name)
                    .map((r) => r.field)
                    .filter((field) => field && field !== name)
                    .join(', ') || 'Exposed navigation'}
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <p className="entity-empty-meaning">
            No connections were exposed by this inspection.
          </p>
        )}
      </section>
      <section className="entity-reading-section">
        <h2>Integration expectations</h2>
        {checks.length ? (
          checks.map((check) => {
            const latest = w.checkRuns.find(
              (r) =>
                r.requestId === check.id &&
                r.requestRevision === check.revision,
            )
            return (
              <button
                className="entity-check-row"
                key={check.id}
                onClick={() => onNavigate('requests')}
              >
                <div>
                  <strong>{check.name}</strong>
                  <span>
                    {check.expectations.fields.length} expected fields ·
                    revision {check.revision}
                  </span>
                </div>
                <span className={`entity-check-state ${latest?.status ?? ''}`}>
                  {latest
                    ? latest.status === 'pass'
                      ? 'Passed last run'
                      : latest.status === 'fail'
                        ? 'Needs review'
                        : latest.status
                    : 'Not run'}
                  <ArrowRight size={14} />
                </span>
              </button>
            )
          })
        ) : (
          <p className="entity-empty-meaning">
            No saved check documents what an integration expects from this
            entity.{' '}
            <button className="quiet-link" onClick={() => onNavigate('query')}>
              Create a read check <ArrowRight size={13} />
            </button>
          </p>
        )}
      </section>
      <section className="entity-reading-section">
        <div className="entity-section-heading">
          <h2>Developer knowledge</h2>
          <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
            <Plus size={14} />
            Add note
          </Button>
        </div>
        {notes.length ? (
          notes.map((note) => (
            <article key={note.id} className="entity-knowledge-entry">
              <div>
                <strong>{note.field ?? entity.name}</strong>
                <span>
                  {note.status === 'confirmed'
                    ? 'Human-confirmed'
                    : 'Draft · unverified'}{' '}
                  / {note.kind.replaceAll('-', ' ')}
                </span>
              </div>
              <p>{note.text}</p>
            </article>
          ))
        ) : (
          <p className="entity-empty-meaning">
            Field meanings, status values, and workflow rules are not explained
            by schema alone. Add the context the next developer needs.
          </p>
        )}
      </section>
      {noteOpen && (
        <KnowledgeDialog
          initialEntity={entity.name}
          onClose={() => setNoteOpen(false)}
        />
      )}
    </div>
  )
}
