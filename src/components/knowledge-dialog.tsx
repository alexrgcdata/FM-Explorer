import { useState } from 'react'
import { Check } from 'lucide-react'
import { knowledgeNoteSchema, type KnowledgeNote } from '@/lib/knowledge'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Choice } from './shared'
const kinds = [
  { value: 'description', label: 'Description' },
  { value: 'status-meaning', label: 'Status meaning' },
  { value: 'workflow', label: 'Workflow note' },
  { value: 'agent-constraint', label: 'Agent constraint' },
]
export function KnowledgeDialog({
  existing,
  initialEntity,
  onClose,
}: {
  existing?: KnowledgeNote
  initialEntity?: string
  onClose: () => void
}) {
  const w = useWorkspace(),
    [entity, setEntity] = useState(
      existing?.entity ?? initialEntity ?? w.entities[0]?.name ?? '',
    ),
    [field, setField] = useState(existing?.field ?? '__resource__'),
    [kind, setKind] = useState<KnowledgeNote['kind']>(
      existing?.kind ?? 'description',
    ),
    [confirmed, setConfirmed] = useState(existing?.status === 'confirmed'),
    [text, setText] = useState(existing?.text ?? ''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  const resource = w.entities.find((e) => e.name === entity)
  async function save() {
    setError('')
    const now = new Date().toISOString(),
      parsed = knowledgeNoteSchema.safeParse({
        id: existing?.id ?? crypto.randomUUID(),
        profileId: w.profile.id,
        entity,
        ...(field === '__resource__' ? {} : { field }),
        kind,
        status: confirmed ? 'confirmed' : 'draft',
        text,
        origin: 'developer-authored',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your note.')
      return
    }
    setSaving(true)
    try {
      await w.saveKnowledgeNote(parsed.data)
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save note.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Edit developer note' : 'Add developer knowledge'}
          </DialogTitle>
          <DialogDescription>
            This text stays in IndexedDB and is included when you export its
            resource. Enter business meaning, not credentials or record samples.
          </DialogDescription>
        </DialogHeader>
        <div className="connection-form">
          <label>
            Resource
            <Choice
              label="Note resource"
              value={entity}
              onChange={(value) => {
                setEntity(value)
                setField('__resource__')
                setConfirmed(false)
              }}
              items={[...new Set([...w.entities.map((e) => e.name), entity])]
                .filter(Boolean)
                .map((name) => ({ value: name, label: name }))}
            />
          </label>
          <label>
            Field
            <Choice
              label="Note field"
              value={field}
              onChange={(value) => {
                setField(value)
                setConfirmed(false)
              }}
              items={[
                { value: '__resource__', label: 'Entire resource' },
                ...[
                  ...new Set([
                    ...(resource?.fields.map((f) => f.name) ?? []),
                    ...(field === '__resource__' ? [] : [field]),
                  ]),
                ].map((name) => ({ value: name, label: name })),
              ]}
            />
          </label>
          <Choice
            label="Note category"
            value={kind}
            onChange={(value) => {
              setKind(value as KnowledgeNote['kind'])
              setConfirmed(false)
            }}
            items={kinds}
          />
          <label htmlFor="knowledge-text">
            Meaning or guidance
            <Textarea
              id="knowledge-text"
              value={text}
              maxLength={4000}
              rows={5}
              onChange={(e) => {
                setText(e.target.value)
                setConfirmed(false)
              }}
              placeholder="Explain the field, status values, workflow, or agent constraint…"
            />
          </label>
          <div className="setting-row">
            <label htmlFor="knowledge-confirmed">
              <strong>I confirm this business knowledge</strong>
              <span>
                Off means draft/unverified. Editing the note text returns it to
                draft until you confirm it again.
              </span>
            </label>
            <Switch
              id="knowledge-confirmed"
              checked={confirmed}
              onCheckedChange={setConfirmed}
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button variant="ghost" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!text.trim() || !entity || saving}
              onClick={() => void save()}
            >
              <Check size={13} />
              {saving ? 'Saving…' : 'Save note'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
