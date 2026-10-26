import { useState } from 'react'
import { ArrowLeftRight, Check, Minus } from 'lucide-react'
import type { Entity } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Choice, TypeIcon } from './shared'

export function CompareDialog({
  entity,
  open,
  onOpenChange,
}: {
  entity: Entity
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { entities } = useWorkspace()
  const [otherName, setOtherName] = useState(
    entities.find((e) => e.name !== entity.name)?.name ?? '',
  )
  const other =
    entities.find((e) => e.name === otherName && e.name !== entity.name) ??
    entities.find((e) => e.name !== entity.name) ??
    entity
  const names = [
    ...new Set([
      ...entity.fields.map((f) => f.name),
      ...other.fields.map((f) => f.name),
    ]),
  ]
  const shared = entity.fields.filter((f) =>
    other.fields.some((o) => o.name === f.name),
  ).length
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="compare-dialog">
        <DialogHeader>
          <DialogTitle>
            <ArrowLeftRight size={18} />
            Compare resources
          </DialogTitle>
          <DialogDescription>
            Compare field names and exposed types side by side.
          </DialogDescription>
        </DialogHeader>
        <div className="compare-selectors">
          <span className="compare-source">{entity.name}</span>
          <ArrowLeftRight size={16} className="muted" />
          <Choice
            label="Compare with resource"
            value={other.name}
            onChange={setOtherName}
            items={entities
              .filter((e) => e.name !== entity.name)
              .map((e) => ({ value: e.name, label: e.name }))}
          />
        </div>
        <div className="comparison-summary">
          <span>
            <strong>{shared}</strong> shared fields
          </span>
          <span>
            <strong>{entity.fields.length - shared}</strong> only in{' '}
            {entity.name}
          </span>
          <span>
            <strong>{other.fields.length - shared}</strong> only in {other.name}
          </span>
        </div>
        <div className="table-scroll compare-table">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>{entity.name}</th>
                <th>{other.name}</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {names.map((name) => {
                const left = entity.fields.find((f) => f.name === name),
                  right = other.fields.find((f) => f.name === name)
                return (
                  <tr key={name}>
                    <td className="mono">{name}</td>
                    <td>
                      {left ? (
                        <span className="compare-type">
                          <TypeIcon type={left.type} />
                          {left.type}
                        </span>
                      ) : (
                        <Minus size={12} className="faint" />
                      )}
                    </td>
                    <td>
                      {right ? (
                        <span className="compare-type">
                          <TypeIcon type={right.type} />
                          {right.type}
                        </span>
                      ) : (
                        <Minus size={12} className="faint" />
                      )}
                    </td>
                    <td>
                      {left && right ? (
                        left.type === right.type ? (
                          <Check size={13} className="green" />
                        ) : (
                          <span className="amber">Type differs</span>
                        )
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="subtle-note">
          Names and types come from the inspected metadata. Matching names do
          not establish a relationship.
        </p>
      </DialogContent>
    </Dialog>
  )
}
