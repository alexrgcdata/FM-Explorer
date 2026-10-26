import type { ReactNode } from 'react'
import { Braces, GitBranch, Table2 } from 'lucide-react'
import type { Entity, Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Choice } from './shared'

export function ResourceWorkspace({
  page,
  entity,
  onNavigate,
  onEntity,
  children,
}: {
  page: Page
  entity: Entity
  onNavigate: (page: Page) => void
  onEntity: (name: string) => void
  children: ReactNode
}) {
  const w = useWorkspace()
  if (!['schema', 'records', 'relationships'].includes(page))
    return <>{children}</>
  const links = w.relationships.filter(
    (r) => r.source === entity.name || r.target === entity.name,
  ).length
  return (
    <Tabs
      value={page}
      onValueChange={(value) => onNavigate(value as Page)}
      className="resource-workspace"
    >
      <div className="resource-workspace-bar">
        <div className="resource-identity">
          <span>
            {w.profile.protocol === 'OData' ? 'ENTITY SET' : 'LAYOUT'}
          </span>
          <Choice
            label="Selected resource"
            value={entity.name}
            onChange={onEntity}
            items={w.entities.map((e) => ({ value: e.name, label: e.name }))}
          />
        </div>
        <span className="resource-workspace-protocol">
          {w.profile.database} / {w.profile.protocol}
        </span>
      </div>
      <TabsList aria-label="Resource views" className="resource-view-tabs">
        <TabsTrigger value="schema">
          <Table2 size={17} />
          Fields<span>{entity.fields.length}</span>
        </TabsTrigger>
        <TabsTrigger value="records">
          <Braces size={17} />
          Records<span>{entity.count ?? '—'}</span>
        </TabsTrigger>
        <TabsTrigger value="relationships">
          <GitBranch size={17} />
          Relationships<span>{links}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value={page} className="resource-view-content">
        {children}
      </TabsContent>
    </Tabs>
  )
}
