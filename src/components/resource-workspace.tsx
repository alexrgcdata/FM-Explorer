import { useState, type ReactNode } from 'react'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import type { Entity, Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu'
import { KnowledgeDialog } from './knowledge-dialog'
import { ScreenGuide } from './screen-guide'

export const isEntityPage = (page: Page) =>
  [
    'entity-overview',
    'schema',
    'records',
    'relationships',
    'api',
    'query',
    'developer',
    'ai',
  ].includes(page)
const tabFor = (page: Page) =>
  page === 'records'
    ? 'schema'
    : page === 'query' || page === 'developer'
      ? 'api'
      : page
export function ResourceWorkspace({
  page,
  entity,
  onNavigate,
  onConnect,
  children,
}: {
  page: Page
  entity: Entity
  onNavigate: (page: Page) => void
  onConnect: () => void
  children: ReactNode
}) {
  const w = useWorkspace(),
    [noteOpen, setNoteOpen] = useState(false)
  if (!isEntityPage(page)) return <>{children}</>
  const links = w.relationships.filter(
    (r) => r.source === entity.name || r.target === entity.name,
  ).length
  const requests = w.savedRequests.filter((r) => r.query.entity === entity.name)
  const notes = w.knowledgeNotes.filter((n) => n.entity === entity.name)
  const description = notes.find(
    (n) => n.kind === 'description' && !n.field && n.status === 'confirmed',
  )
  return (
    <div className="entity-document">
      <div className="entity-location">
        <span>{w.profile.database}</span>
        <span>/</span>
        <span>{entity.kind === 'layout' ? 'Layout' : 'Entity set'}</span>
        <span className="entity-source-label">
          {w.profile.lab
            ? `Local lab · synthetic data${w.session ? '' : ' · saved inspection'}`
            : w.session
              ? 'Connected'
              : 'Saved inspection'}
        </span>
      </div>
      <header className="entity-document-header">
        <div>
          <h1>{entity.name}</h1>
          <p className="entity-purpose">
            {description?.text ??
              (entity.description ||
                'Business meaning has not been documented yet.')}
          </p>
          {description && (
            <span className="entity-meaning-source">
              Human-confirmed description
            </span>
          )}
        </div>
        <div className="entity-document-controls">
          {!w.session && (
            <Button variant="outline" onClick={onConnect}>
              Connect
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Entity actions">
                <MoreHorizontal size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                Add knowledge
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void w.toggleFavorite(entity.name)}
              >
                {w.favorites.includes(entity.name)
                  ? 'Remove favorite'
                  : 'Favorite entity'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onNavigate('records')}>
                Browse records
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNavigate('developer')}>
                Export TypeScript & schemas
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNavigate('history')}>
                Compare schema versions
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNavigate('handoff')}>
                Prepare handoff
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="entity-summary-line">
        <span>
          <strong>{entity.fields.length}</strong> fields
        </span>
        <span>
          <strong>{links}</strong> exposed relationships
        </span>
        <button onClick={() => onNavigate('requests')}>
          <strong>{requests.length}</strong> saved{' '}
          {requests.length === 1 ? 'check' : 'checks'}
        </button>
      </div>
      <Tabs
        value={tabFor(page)}
        onValueChange={(value) => onNavigate(value as Page)}
        className="entity-reading-tabs"
      >
        <TabsList aria-label="Entity views" variant="line">
          <TabsTrigger value="entity-overview">Overview</TabsTrigger>
          <TabsTrigger value="schema" onClick={() => onNavigate('schema')}>
            Schema
          </TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="api" onClick={() => onNavigate('api')}>
            API
          </TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value={tabFor(page)} className="entity-reading-content">
          <ScreenGuide
            page={page}
            onNavigate={onNavigate}
            onConnect={onConnect}
          />
          {children}
        </TabsContent>
      </Tabs>
      <details className="entity-provenance">
        <summary>
          Inspection details <ChevronDown size={14} />
        </summary>
        <dl>
          <div>
            <dt>Protocol</dt>
            <dd>{w.profile.protocol}</dd>
          </div>
          <div>
            <dt>Inspected</dt>
            <dd>
              {w.snapshot
                ? new Date(w.snapshot.inspectedAt).toLocaleString()
                : 'Unknown'}
            </dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{entity.source ?? w.snapshot?.source ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>
              {w.snapshot?.complete
                ? 'Completed within account-visible scope'
                : 'Partial discovery'}
            </dd>
          </div>
        </dl>
        {w.snapshot?.warnings.map((warning, i) => (
          <p key={i}>{warning}</p>
        ))}
        <p>
          Only API-visible structure is shown. A missing relationship or
          resource does not establish that it is absent from the FileMaker
          solution.
        </p>
      </details>
      {noteOpen && (
        <KnowledgeDialog
          initialEntity={entity.name}
          onClose={() => setNoteOpen(false)}
        />
      )}
    </div>
  )
}
