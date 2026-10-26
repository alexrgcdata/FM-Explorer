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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="manager-dialog">
        <DialogHeader>
          <DialogTitle>
            <Database size={20} />
            Connection manager
          </DialogTitle>
          <DialogDescription>
            Profiles and schema snapshots in IndexedDB. Authorization held in
            service memory.
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
                    <strong>{session ? `${session.latencyMs} ms` : '—'}</strong>
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
                      onClick={() => void w.remove(p.id)}
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
            MCP endpoints<small>Future transport; tool exports available</small>
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
  )
}
