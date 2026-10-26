import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Braces,
  DatabaseZap,
  Globe2,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react'
import type { Profile, Protocol } from '@/lib/data'
import type { Auth } from '@/lib/contracts'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Choice } from './shared'

export function ConnectionDialog({
  open,
  onOpenChange,
  onAuthenticate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAuthenticate: (p: Profile) => void
}) {
  const w = useWorkspace(),
    [name, setName] = useState(''),
    [host, setHost] = useState(''),
    [database, setDatabase] = useState(''),
    [protocol, setProtocol] = useState<Protocol>('Data API'),
    [version, setVersion] = useState('vLatest'),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const url = new URL(host)
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        throw new Error()
    } catch {
      setError(
        'Use an HTTPS host only, without credentials, query parameters, or an API path.',
      )
      return
    }
    setSaving(true)
    try {
      const p: Profile = {
        id: crypto.randomUUID(),
        name: name.trim(),
        host: host.trim().replace(/\/$/, ''),
        database: database.trim(),
        protocol,
        ...(protocol === 'Data API' ? { apiVersion: version } : {}),
      }
      await w.addProfile(p)
      onOpenChange(false)
      onAuthenticate(p)
      setName('')
      setHost('')
      setDatabase('')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save the profile.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="dialog-feature-icon">
            <DatabaseZap size={23} />
          </div>
          <DialogTitle>Add a connection</DialogTitle>
          <DialogDescription>
            Save a profile in IndexedDB, then authenticate through the local
            service.
          </DialogDescription>
        </DialogHeader>
        <form
          className="connection-form"
          onSubmit={(event) => void save(event)}
        >
          <div className="protocol-picker">
            {(['Data API', 'OData'] as const).map((p) => (
              <button
                type="button"
                key={p}
                className={protocol === p ? 'active' : ''}
                onClick={() => setProtocol(p)}
              >
                {p === 'Data API' ? <Braces size={17} /> : <Globe2 size={17} />}
                <span>{p}</span>
              </button>
            ))}
          </div>
          <label htmlFor="connection-name">
            Connection name
            <Input
              id="connection-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Studio CRM"
            />
          </label>
          <label htmlFor="connection-host">
            FileMaker host
            <Input
              id="connection-host"
              required
              type="url"
              value={host}
              onChange={(e) => {
                setHost(e.target.value)
                setError('')
              }}
              placeholder="https://filemaker.example.com"
              aria-invalid={!!error}
              aria-describedby={error ? 'connection-error' : undefined}
            />
          </label>
          <label htmlFor="connection-database">
            Database name
            <Input
              id="connection-database"
              required
              maxLength={200}
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="Studio_CRM"
            />
          </label>
          {protocol === 'Data API' && (
            <label>
              API version
              <Choice
                label="Data API version"
                value={version}
                onChange={setVersion}
                items={['vLatest', 'v2', 'v1'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </label>
          )}
          {error && (
            <p id="connection-error" className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="info-banner">
            <ShieldCheck size={16} />
            <p>
              Use a read-only account with API privileges. This app reads
              metadata and records; it does not run scripts or edit FileMaker
              records.
            </p>
          </div>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                saving || !name.trim() || !database.trim() || !host.trim()
              }
            >
              {saving ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              Save & authenticate
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export function AuthenticationDialog({
  profile,
  onClose,
}: {
  profile: Profile | null
  onClose: () => void
}) {
  const w = useWorkspace(),
    [mode, setMode] = useState<Auth['mode']>(profile?.lab ? 'lab' : 'password'),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [token, setToken] = useState(''),
    [error, setError] = useState('')
  if (!profile) return null
  function close() {
    if (w.busy) return
    setUsername('')
    setPassword('')
    setToken('')
    setError('')
    onClose()
  }
  async function connect(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await w.connect(profile!, {
        mode,
        ...(mode === 'password' ? { username, password } : {}),
        ...(['token', 'fmid'].includes(mode) ? { token } : {}),
      })
      setPassword('')
      setToken('')
      onClose()
    } catch (error) {
      setPassword('')
      setToken('')
      setError(error instanceof Error ? error.message : 'Could not connect.')
    }
  }
  return (
    <Dialog open={!!profile} onOpenChange={(open) => !open && close()}>
      <DialogContent
        onEscapeKeyDown={(e) => w.busy && e.preventDefault()}
        onInteractOutside={(e) => w.busy && e.preventDefault()}
      >
        <DialogHeader>
          <div className="dialog-feature-icon">
            <KeyRound size={23} />
          </div>
          <DialogTitle>Connect to {profile.name}</DialogTitle>
          <DialogDescription>
            {profile.database} · {profile.protocol}
            {profile.lab
              ? ' · Local synthetic practice server'
              : ` · ${profile.host}`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="connection-form"
          onSubmit={(event) => void connect(event)}
        >
          {profile.lab ? (
            <div className="info-banner">
              <ShieldCheck size={16} />
              <p>
                The lab issues a temporary local token and serves synthetic
                records. No real FileMaker account is needed.
              </p>
            </div>
          ) : (
            <>
              <label>
                Authentication
                <Choice
                  label="Authentication method"
                  value={mode}
                  onChange={(v) => {
                    setMode(v as Auth['mode'])
                    setPassword('')
                    setToken('')
                    setError('')
                  }}
                  items={[
                    { value: 'password', label: 'FileMaker Server account' },
                    profile.protocol === 'Data API'
                      ? {
                          value: 'token',
                          label: 'Existing Data API session token',
                        }
                      : { value: 'fmid', label: 'FileMaker Cloud FMID token' },
                  ]}
                />
              </label>
              {mode === 'password' ? (
                <>
                  <label htmlFor="auth-username">
                    Account name
                    <Input
                      id="auth-username"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={w.busy}
                    />
                  </label>
                  <label htmlFor="auth-password">
                    Password
                    <Input
                      id="auth-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={w.busy}
                    />
                  </label>
                </>
              ) : (
                <label htmlFor="auth-token">
                  {mode === 'fmid' ? 'FMID token' : 'Session token'}
                  <Input
                    id="auth-token"
                    type="password"
                    autoComplete="off"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={w.busy}
                  />
                </label>
              )}
              <div className="info-banner">
                <ShieldCheck size={16} />
                <p>
                  Authorization stays in local-service memory. Passwords and
                  tokens are never saved to IndexedDB or exports. Reauthenticate
                  after restarting the service.
                </p>
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {w.busy && (
            <p className="connection-progress" role="status">
              <LoaderCircle size={15} className="animate-spin" />
              Authenticating and inspecting accessible schema…
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={w.busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={w.busy}>
              {w.busy ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              Connect & discover
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
