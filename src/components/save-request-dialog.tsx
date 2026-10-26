import { useState } from 'react'
import { Check, Save, ShieldCheck } from 'lucide-react'
import type { Query } from '@/lib/contracts'
import {
  savedRequestSchema,
  suggestedExpectation,
  type FieldExpectation,
  type SavedRequest,
} from '@/lib/saved-requests'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Choice } from './shared'

export function SaveRequestDialog({
  open,
  onOpenChange,
  query,
  existing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: Query
  existing?: SavedRequest
  onSaved?: (request: SavedRequest) => void
}) {
  const w = useWorkspace(),
    entity = w.entities.find((e) => e.name === query.entity)
  const [name, setName] = useState(existing?.name ?? `${query.entity} read`),
    [description, setDescription] = useState(existing?.description ?? ''),
    [minRows, setMinRows] = useState(
      String(existing?.expectations.minRows ?? 1),
    ),
    [duration, setDuration] = useState(
      existing?.expectations.maxDurationMs?.toString() ?? '',
    ),
    [fields, setFields] = useState<FieldExpectation[]>(
      existing?.expectations.fields ??
        entity?.fields.map(suggestedExpectation) ??
        [],
    ),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  const available = [
    ...new Set([
      ...(entity?.fields.map((f) => f.name) ?? []),
      ...fields.map((f) => f.name),
    ]),
  ]
  function toggle(name: string) {
    setFields((current) =>
      current.some((f) => f.name === name)
        ? current.filter((f) => f.name !== name)
        : [
            ...current,
            suggestedExpectation(entity!.fields.find((f) => f.name === name)!),
          ],
    )
  }
  function change(name: string, patch: Partial<FieldExpectation>) {
    setFields((current) =>
      current.map((f) => (f.name === name ? { ...f, ...patch } : f)),
    )
  }
  async function save() {
    setError('')
    const now = new Date().toISOString()
    const parsed = savedRequestSchema.safeParse({
      id: existing?.id ?? crypto.randomUUID(),
      profileId: w.profile.id,
      name,
      description,
      protocol: w.profile.protocol,
      query: { ...query, offset: 0 },
      expectations: {
        minRows: Number(minRows),
        ...(duration.trim() ? { maxDurationMs: Number(duration) } : {}),
        fields,
      },
      revision: (existing?.revision ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? 'Check the expectation settings.',
      )
      return
    }
    setSaving(true)
    try {
      const result = await w.saveRequest(parsed.data)
      onSaved?.(result)
      onOpenChange(false)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save this request.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !saving && onOpenChange(value)}
    >
      <DialogContent className="save-request-dialog">
        <DialogHeader>
          <DialogTitle>
            <Save size={19} />
            {existing ? 'Update request & checks' : 'Save request & checks'}
          </DialogTitle>
          <DialogDescription>
            {query.entity} · {w.profile.protocol} · first page, up to{' '}
            {query.limit} rows. Checks apply to returned records only.
          </DialogDescription>
        </DialogHeader>
        <div className="connection-form">
          <label htmlFor="saved-request-name">
            Request name
            <Input
              id="saved-request-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer portal read"
            />
          </label>
          <label htmlFor="saved-request-description">
            Purpose / notes
            <Textarea
              id="saved-request-description"
              value={description}
              maxLength={1500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this integration need this request to do?"
            />
          </label>
          <div className="expectation-numbers">
            <label htmlFor="minimum-rows">
              Minimum returned rows
              <Input
                id="minimum-rows"
                type="number"
                min={0}
                max={query.limit}
                step={1}
                value={minRows}
                onChange={(e) => setMinRows(e.target.value)}
              />
            </label>
            <label htmlFor="maximum-duration">
              Maximum response time (ms)
              <Input
                id="maximum-duration"
                type="number"
                min={1}
                max={120000}
                step={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="expectation-heading">
            <div>
              <strong>Expected fields</strong>
              <p>Selected fields must appear in every returned row.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFields(
                  fields.length
                    ? []
                    : (entity?.fields.map(suggestedExpectation) ?? []),
                )
              }
            >
              {fields.length ? 'Clear selection' : 'Select all'}
            </Button>
          </div>
          <div className="expectation-fields">
            {available.map((name) => {
              const rule = fields.find((f) => f.name === name),
                known = entity?.fields.some((f) => f.name === name)
              return (
                <div
                  key={name}
                  className={`expectation-field ${rule ? 'selected' : ''}`}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={!!rule}
                      onChange={() => toggle(name)}
                    />
                    <span>
                      {name}
                      {!known && <small>Not in latest schema</small>}
                    </span>
                  </label>
                  {rule && (
                    <>
                      <Choice
                        label={`Expected type for ${name}`}
                        value={rule.type}
                        onChange={(value) =>
                          change(name, {
                            type: value as FieldExpectation['type'],
                          })
                        }
                        items={[
                          { value: 'any', label: 'Any value type' },
                          { value: 'string', label: 'String' },
                          {
                            value: 'numeric',
                            label: 'Number / numeric string',
                          },
                          { value: 'number', label: 'Number only' },
                          { value: 'boolean', label: 'Boolean' },
                          { value: 'array', label: 'Array' },
                          { value: 'object', label: 'Object' },
                        ]}
                      />
                      <label className="null-rule">
                        <input
                          type="checkbox"
                          checked={rule.allowNull}
                          onChange={(e) =>
                            change(name, { allowNull: e.target.checked })
                          }
                        />
                        Allow null
                      </label>
                    </>
                  )}
                </div>
              )
            })}
            {!available.length && (
              <p className="subtle-note">
                No schema fields available. You can still check returned rows
                and response time.
              </p>
            )}
          </div>
          <div className="info-banner">
            <ShieldCheck size={16} />
            <p>
              The query, including filter values, is saved in IndexedDB. Results
              save only check summaries; returned records and authentication are
              excluded. Exports redact filter values by default.
            </p>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !name.trim()}
            >
              <Check size={14} />
              {saving
                ? 'Saving…'
                : existing
                  ? 'Update saved request'
                  : 'Save request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
