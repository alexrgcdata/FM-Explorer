import { useState } from 'react'
import {
  Archive,
  BookOpen,
  Check,
  Download,
  FileCode2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/workspace'
import { buildHandoffFiles, createHandoffZip, filterKey } from '@/lib/handoff'
import { knowledgeNoteSchema, type KnowledgeNote } from '@/lib/knowledge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Choice, EmptyState, IconButton } from './shared'

const kinds = [
  { value: 'description', label: 'Description' },
  { value: 'status-meaning', label: 'Status meaning' },
  { value: 'workflow', label: 'Workflow note' },
  { value: 'agent-constraint', label: 'Agent constraint' },
]
export function HandoffView() {
  const w = useWorkspace()
  const [selected, setSelected] = useState<string[]>(
      w.entities.map((e) => e.name),
    ),
    [excluded, setExcluded] = useState<string[]>([]),
    [includeValues, setIncludeValues] = useState(false),
    [values, setValues] = useState<Record<string, string>>({}),
    [building, setBuilding] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState<Record<string, string> | null>(null),
    [previewFile, setPreviewFile] = useState('README.md'),
    [editing, setEditing] = useState<KnowledgeNote | 'new' | null>(null),
    [deleting, setDeleting] = useState<KnowledgeNote | null>(null)
  const requests = w.savedRequests.filter(
    (r) => selected.includes(r.query.entity) && !excluded.includes(r.id),
  )
  const noteCount = w.knowledgeNotes.filter((n) =>
    selected.includes(n.entity),
  ).length
  const input = w.snapshot
    ? {
        profile: w.profile,
        snapshot: w.snapshot,
        entities: selected,
        requests,
        notes: w.knowledgeNotes,
        runs: w.checkRuns,
        reviewedValues: values,
        includeReviewedValues: includeValues,
      }
    : null
  const redacted = requests.filter((r) =>
    r.query.conditions.some(
      (c) =>
        c.value !== '' && (!includeValues || !values[filterKey(r.id, c.id)]),
    ),
  ).length
  function prepare() {
    setError('')
    try {
      if (!input) throw new Error('Inspect a schema before building a package.')
      return buildHandoffFiles(input)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not prepare the package.',
      )
      return null
    }
  }
  async function download() {
    if (!prepare() || !input) return
    setBuilding(true)
    try {
      const { bytes } = await createHandoffZip(input)
      const buffer = new ArrayBuffer(bytes.length)
      new Uint8Array(buffer).set(bytes)
      const url = URL.createObjectURL(
          new Blob([buffer], { type: 'application/zip' }),
        ),
        link = document.createElement('a')
      link.href = url
      link.download = `${w.profile.database.replace(/[^A-Za-z0-9_-]/g, '_')}-handoff-${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Integration handoff ZIP downloaded')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not create the ZIP.',
      )
    } finally {
      setBuilding(false)
    }
  }
  if (!w.snapshot)
    return (
      <div className="panel">
        <EmptyState
          title="Start with an inspected schema"
          description="Connect to your database or local lab. Saved schema can then be packaged while disconnected."
        />
      </div>
    )
  return (
    <>
      <div className="view-intro">
        <div>
          <h2>Everything your next developer needs.</h2>
          <p>
            One portable package. Observed structure, reviewed knowledge, and a
            clear starting point.
          </p>
        </div>
        <div className="saved-actions">
          <Button
            variant="outline"
            disabled={!selected.length || building}
            onClick={() => {
              const files = prepare()
              if (files) {
                setPreview(files)
                setPreviewFile('README.md')
              }
            }}
          >
            <BookOpen size={14} />
            Preview files
          </Button>
          <Button
            disabled={!selected.length || building}
            onClick={() => void download()}
          >
            <Download size={14} />
            {building ? 'Building…' : 'Download handoff ZIP'}
          </Button>
        </div>
      </div>
      <div className="source-banner">
        <ShieldCheck size={15} />
        <span>
          Built locally from the inspection saved{' '}
          {new Date(w.snapshot.inspectedAt).toLocaleString()}. No AI service is
          called. Credentials, record rows, and raw response bodies are
          excluded.
        </span>
      </div>
      <div className="checks-summary">
        <div>
          <strong>{selected.length}</strong>
          <span>Selected resources</span>
        </div>
        <div>
          <strong>{requests.length}</strong>
          <span>Saved read definitions</span>
        </div>
        <div>
          <strong>{noteCount}</strong>
          <span>Developer notes</span>
        </div>
        <div>
          <strong className="amber">{redacted}</strong>
          <span>Requests need values</span>
        </div>
      </div>
      <div className="handoff-grid">
        <section className="panel">
          <div className="panel-toolbar">
            <h3>Choose your scope</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(
                  selected.length === w.entities.length
                    ? []
                    : w.entities.map((e) => e.name),
                )
              }
            >
              {selected.length === w.entities.length
                ? 'Clear selection'
                : 'Select all'}
            </Button>
          </div>
          <div className="handoff-resources">
            {w.entities.map((e) => (
              <label key={e.name}>
                <input
                  type="checkbox"
                  checked={selected.includes(e.name)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(e.name)
                        ? current.filter((n) => n !== e.name)
                        : [...current, e.name],
                    )
                  }
                />
                <div>
                  <strong>{e.name}</strong>
                  <span>
                    {e.fields.length} fields ·{' '}
                    {e.kind === 'layout' ? 'Layout' : 'Entity set'}
                  </span>
                </div>
                <FileCode2 size={15} />
              </label>
            ))}
          </div>
          <div className="handoff-inventory">
            <h4>Inside the ZIP</h4>
            <p>
              Manifest & SHA-256 file hashes · selected schema · TypeScript
              modules · JSON Schemas · Markdown context · developer notes ·
              saved checks & summaries · native read examples · dependency-free
              Node runner.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-toolbar">
            <h3>Saved requests</h3>
            <Archive size={16} />
          </div>
          <div className="handoff-request-list">
            {w.savedRequests
              .filter((r) => selected.includes(r.query.entity))
              .map((r) => (
                <label key={r.id}>
                  <input
                    type="checkbox"
                    checked={!excluded.includes(r.id)}
                    onChange={() =>
                      setExcluded((current) =>
                        current.includes(r.id)
                          ? current.filter((id) => id !== r.id)
                          : [...current, r.id],
                      )
                    }
                  />
                  <div>
                    <strong>{r.name}</strong>
                    <span>
                      {r.query.entity} · revision {r.revision} · up to{' '}
                      {r.query.limit} rows
                    </span>
                  </div>
                </label>
              ))}
            {!w.savedRequests.some((r) =>
              selected.includes(r.query.entity),
            ) && (
              <p className="subtle-note">
                No saved requests for these resources. Bounded native read
                examples are still included.
              </p>
            )}
          </div>
          <div className="handoff-privacy">
            <div className="setting-row">
              <label htmlFor="handoff-values">
                <strong>Include reviewed filter values</strong>
                <span>
                  Off by default. When enabled, enter approved values below or
                  explicitly use a saved value. Unfilled filters remain blocked.
                </span>
              </label>
              <Switch
                id="handoff-values"
                checked={includeValues}
                onCheckedChange={setIncludeValues}
              />
            </div>
            {includeValues && (
              <div className="reviewed-filters">
                {requests.flatMap((r) =>
                  r.query.conditions
                    .filter((c) => c.value !== '')
                    .map((c) => (
                      <div key={filterKey(r.id, c.id)}>
                        <label htmlFor={`filter-${r.id}-${c.id}`}>
                          {r.name} · {c.field} · {c.operator}
                        </label>
                        <div>
                          <Input
                            id={`filter-${r.id}-${c.id}`}
                            aria-label={`Reviewed value for ${r.name} ${c.field}`}
                            value={values[filterKey(r.id, c.id)] ?? ''}
                            placeholder="Redacted — enter approved value"
                            maxLength={2000}
                            onChange={(e) =>
                              setValues((current) => ({
                                ...current,
                                [filterKey(r.id, c.id)]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setValues((current) => ({
                                ...current,
                                [filterKey(r.id, c.id)]: c.value,
                              }))
                            }
                          >
                            Use saved value
                          </Button>
                        </div>
                      </div>
                    )),
                )}
                {!requests.some((r) =>
                  r.query.conditions.some((c) => c.value !== ''),
                ) && (
                  <p className="subtle-note">
                    No active saved filters to review.
                  </p>
                )}
              </div>
            )}
            <p className="subtle-note">
              A redacted saved request has no executable request spec. The
              exported runner refuses to send it. Review notes and query
              descriptions for private text before sharing.
            </p>
          </div>
        </section>
      </div>
      <section className="panel knowledge-panel">
        <div className="panel-toolbar">
          <div>
            <h3>Developer knowledge</h3>
            <p className="subtle-note">
              Add the meanings metadata cannot explain. New notes start as
              drafts; confirmation is your explicit assertion.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
            <Plus size={13} />
            Add note
          </Button>
        </div>
        {w.knowledgeNotes.length ? (
          w.knowledgeNotes.map((note) => (
            <article className="knowledge-note" key={note.id}>
              <div>
                <span
                  className={`check-status ${note.status === 'confirmed' ? 'pass' : 'pending'}`}
                >
                  {note.status === 'confirmed'
                    ? 'Human-confirmed'
                    : 'Draft — unverified'}
                </span>
                <span className="subtle-note">
                  {note.kind} ·{' '}
                  {selected.includes(note.entity)
                    ? 'Included'
                    : 'Outside selected scope'}
                </span>
              </div>
              <h4>
                {note.entity}
                {note.field ? `.${note.field}` : ''}
              </h4>
              <p>{note.text}</p>
              <footer>
                <span>
                  Developer-authored ·{' '}
                  {new Date(note.updatedAt).toLocaleString()}
                </span>
                <div className="saved-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(note)}
                  >
                    <Pencil size={12} />
                    Edit
                  </Button>
                  <IconButton
                    label={`Delete note for ${note.entity}`}
                    onClick={() => setDeleting(note)}
                  >
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              </footer>
            </article>
          ))
        ) : (
          <EmptyState
            title="Capture what the schema cannot tell you"
            description="Describe status values, workflow assumptions, field meanings, and constraints for future developers or agents."
          />
        )}
      </section>
      <p className="subtle-note">
        Packages contain account-visible metadata and human-authored context,
        not a database backup or a complete dependency map. The Node runner
        performs a bounded read; saved check expectations remain definitions for
        review, not automatically executed tests.
      </p>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {editing && (
        <KnowledgeDialog
          key={editing === 'new' ? 'new' : editing.id}
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete developer note?</DialogTitle>
            <DialogDescription>
              This removes the note from local browser storage. Previously
              downloaded packages keep their own copy.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting)
                  void w
                    .deleteKnowledgeNote(deleting.id)
                    .then(() => setDeleting(null))
                    .catch((error) => toast.error(error.message))
              }}
            >
              Delete note
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="handoff-preview">
          <DialogHeader>
            <DialogTitle>Review package contents</DialogTitle>
            <DialogDescription>
              Preview of selected files. The downloaded ZIP also adds byte
              counts and SHA-256 hashes to the manifest. No record values or
              authentication are copied.
            </DialogDescription>
          </DialogHeader>
          <Choice
            label="Package preview file"
            value={previewFile}
            onChange={setPreviewFile}
            items={Object.keys(preview ?? {}).map((name) => ({
              value: name,
              label: name,
            }))}
          />
          <pre tabIndex={0} aria-label="Package file content">
            {preview?.[previewFile] ?? ''}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  )
}
function KnowledgeDialog({
  existing,
  onClose,
}: {
  existing?: KnowledgeNote
  onClose: () => void
}) {
  const w = useWorkspace(),
    [entity, setEntity] = useState(
      existing?.entity ?? w.entities[0]?.name ?? '',
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
