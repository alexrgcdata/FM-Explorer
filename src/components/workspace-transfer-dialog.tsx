import { useRef, useState } from 'react'
import { Download, Upload, CheckCircle2, FolderInput } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { useWorkspace } from '../lib/workspace'
import { publicPreview } from '../lib/runtime'
import { downloadFile } from '../lib/generators'
import {
  buildWorkspaceArchive,
  parseWorkspaceArchive,
  importWorkspaceArchive,
  workspaceFileLimit,
  type WorkspaceArchive,
} from '../lib/workspace-transfer'

const count = (value: number, label: string) =>
  `${value} ${label}${value === 1 ? '' : 's'}`

export function WorkspaceTransferDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const w = useWorkspace()
  const fileRef = useRef<HTMLInputElement>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [candidate, setCandidate] = useState<WorkspaceArchive | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  function reset() {
    setCandidate(null)
    setError('')
    setResult('')
    setAcknowledged(false)
  }
  function exportWorkspace() {
    try {
      const archive = buildWorkspaceArchive({
        profile: w.profile,
        schemaVersions: w.schemaVersions,
        savedRequests: w.savedRequests,
        knowledgeNotes: w.knowledgeNotes,
      })
      const content = JSON.stringify(archive, null, 2)
      if (new TextEncoder().encode(content).byteLength > workspaceFileLimit)
        throw new Error(
          'This workspace exceeds the 10 MB transfer limit. Export a smaller selection through Handoff instead.',
        )
      downloadFile(
        `${w.profile.database}-workspace-${new Date().toISOString().slice(0, 10)}.json`,
        content,
      )
      toast.success('Workspace saved to your downloads')
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not export this workspace.',
      )
    }
  }
  async function readFile(file?: File) {
    setCandidate(null)
    setResult('')
    setError('')
    if (!file) return
    setBusy(true)
    try {
      if (file.size > workspaceFileLimit)
        throw new Error('Choose a workspace JSON file smaller than 10 MB.')
      setCandidate(parseWorkspaceArchive(await file.text(), publicPreview))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.')
    } finally {
      setBusy(false)
    }
  }
  async function restore() {
    if (!candidate) return
    setBusy(true)
    setError('')
    try {
      const restored = await importWorkspaceArchive(candidate, publicPreview)
      setResult(
        `Imported ${count(restored.requests, 'saved check')}, ${count(restored.notes, 'note')}, and ${count(restored.versions, 'schema version')} into ${restored.profile.name}.${restored.skippedVersions ? ` ${restored.skippedVersions} additional versions skipped because this connection already has saved history (50-version limit).` : ''} Existing work was kept. No connection was opened.`,
      )
      setCandidate(null)
      toast.success('Workspace imported')
      try {
        await w.reloadStoredWorkspace()
      } catch {
        setError(
          'The import was saved, but the screen could not refresh. Reload the page to see it; do not import the file again.',
        )
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Import failed. Your existing work was kept.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          onOpenChange(next)
          if (!next) reset()
        }
      }}
    >
      <DialogContent className="workspace-transfer-dialog">
        <DialogHeader>
          <DialogTitle>Save & restore workspace</DialogTitle>
          <DialogDescription>
            Keep your discovery work when changing browsers or computers. This
            saves Explorer work, not a FileMaker database backup.
          </DialogDescription>
        </DialogHeader>
        <section
          className="workspace-transfer-section"
          aria-labelledby="transfer-export-title"
        >
          <h3 id="transfer-export-title">
            <Download size={18} /> Save {w.profile.name}
          </h3>
          <p>
            Connection details ·{' '}
            {count(w.schemaVersions.length, 'schema version')} ·{' '}
            {count(w.savedRequests.length, 'saved check')} ·{' '}
            {count(w.knowledgeNotes.length, 'developer note')}
          </p>
          <label className="transfer-acknowledgement">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              I understand this file includes server/database names, saved
              filter values and note text. I’ll keep it private.
            </span>
          </label>
          <Button onClick={exportWorkspace} disabled={!acknowledged || busy}>
            <Download size={16} /> Download workspace JSON
          </Button>
        </section>
        <section
          className="workspace-transfer-section"
          aria-labelledby="transfer-import-title"
        >
          <h3 id="transfer-import-title">
            <FolderInput size={18} /> Restore from a file
          </h3>
          <p>
            Choose a workspace JSON export (up to 10 MB). You can review it
            before importing. Matching connections are reused; imported checks
            and notes are added as copies.
          </p>
          <p>
            This is optional. Connecting to FileMaker does not require uploading
            a database file.
          </p>
          {publicPreview && (
            <p>
              Website demo: bundled lab workspaces only. Real connection files
              belong in the local application.
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            aria-label="Choose workspace JSON file"
            disabled={busy}
            onChange={(e) => {
              void readFile(e.target.files?.[0])
              e.target.value = ''
            }}
            className="transfer-file-input"
          />
          {candidate && (
            <div className="transfer-review" aria-live="polite">
              <strong>{candidate.profile.name}</strong>
              <span className="font-mono">{candidate.profile.host}</span>
              <span>
                {candidate.profile.database} · {candidate.profile.protocol} ·{' '}
                {new Date(candidate.exportedAt).toLocaleString()}
              </span>
              <span>
                {count(candidate.schemaVersions.length, 'schema version')} ·{' '}
                {count(candidate.savedRequests.length, 'check')} ·{' '}
                {count(candidate.knowledgeNotes.length, 'note')}
              </span>
              <p>
                Existing work is never replaced. Importing the same file again
                creates more copies. No login, connection test, query execution,
                or FileMaker write runs during import.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void restore()}
                  disabled={busy || w.busy}
                >
                  <Upload size={16} />
                  {busy ? 'Importing…' : 'Import a copy'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCandidate(null)}
                  disabled={busy}
                >
                  Cancel import
                </Button>
              </div>
            </div>
          )}
          {result && (
            <p className="transfer-result" role="status">
              <CheckCircle2 size={18} />
              {result}
            </p>
          )}
        </section>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p className="transfer-footnote">
          Authentication fields, sessions, returned records, raw API responses,
          activity logs, check-run results and display preferences are excluded.
          Secrets typed into notes or filters are ordinary text and are
          included.
        </p>
      </DialogContent>
    </Dialog>
  )
}
