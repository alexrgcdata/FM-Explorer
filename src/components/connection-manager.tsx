import { publicPreview } from '@/lib/runtime'
import { useState } from 'react'
import {
  ArrowRight,
  Braces,
  Clock3,
  Database,
  Globe2,
  History,
  Plus,
  PlugZap,
  ShieldCheck,
  Trash2,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

export function ConnectionManager({
  open,
  onOpenChange,
  onConnect,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (p: Profile) => void
  onAdd: () => void
}) {
  const w = useWorkspace()
  const [deleting, setDeleting] = useState<Profile | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')
  async function test(p: Profile) {
    if (!w.sessions[p.id]) return onConnect(p)
    await w.selectProfile(p.id)
    try {
      await w.refresh(p.id)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Connection check failed.',
      )
    }
  }
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="manager-dialog">
          <DialogHeader>
            <DialogTitle>
              <Database size={20} />
              Connection manager
            </DialogTitle>
            <DialogDescription>
              {publicPreview
                ? 'Synthetic preview profiles and schema snapshots in IndexedDB. No real authentication or external database connection.'
                : 'Profiles and schema snapshots in IndexedDB. Authorization held in service memory.'}
            </DialogDescription>
          </DialogHeader>
          <div className="manager-heading">
            <span>{w.profiles.length} connection profiles</span>
            <Button onClick={onAdd}>
              <Plus size={14} />
              Add connection
            </Button>
          </div>
          <div className="manager-connections">
            {w.profiles.map((p) => {
              const session = w.sessions[p.id]
              return (
                <section
                  key={p.id}
                  className={`manager-connection ${p.id === w.profile.id ? 'selected' : ''}`}
                >
                  <div className="manager-connection-title">
                    <span className="manager-protocol-icon">
                      {p.protocol === 'Data API' ? (
                        <Braces size={19} />
                      ) : (
                        <Globe2 size={19} />
                      )}
                    </span>
                    <div>
                      <h3>{p.name}</h3>
                      <small>
                        {p.database} · {p.protocol}
                      </small>
                    </div>
                    <span className={`tag ${session ? 'accent' : 'neutral'}`}>
                      {session
                        ? p.lab
                          ? 'Lab connected'
                          : 'Connected'
                        : 'Disconnected'}
                    </span>
                  </div>
                  <div className="connection-health">
                    <span>
                      <Clock3 size={12} />
                      Last check
                      <strong>
                        {session ? `${session.latencyMs} ms` : '—'}
                      </strong>
                    </span>
                    <span>
                      <ShieldCheck size={12} />
                      Authentication
                      <strong>{session?.auth ?? 'Not authenticated'}</strong>
                    </span>
                    <span>
                      <History size={12} />
                      Schema checked
                      <strong>
                        {session
                          ? new Date(session.checkedAt).toLocaleTimeString()
                          : '—'}
                      </strong>
                    </span>
                  </div>
                  <div className="manager-connection-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={w.busy}
                      onClick={() => void test(p)}
                    >
                      <ShieldCheck size={12} />
                      Test connection
                    </Button>
                    {session && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void w.disconnect(p.id)}
                      >
                        <Unplug size={12} />
                        Disconnect
                      </Button>
                    )}
                    {!p.lab && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${p.name}`}
                        disabled={w.busy}
                        onClick={() => {
                          setDeleting(p)
                          setRemoveError('')
                        }}
                      >
                        <Trash2 size={12} />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void w.selectProfile(p.id)
                        onOpenChange(false)
                        if (!session) onConnect(p)
                      }}
                    >
                      {session ? 'Explore' : 'Connect'}
                      <ArrowRight size={12} />
                    </Button>
                  </div>
                </section>
              )
            })}
          </div>
          <div className="future-connectors">
            <span>
              <PlugZap size={15} />
              OpenBridge endpoints
              <small>Requires an agreed endpoint contract</small>
            </span>
            <span>
              <Braces size={15} />
              MCP endpoints
              <small>Future transport; tool exports available</small>
            </span>
          </div>
          <div className="connection-history">
            <History size={16} />
            <div>
              <h3>Connection history</h3>
              {!w.activity.length ? (
                <p>
                  No attempts yet. Connect to the local lab or an approved
                  FileMaker endpoint.
                </p>
              ) : (
                <div className="activity-list">
                  {w.activity.slice(0, 30).map((entry) => (
                    <div key={entry.id}>
                      <span className={entry.success ? 'green' : 'form-error'}>
                        {entry.success ? '✓' : '!'}
                      </span>
                      <div>
                        <strong>
                          {entry.action} ·{' '}
                          {w.profiles.find((p) => p.id === entry.profileId)
                            ?.name ?? 'Removed profile'}
                        </strong>
                        <p>{entry.detail}</p>
                        <small>
                          {new Date(entry.at).toLocaleString()}
                          {entry.durationMs !== undefined
                            ? ` · ${entry.durationMs} ms`
                            : ''}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next && !removing) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleting?.name}?</DialogTitle>
            <DialogDescription>
              This removes its connection profile, saved schema history, checks,
              results and developer notes from this browser. It does not delete
              anything in FileMaker. This cannot be undone in Explorer.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            To keep this work, cancel, select this connection, and use Settings
            → Save & restore workspace first.
          </p>
          {removeError && (
            <p className="form-error" role="alert">
              {removeError}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              variant="outline"
              disabled={removing}
              onClick={() => setDeleting(null)}
            >
              Keep connection
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={async () => {
                if (!deleting) return
                setRemoving(true)
                setRemoveError('')
                try {
                  await w.remove(deleting.id)
                  setDeleting(null)
                  toast.success(
                    'Connection and saved work removed from this browser',
                  )
                } catch (error) {
                  setRemoveError(
                    error instanceof Error
                      ? error.message
                      : 'Could not remove this connection. Its saved work was kept.',
                  )
                } finally {
                  setRemoving(false)
                }
              }}
            >
              {removing ? 'Removing…' : 'Remove saved connection'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
