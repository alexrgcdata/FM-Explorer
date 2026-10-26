import { useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  KeyRound,
  Link2,
  Search,
  Table2,
} from 'lucide-react'
import type { Entity, Field, Protocol } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
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
  onRelationships,
  initialField,
}: {
  entity: Entity
  protocol: Protocol
  onRecords: () => void
  onRelationships: () => void
  initialField?: string
}) {
  const { snapshot } = useWorkspace()
  const [search, setSearch] = useState('')
  const [fieldDetailsOpen, setFieldDetailsOpen] = useState(!!initialField)
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
      <div className="entity-subview-toolbar">
        <span>Field definitions</span>
        <div>
          <Button variant="ghost" onClick={onRecords}>
            Browse records
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Schema actions">
                <MoreHorizontal size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCompareOpen(true)}>
                Compare tables
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>
                Resource metadata
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
                    onClick={() => {
                      setSelectedName(f.name)
                      setFieldDetailsOpen(true)
                    }}
                  >
                    <td className="row-index">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td>
                      <button
                        className="field-name"
                        onClick={() => {
                          setSelectedName(f.name)
                          setFieldDetailsOpen(true)
                        }}
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
                        ) : f.required || f.nullable === false ? (
                          <span className="attribute">Required</span>
                        ) : (
                          <span className="attribute optional">
                            {f.required === false || f.nullable === true
                              ? 'Optional'
                              : 'Unknown'}
                          </span>
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
      </div>
      <Dialog open={fieldDetailsOpen} onOpenChange={setFieldDetailsOpen}>
        <DialogContent className="field-info-dialog">
          <DialogHeader>
            <DialogTitle>{selected.name}</DialogTitle>
            <DialogDescription>{entity.name} / Field details</DialogDescription>
          </DialogHeader>
          <FieldInspector
            field={selected}
            entity={entity}
            onRelationships={() => {
              setFieldDetailsOpen(false)
              onRelationships()
            }}
          />
        </DialogContent>
      </Dialog>
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
    </aside>
  )
}
