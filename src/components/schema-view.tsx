import { useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  ArrowLeftRight,
  Star,
  Info,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Copy,
  KeyRound,
  Link2,
  Search,
  Sparkles,
  Table2,
} from 'lucide-react'
import type { Entity, Field, Protocol } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { generate } from '@/lib/generators'
import { Button } from './ui/button'
import { CompareDialog } from './compare-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { CodeBlock, EmptyState, IconButton, TypeIcon, copyText } from './shared'

export function SchemaView({
  entity,
  protocol,
  onRecords,
  onGenerate,
  onRelationships,
  initialField,
  isFavorite,
  onFavorite,
}: {
  entity: Entity
  protocol: Protocol
  onRecords: () => void
  onGenerate: () => void
  onRelationships: () => void
  initialField?: string
  isFavorite: boolean
  onFavorite: () => void
}) {
  const { relationships, profile, snapshot } = useWorkspace()
  const [search, setSearch] = useState('')
  const [compareOpen, setCompareOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedName, setSelectedName] = useState(
    initialField ?? entity.fields[0]?.name ?? '',
  )
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null)
  const selected =
    entity.fields.find((f) => f.name === selectedName) ?? entity.fields[0]
  const fields = entity.fields.filter((f) =>
    `${f.name} ${f.type}`.toLowerCase().includes(search.toLowerCase()),
  )
  if (sort)
    fields.sort((a, b) =>
      sort === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name),
    )
  const links = relationships.filter(
    (r) => r.source === entity.name || r.target === entity.name,
  )
  const endpoint = entity.endpoint ?? 'Endpoint unavailable'
  if (!selected)
    return (
      <EmptyState
        title="Metadata unavailable"
        description={
          entity.warning ?? 'No fields were exposed for this resource.'
        }
      />
    )
  return (
    <>
      <div className="entity-heading">
        <div className="entity-icon">
          <Table2 size={22} />
        </div>
        <div>
          <div className="entity-name">
            <h2>{entity.name}</h2>
            <span className="tag neutral">
              {protocol === 'Data API' ? 'Layout' : 'Entity set'}
            </span>
          </div>
          <p>{entity.description}</p>
        </div>
        <div className="entity-actions">
          <IconButton
            label={isFavorite ? 'Remove from favorites' : 'Favorite resource'}
            onClick={onFavorite}
          >
            <Star
              size={15}
              className={isFavorite ? 'amber fill-current' : ''}
            />
          </IconButton>
          <IconButton
            label="Resource details"
            onClick={() => setDetailsOpen(true)}
          >
            <Info size={15} />
          </IconButton>
          <Button variant="outline" onClick={() => setCompareOpen(true)}>
            <ArrowLeftRight size={14} />
            Compare
          </Button>
          <Button variant="outline" onClick={onRecords}>
            Browse records <ArrowUpRight size={14} />
          </Button>
        </div>
      </div>
      <div className="entity-tabs">
        <button className="active">
          <Table2 size={14} />
          Fields <span>{entity.fields.length}</span>
        </button>
        <button onClick={onRecords}>
          <Braces size={14} />
          Records <span>{entity.count ?? '—'}</span>
        </button>
        <button onClick={onRelationships}>
          <Link2 size={14} />
          Relationships <span>{links.length}</span>
        </button>
      </div>
      <CompareDialog
        entity={entity}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entity.name}</DialogTitle>
            <DialogDescription>{entity.description}</DialogDescription>
          </DialogHeader>
          <div className="detail-list">
            <div>
              <span>Resource kind</span>
              <strong>
                {protocol === 'Data API' ? 'Layout' : 'Entity set'}
              </strong>
            </div>
            <div>
              <span>Fields</span>
              <strong>{entity.fields.length}</strong>
            </div>
            <div>
              <span>Reported total records</span>
              <strong>{entity.count ?? '—'}</strong>
            </div>
            <div>
              <span>Metadata source</span>
              <strong>{entity.source ?? snapshot?.source ?? 'Unknown'}</strong>
            </div>
            <div>
              <span>Last modified</span>
              <strong>Not available</strong>
            </div>
          </div>
          <CodeBlock code={`GET ${endpoint}`} filename="endpoint.http" />
          <p className="subtle-note">
            This endpoint comes from the active connection. Metadata has been
            inspected; unknown attributes remain unavailable.
          </p>
        </DialogContent>
      </Dialog>
      <div className="schema-layout">
        <section className="panel fields-panel" aria-label="Schema fields">
          <div className="panel-toolbar">
            <div className="search-input">
              <Search size={14} />
              <Input
                aria-label="Search fields"
                placeholder="Search fields…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>/</kbd>
            </div>
            <span className="muted text-xs">{fields.length} fields</span>
          </div>
          <div className="table-scroll">
            <table className="fields-table">
              <thead>
                <tr>
                  <th className="index-col">#</th>
                  <th>
                    <button
                      onClick={() => setSort(sort === 'asc' ? 'desc' : 'asc')}
                    >
                      Field name{' '}
                      <ArrowDown
                        size={12}
                        className={sort === 'asc' ? 'rotate-180' : ''}
                      />
                    </button>
                  </th>
                  <th>Type</th>
                  <th>Attributes</th>
                  <th aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr
                    key={f.name}
                    className={selected.name === f.name ? 'selected' : ''}
                    onClick={() => setSelectedName(f.name)}
                  >
                    <td className="row-index">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td>
                      <button
                        className="field-name"
                        onClick={() => setSelectedName(f.name)}
                      >
                        <TypeIcon type={f.type} />
                        {f.name}
                        {f.key && <KeyRound size={12} className="amber" />}
                        {f.reference && <Link2 size={12} className="purple" />}
                      </button>
                    </td>
                    <td>
                      <span className={`type-tag type-${f.type}`}>
                        {f.type}
                      </span>
                    </td>
                    <td>
                      <div className="attributes">
                        {f.key ? (
                          <span className="attribute key">Primary key</span>
                        ) : f.reference ? (
                          <span className="attribute reference">
                            Foreign key
                          </span>
                        ) : f.required ? (
                          <span className="attribute">Required</span>
                        ) : (
                          <span className="attribute optional">Optional</span>
                        )}
                        {f.auto && <span className="auto-tag">Auto</span>}
                      </div>
                    </td>
                    <td>
                      <ChevronRight
                        size={13}
                        className={selected.name === f.name ? 'amber' : 'faint'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!fields.length && (
            <EmptyState
              title="No matching fields"
              description="Try a different field name or type."
            />
          )}
          <div className="panel-foot">
            <span>
              <span className="tiny-dot" />
              Inspected metadata
            </span>
            <span>
              {entity.name} · {entity.fields.length} fields
            </span>
          </div>
        </section>
        <FieldInspector
          field={selected}
          entity={entity}
          onRelationships={onRelationships}
        />
      </div>
      <section className="code-section">
        <div className="section-intro">
          <div>
            <span className="eyebrow">
              <Code2 size={14} /> BUILT FOR YOUR NEXT BUILD
            </span>
            <h3>Your schema. Ready for code.</h3>
            <p>
              Turn this layout into typed interfaces, API specs, and agent
              context.
            </p>
          </div>
          <Button variant="outline" onClick={onGenerate}>
            Open developer tools <ArrowUpRight size={14} />
          </Button>
        </div>
        <CodeBlock
          code={generate(entity, 'typescript', protocol, { profile, snapshot })}
          filename={`${entity.name.toLowerCase()}.ts`}
        />
      </section>
    </>
  )
}

function FieldInspector({
  field: f,
  entity,
  onRelationships,
}: {
  field: Field
  entity: Entity
  onRelationships: () => void
}) {
  return (
    <aside className="panel inspector">
      <div className="inspector-top">
        <span>FIELD DETAILS</span>
        <IconButton label="Copy field name" onClick={() => copyText(f.name)}>
          <Copy size={13} />
        </IconButton>
      </div>
      <div className="inspector-title">
        <div className="field-type-box">
          <TypeIcon type={f.type} />
        </div>
        <h3>{f.name}</h3>
        <span className={`type-tag type-${f.type}`}>{f.type}</span>
      </div>
      <p className="field-description">{f.description}</p>
      <div className="detail-list">
        <div>
          <span>Source</span>
          <strong>
            <Table2 size={12} />
            {entity.name}
          </strong>
        </div>
        <div>
          <span>Native type</span>
          <strong>{f.nativeType ?? f.type}</strong>
        </div>
        <div>
          <span>Required</span>
          <strong>
            {f.required ? (
              <>
                <Check size={12} className="green" />
                Yes
              </>
            ) : f.required === undefined ? (
              'Unknown'
            ) : (
              'No'
            )}
          </strong>
        </div>
        <div>
          <span>Nullable</span>
          <strong>
            {f.nullable === undefined ? 'Unknown' : f.nullable ? 'Yes' : 'No'}
          </strong>
        </div>
        <div>
          <span>Unique</span>
          <strong>
            {f.unique === undefined ? 'Not declared' : f.unique ? 'Yes' : 'No'}
          </strong>
        </div>
        <div>
          <span>Indexed</span>
          <strong>
            {f.indexed === undefined
              ? 'Not available'
              : f.indexed
                ? 'Yes'
                : 'No'}
          </strong>
        </div>
        <div>
          <span>Auto-enter</span>
          <strong>
            {f.auto === undefined ? 'Unknown' : f.auto ? 'Yes' : 'No'}
          </strong>
        </div>
        <div>
          <span>Key</span>
          <strong>
            {f.key ? (
              <>
                <KeyRound size={12} className="amber" />
                Primary
              </>
            ) : f.reference ? (
              'Foreign'
            ) : (
              '—'
            )}
          </strong>
        </div>
      </div>
      <div className="sample-value">
        <span className="eyebrow">SAMPLE VALUE</span>
        <code>
          {entity.rows[0] && Object.hasOwn(entity.rows[0], f.name)
            ? JSON.stringify(entity.rows[0][f.name])
            : 'Browse records to load a value'}
        </code>
      </div>
      {(f.key || f.reference) && (
        <div className="related-detail">
          <span className="eyebrow">RELATIONSHIPS</span>
          <button onClick={onRelationships}>
            <Link2 size={14} />
            <span>{f.reference || 'Referenced by related tables'}</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}
      <div className="inspector-note">
        <Sparkles size={14} />
        <span>One schema. Every integration.</span>
      </div>
    </aside>
  )
}
