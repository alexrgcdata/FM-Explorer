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
import { Choice, copyText } from './shared'
import {
  readEndpoint,
  validateDatabaseName,
  connectionRequest,
} from '@/lib/connection-setup'
import { publicPreview } from '@/lib/runtime'

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
  function useEndpoint() {
    try {
      const target = readEndpoint(host)
      setHost(target.host)
      if (target.database) setDatabase(target.database)
      if (target.protocol) setProtocol(target.protocol)
      if (target.apiVersion) setVersion(target.apiVersion)
      setError('')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Check the endpoint URL.',
      )
    }
  }
  async function save(event?: FormEvent, authenticate = true) {
    event?.preventDefault()
    setError('')
    setSaving(true)
    try {
      const target = readEndpoint(host)
      const chosenDatabase = (target.database ?? database).trim()
      const chosenProtocol = target.protocol ?? protocol
      validateDatabaseName(chosenDatabase)
      const p: Profile = {
        id: crypto.randomUUID(),
        name: name.trim(),
        host: target.host,
        database: chosenDatabase,
        protocol: chosenProtocol,
        ...(chosenProtocol === 'Data API'
          ? { apiVersion: target.apiVersion ?? version }
          : {}),
      }
      await w.addProfile(p)
      onOpenChange(false)
      if (authenticate) onAuthenticate(p)
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
  if (publicPreview)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Try the bundled database</DialogTitle>
            <DialogDescription>
              This public preview runs entirely in your browser with synthetic
              data. It does not accept real FileMaker credentials or connect to
              external servers. Use the Connection menu to switch between the
              bundled API examples. Real connections require the local
              application.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>
            Continue exploring
          </Button>
        </DialogContent>
      </Dialog>
    )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="connection-setup-dialog">
        <DialogHeader>
          <div className="dialog-feature-icon">
            <DatabaseZap size={23} />
          </div>
          <DialogTitle>Add a connection</DialogTitle>
          <DialogDescription>
            Prepare a profile first. Credentials are entered separately when you
            are ready to connect.
          </DialogDescription>
        </DialogHeader>
        <form
          className="connection-form"
          onSubmit={(event) => void save(event)}
        >
          <details className="connection-prep-guide">
            <summary>Need the connection details?</summary>
            <p>
              You need an HTTPS server address, the exact hosted database name,
              and access to the selected API. Ask the solution owner for a
              limited test account through their secure channel.
            </p>
            <p>
              No credentials yet? Save a profile now and connect later. Setup
              details are not evidence that the server is reachable or
              compatible.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void copyText(connectionRequest(protocol, host, database))
              }
            >
              Copy setup request
            </Button>
          </details>
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
            Server address or API URL
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
          <div className="connection-url-helper">
            <span>
              Have a full Data API or OData URL? We can fill in its host,
              database, and protocol.
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={useEndpoint}
              disabled={!host.trim()}
            >
              Read API URL
            </Button>
          </div>
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
              type="button"
              variant="outline"
              disabled={
                saving || !name.trim() || !database.trim() || !host.trim()
              }
              onClick={(event) => {
                if (event.currentTarget.form?.reportValidity())
                  void save(undefined, false)
              }}
            >
              Save profile only
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
              Continue to sign in
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
                {publicPreview
                  ? 'This loads synthetic records in your browser. No server, credentials, or real FileMaker account is involved.'
                  : 'The lab issues a temporary local token and serves synthetic records. No real FileMaker account is needed.'}
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
