import type { Entity, Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { compileRequest } from '@/lib/queries'
import { CodeBlock } from './shared'
import { Button } from './ui/button'
export function EntityApi({
  entity,
  onNavigate,
}: {
  entity: Entity
  onNavigate: (page: Page) => void
}) {
  const w = useWorkspace(),
    spec = compileRequest(w.profile, entity, {
      entity: entity.name,
      conditions: [],
      match: 'all',
      offset: 0,
      limit: 10,
    })
  return (
    <div className="entity-api-reading">
      <h2>Read {entity.name}</h2>
      <p>
        A bounded read through {w.profile.protocol}. Use credentials supplied
        locally by your integration.
      </p>
      <CodeBlock code={`${spec.method} ${spec.path}`} filename="read.http" />
      <div className="entity-api-actions">
        <Button onClick={() => onNavigate('query')}>Build a read query</Button>
        <Button variant="ghost" onClick={() => onNavigate('developer')}>
          TypeScript & API schemas
        </Button>
        <Button variant="ghost" onClick={() => onNavigate('records')}>
          Inspect records
        </Button>
      </div>
      <p className="subtle-note">
        This is a request template, not a live result. Counts and metadata
        reflect the inspected account's access.
      </p>
    </div>
  )
}
