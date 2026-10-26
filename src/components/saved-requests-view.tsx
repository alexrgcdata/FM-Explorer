import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ClipboardCheck,
  Download,
  History,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/workspace'
import {
  requestExport,
  type CheckRun,
  type SavedRequest,
} from '@/lib/saved-requests'
import { downloadFile } from '@/lib/generators'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Switch } from './ui/switch'
import { SaveRequestDialog } from './save-request-dialog'
import { EmptyState, IconButton } from './shared'

const statusLabel = {
  pass: 'Passed',
  fail: 'Failed',
  inconclusive: 'Inconclusive',
  error: 'Request error',
}
export function SavedRequestsView({
  onOpenBuilder,
  initialSearch = '',
}: {
  onOpenBuilder: (request?: SavedRequest) => void
  initialSearch?: string
}) {
  const w = useWorkspace(),
    [search, setSearch] = useState(initialSearch),
    [running, setRunning] = useState<string | null>(null),
    [suite, setSuite] = useState(false),
    [editing, setEditing] = useState<SavedRequest | null>(null),
    [deleting, setDeleting] = useState<SavedRequest | null>(null),
    [viewRun, setViewRun] = useState<CheckRun | null>(null),
    [exportOpen, setExportOpen] = useState(false),
    [includeValues, setIncludeValues] = useState(false)
  const controller = useRef<AbortController | null>(null),
    runLock = useRef(false)
  useEffect(() => () => controller.current?.abort(), [])
  const matches = w.savedRequests.filter((r) =>
    `${r.name} ${r.description} ${r.query.entity}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const latest = (request: SavedRequest) =>
    w.checkRuns.find(
      (run) =>
        run.requestId === request.id &&
        run.requestRevision === request.revision,
    )
  async function run(request: SavedRequest) {
    if (runLock.current) return
    runLock.current = true
    setRunning(request.id)
    const abort = new AbortController()
    controller.current = abort
    try {
      const result = await w.runSavedRequest(request.id, abort.signal)
      if (!abort.signal.aborted) {
        setViewRun(result)
        toast[result.status === 'pass' ? 'success' : 'warning'](
          `${request.name}: ${statusLabel[result.status]}`,
        )
      }
    } catch (error) {
      if (!abort.signal.aborted)
        toast.error(error instanceof Error ? error.message : 'Check failed.')
    } finally {
      runLock.current = false
      setRunning(null)
    }
  }
  async function runSuite() {
    if (runLock.current) return
    runLock.current = true
    setSuite(true)
    const abort = new AbortController()
    controller.current = abort
    const results: CheckRun[] = []
    try {
      for (const request of w.savedRequests) {
        if (abort.signal.aborted) break
        setRunning(request.id)
        const result = await w.runSavedRequest(request.id, abort.signal)
        results.push(result)
        if (result.status === 'error') {
          toast.warning(
            'Suite stopped after a request error. Review the result before retrying.',
          )
          break
        }
      }
      if (!abort.signal.aborted)
        toast.success(
          `Suite finished: ${results.filter((r) => r.status === 'pass').length} passed, ${results.filter((r) => r.status !== 'pass').length} need review.`,
        )
    } catch (error) {
      if (!abort.signal.aborted)
        toast.error(error instanceof Error ? error.message : 'Suite stopped.')
    } finally {
      runLock.current = false
      setSuite(false)
      setRunning(null)
    }
  }
  const passCount = w.savedRequests.filter(
      (r) => latest(r)?.status === 'pass',
    ).length,
    reviewCount = w.savedRequests.filter((r) => {
      const status = latest(r)?.status
      return status && status !== 'pass'
    }).length
  return (
    <>
      <div className="view-intro">
        <div>
          <h2>Keep your integrations honest.</h2>
          <p>
            Save a request once. Check the response again after your solution
            changes.
          </p>
        </div>
        <div className="saved-actions">
          <Button
            variant="outline"
            onClick={() => setExportOpen(true)}
            disabled={!w.savedRequests.length}
          >
            <Download size={14} />
            Export
          </Button>
          <Button onClick={() => onOpenBuilder()}>
            <Plus size={14} />
            New request
          </Button>
        </div>
      </div>
      <div className="checks-summary">
        <div>
          <strong>{w.savedRequests.length}</strong>
          <span>Saved requests</span>
        </div>
        <div>
          <strong className="green">{passCount}</strong>
          <span>Latest checks passed</span>
        </div>
        <div>
          <strong className="amber">{reviewCount}</strong>
          <span>Need review</span>
        </div>
        <div>
          <strong>{w.savedRequests.length - passCount - reviewCount}</strong>
          <span>Not run / updated</span>
        </div>
      </div>
      <div className="panel saved-requests-panel">
        <div className="panel-toolbar">
          <div className="search-input">
            <Search size={14} />
            <Input
              aria-label="Search saved requests"
              placeholder="Search requests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="saved-actions">
            {running && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => controller.current?.abort()}
              >
                <X size={13} />
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!w.session || !!running || !w.savedRequests.length}
              onClick={() => void runSuite()}
            >
              <Play size={13} />
              {suite ? 'Running suite…' : 'Run all checks'}
            </Button>
          </div>
        </div>
        {!w.session && (
          <div className="saved-offline-note">
            Saved requests are available offline. Reconnect to execute checks.
          </div>
        )}
        {matches.map((request) => {
          const result = latest(request),
            history = w.checkRuns.filter((run) => run.requestId === request.id)
          return (
            <section key={request.id} className="saved-request-card">
              <div className="saved-request-top">
                <span className="tool-icon">
                  <ClipboardCheck size={19} />
                </span>
                <div>
                  <h3>{request.name}</h3>
                  <p>
                    {request.query.entity} · {request.protocol} · up to{' '}
                    {request.query.limit} rows · revision {request.revision}
                  </p>
                </div>
                <span className={`check-status ${result?.status ?? 'pending'}`}>
                  {result ? statusLabel[result.status] : 'Needs a run'}
                </span>
              </div>
              {request.description && (
                <p className="saved-request-description">
                  {request.description}
                </p>
              )}
              <div className="saved-request-expectations">
                <span>
                  {request.expectations.fields.length} expected fields
                </span>
                <span>
                  At least {request.expectations.minRows} returned rows
                </span>
                {request.expectations.maxDurationMs !== undefined && (
                  <span>
                    ≤ {request.expectations.maxDurationMs} ms upstream
                  </span>
                )}
              </div>
              {result && (
                <button
                  className="saved-result-link"
                  onClick={() => setViewRun(result)}
                >
                  {result.status === 'pass' ? (
                    <Check size={13} />
                  ) : (
                    <ClipboardCheck size={13} />
                  )}
                  <span>
                    {result.status === 'error'
                      ? result.error
                      : `${result.returnedRows} rows checked · ${result.durationMs} ms`}
                  </span>
                  <small>{new Date(result.at).toLocaleString()}</small>
                  <ArrowUpRight size={12} />
                </button>
              )}
              <div className="saved-request-footer">
                <div className="saved-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenBuilder(request)}
                    disabled={
                      !!running ||
                      !w.entities.some(
                        (entity) => entity.name === request.query.entity,
                      )
                    }
                    title="Requires this resource in the inspected schema"
                  >
                    <ArrowUpRight size={13} />
                    Open builder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(request)}
                    disabled={!!running}
                  >
                    <Pencil size={13} />
                    Edit checks
                  </Button>
                  <IconButton
                    label={`Delete ${request.name}`}
                    onClick={() => setDeleting(request)}
                    disabled={!!running}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
                <Button
                  size="sm"
                  onClick={() => void run(request)}
                  disabled={!w.session || !!running}
                >
                  <Play size={12} />
                  {running === request.id ? 'Running…' : 'Run check'}
                </Button>
              </div>
              {history.length > 0 && (
                <details className="check-history">
                  <summary>
                    <History size={12} />
                    {history.length} saved{' '}
                    {history.length === 1 ? 'run' : 'runs'}
                  </summary>
                  {history.slice(0, 10).map((run) => (
                    <button key={run.id} onClick={() => setViewRun(run)}>
                      <span className={`check-status ${run.status}`}>
                        {statusLabel[run.status]}
                      </span>
                      <span>Revision {run.requestRevision}</span>
                      <time>{new Date(run.at).toLocaleString()}</time>
                    </button>
                  ))}
                </details>
              )}
            </section>
          )
        })}
        {!matches.length && (
          <EmptyState
            title={
              w.savedRequests.length
                ? 'No matching requests'
                : 'Your first integration check starts here'
            }
            description={
              w.savedRequests.length
                ? 'Try a different request name or resource.'
                : 'Open the query builder, choose a read request, and save its expected response.'
            }
          />
        )}
      </div>
      <p className="subtle-note">
        These checks inspect the returned page. A pass does not validate every
        record, business rule, or relationship in the solution. Editing a
        request requires a fresh run.
      </p>
      {editing && (
        <SaveRequestDialog
          key={editing.id}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          query={editing.query}
          existing={editing}
        />
      )}
      <Dialog
        open={!!viewRun}
        onOpenChange={(open) => !open && setViewRun(null)}
      >
        <DialogContent className="check-result-dialog">
          <DialogHeader>
            <DialogTitle>
              <ClipboardCheck size={19} />
              {viewRun?.requestName ?? 'Check result'}
            </DialogTitle>
            <DialogDescription>
              Revision {viewRun?.requestRevision} ·{' '}
              {viewRun ? new Date(viewRun.at).toLocaleString() : ''} · No record
              values are retained.
            </DialogDescription>
          </DialogHeader>
          {viewRun && (
            <>
              <div className="check-result-summary">
                <span className={`check-status ${viewRun.status}`}>
                  {statusLabel[viewRun.status]}
                </span>
                <span>
                  {viewRun.returnedRows ?? '—'} returned rows ·{' '}
                  {viewRun.matchingRows ?? 'Unknown'} matching ·{' '}
                  {viewRun.durationMs ?? '—'} ms
                </span>
              </div>
              {viewRun.error && (
                <p className="error-banner" role="alert">
                  {viewRun.error}
                </p>
              )}
              <div className="check-details">
                {viewRun.details.map((detail) => (
                  <div
                    key={detail.id}
                    className={`check-detail ${detail.status}`}
                  >
                    <span>
                      {detail.status === 'pass'
                        ? '✓'
                        : detail.status === 'fail'
                          ? '!'
                          : '—'}
                    </span>
                    <p>{detail.message}</p>
                  </div>
                ))}
              </div>
              <p className="subtle-note">
                Field checks with no returned rows are inconclusive. Response
                time covers the upstream read, not total browser rendering time.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved request?</DialogTitle>
            <DialogDescription>
              This removes “{deleting?.name}” and its check history from this
              browser. It does not change FileMaker.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleting) return
                void w
                  .deleteSavedRequest(deleting.id)
                  .then(() => setDeleting(null))
                  .catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not delete.',
                    ),
                  )
              }}
            >
              Delete request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export requests & check summaries</DialogTitle>
            <DialogDescription>
              Portable JSON definitions and saved result summaries for this
              connection. Authentication and returned records are excluded.
            </DialogDescription>
          </DialogHeader>
          <div className="setting-row">
            <label htmlFor="export-filter-values">
              <strong>Include saved filter values</strong>
              <span>
                Off by default. Filter values can contain private business data.
                Redacted exports require values to be supplied again before use.
              </span>
            </label>
            <Switch
              id="export-filter-values"
              checked={includeValues}
              onCheckedChange={setIncludeValues}
            />
          </div>
          <Button
            onClick={() => {
              downloadFile(
                `${w.profile.database}-requests.json`,
                requestExport(
                  w.profile,
                  w.savedRequests,
                  w.checkRuns,
                  includeValues,
                ),
              )
              setExportOpen(false)
            }}
          >
            <Download size={14} />
            Download JSON
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
