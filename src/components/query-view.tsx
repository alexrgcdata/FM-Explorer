import { publicPreview } from '@/lib/runtime'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Braces,
  Code2,
  Filter,
  Play,
  Plus,
  Trash2,
  Save,
  ClipboardCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Entity, Protocol } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import type { RecordPage } from '@/lib/contracts'
import { compileQuery, type Condition } from '@/lib/generators'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Choice, CodeBlock, EmptyState, IconButton } from './shared'
import { SaveRequestDialog } from './save-request-dialog'
import type { SavedRequest } from '@/lib/saved-requests'

export function QueryView({
  entity,
  protocol,
  savedRequest,
  onOpenSaved,
}: {
  entity: Entity
  protocol: Protocol
  savedRequest?: SavedRequest
  onOpenSaved?: () => void
}) {
  const workspace = useWorkspace()
  const [saved, setSaved] = useState(savedRequest),
    [saveOpen, setSaveOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [responseInfo, setResponseInfo] = useState<RecordPage | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])
  const defaultField =
    entity.fields.find((f) => f.name === 'Status') ?? entity.fields[0]
  const [conditions, setConditions] = useState<Condition[]>(
    savedRequest
      ? savedRequest.query.conditions
      : defaultField
        ? [
            {
              id: 'first',
              field: defaultField.name,
              operator: 'equals',
              value: '',
            },
          ]
        : [],
  )
  const [match, setMatch] = useState<'all' | 'any'>(
    savedRequest?.query.match ?? 'all',
  )
  const [limit, setLimit] = useState(String(savedRequest?.query.limit ?? 10))
  const [results, setResults] = useState<string | null>(null)
  const [format, setFormat] = useState<'request' | 'fetch'>('request')
  const compilation = useMemo(() => {
    try {
      return {
        request: compileQuery(
          entity,
          protocol,
          conditions,
          match,
          Number(limit),
          workspace.profile,
        ),
        error: '',
      }
    } catch (error) {
      return {
        request: '',
        error: error instanceof Error ? error.message : 'Invalid query.',
      }
    }
  }, [entity, protocol, conditions, match, limit, workspace.profile])
  const request = compilation.request
  const active = conditions.filter((c) => c.value !== '')
  const invalid = active.some((c) => {
    const type = entity.fields.find((f) => f.name === c.field)?.type
    return (
      (type === 'number' && !Number.isFinite(Number(c.value))) ||
      (type === 'boolean' && !['true', 'false'].includes(c.value))
    )
  })
  function change(id: string, patch: Partial<Condition>) {
    setConditions((current) =>
      current.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    )
    setResults(null)
  }
  async function run() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setRequestError('')
    setResults(null)
    setResponseInfo(null)
    try {
      const response = await workspace.execute(
        {
          entity: entity.name,
          conditions,
          match,
          limit: Number(limit),
          offset: 0,
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      setResponseInfo(response)
      setResults(JSON.stringify(response.rows, null, 2))
      toast.success(
        `${response.rows.length} records returned in ${response.elapsedMs} ms`,
      )
    } catch (error) {
      if (!controller.signal.aborted)
        setRequestError(
          error instanceof Error ? error.message : 'Query failed.',
        )
    } finally {
      if (abortRef.current === controller) setRunning(false)
    }
  }
  const [first, body] = request.split('\n\n')
  const method = first.startsWith('POST') ? 'POST' : 'GET'
  const fetchCode = `// Request template — add your secure transport.\nconst response = await fetch(\n  "${workspace.profile.lab ? 'http://127.0.0.1:4186' : workspace.profile.host}${first.slice(method.length + 1)}",\n  {\n    method: "${method}",\n    headers: {\n      ${protocol === 'Data API' ? 'Authorization: "Bearer <SESSION_TOKEN>"' : 'Authorization: "Basic <ENCODED_CREDENTIALS>"'},\n      "Content-Type": "application/json"\n    }${body ? `,\n    body: JSON.stringify(${body})` : ''}\n  }\n);\n\nconst data = await response.json();`
  return (
    <>
      <div className="view-intro">
        <div>
          <h2>Build a request, visually.</h2>
          <p>
            Start with a condition. Get a request you can take straight into
            your project.
          </p>
        </div>
        <div className="saved-actions">
          <Button
            variant="outline"
            disabled={invalid || !!compilation.error || running}
            onClick={() => setSaveOpen(true)}
          >
            <Save size={14} />
            {saved ? 'Update saved request' : 'Save request'}
          </Button>
          {onOpenSaved && (
            <Button variant="ghost" onClick={onOpenSaved}>
              <ClipboardCheck size={14} />
              Saved requests
            </Button>
          )}
          <span className="tag accent">
            <Code2 size={12} />
            {protocol}
          </span>
        </div>
      </div>
      <div className="query-layout">
        <section className="panel query-builder">
          <div className="panel-title">
            <Filter size={15} />
            <h3>Filter conditions</h3>
            <span className="tag neutral">{entity.name}</span>
          </div>
          <div className="query-content">
            <div className="match-line">
              <span>Match</span>
              <Choice
                label="Condition matching"
                value={match}
                onChange={(v) => {
                  setMatch(v as 'all' | 'any')
                  setResults(null)
                }}
                items={[
                  { value: 'all', label: 'all conditions' },
                  { value: 'any', label: 'any condition' },
                ]}
              />
            </div>
            <div className="conditions">
              {conditions.map((c, i) => {
                const f = entity.fields.find((f) => f.name === c.field) ?? {
                  name: c.field,
                  type: 'unknown' as const,
                  description: 'Not in current metadata.',
                }
                return (
                  <div className="condition" key={c.id}>
                    <span className="condition-join">
                      {i ? (match === 'all' ? 'AND' : 'OR') : 'WHERE'}
                    </span>
                    <div className="condition-inputs">
                      <Choice
                        label={`Condition ${i + 1} field`}
                        value={c.field}
                        onChange={(field) =>
                          change(c.id, {
                            field,
                            operator: 'equals',
                            value:
                              entity.fields.find((f) => f.name === field)
                                ?.type === 'boolean'
                                ? 'true'
                                : '',
                          })
                        }
                        items={entity.fields
                          .filter(
                            (f) =>
                              f.name === c.field ||
                              !conditions.some(
                                (other) => other.field === f.name,
                              ),
                          )
                          .map((f) => ({ value: f.name, label: f.name }))}
                      />
                      <Choice
                        label={`Condition ${i + 1} operator`}
                        value={c.operator}
                        onChange={(v) =>
                          change(c.id, { operator: v as Condition['operator'] })
                        }
                        items={[
                          { value: 'equals', label: 'equals' },
                          ...(f.type === 'text'
                            ? [{ value: 'contains', label: 'contains' }]
                            : f.type === 'number'
                              ? [
                                  { value: 'greater', label: 'greater than' },
                                  { value: 'less', label: 'less than' },
                                ]
                              : []),
                        ]}
                      />
                      {f.type === 'boolean' ? (
                        <Choice
                          value={c.value || 'true'}
                          label={`Condition ${i + 1} value`}
                          onChange={(value) => change(c.id, { value })}
                          items={[
                            { value: 'true', label: 'true' },
                            { value: 'false', label: 'false' },
                          ]}
                        />
                      ) : (
                        <Input
                          aria-label={`Condition ${i + 1} value`}
                          type={
                            f.type === 'number'
                              ? 'number'
                              : f.type === 'date'
                                ? 'date'
                                : 'text'
                          }
                          placeholder="Enter a value…"
                          value={c.value}
                          onChange={(e) =>
                            change(c.id, { value: e.target.value })
                          }
                        />
                      )}
                      <IconButton
                        label={`Remove condition ${i + 1}`}
                        onClick={() => {
                          setConditions(
                            conditions.filter((other) => other.id !== c.id),
                          )
                          setResults(null)
                        }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button
              variant="ghost"
              className="add-condition"
              disabled={conditions.length === entity.fields.length}
              onClick={() => {
                const f = entity.fields.find(
                  (f) => !conditions.some((c) => c.field === f.name),
                )!
                setConditions([
                  ...conditions,
                  {
                    id: crypto.randomUUID(),
                    field: f.name,
                    operator: 'equals',
                    value: f.type === 'boolean' ? 'true' : '',
                  },
                ])
                setResults(null)
              }}
            >
              <Plus size={14} />
              Add condition
            </Button>
            <div className="query-options">
              <span>Return up to</span>
              <Choice
                label="Result limit"
                value={limit}
                onChange={(v) => {
                  setLimit(v)
                  setResults(null)
                }}
                items={['5', '10', '20', '50'].map((n) => ({
                  value: n,
                  label: `${n} records`,
                }))}
              />
            </div>
          </div>
          <div className="query-actions">
            <span>
              <span className="tiny-dot" />
              {workspace.profile.lab
                ? 'Local practice server'
                : 'Read-only server request'}
            </span>
            <Button
              onClick={() => void run()}
              disabled={
                invalid || !!compilation.error || !workspace.session || running
              }
            >
              <Play size={13} fill="currentColor" />
              {running ? 'Running…' : 'Run query'}
            </Button>
          </div>
        </section>
        <section className="query-preview">
          <div className="small-tabs">
            <button
              className={format === 'request' ? 'active' : ''}
              onClick={() => setFormat('request')}
            >
              <Braces size={14} />
              API request
            </button>
            <button
              className={format === 'fetch' ? 'active' : ''}
              onClick={() => setFormat('fetch')}
            >
              <Code2 size={14} />
              JavaScript
            </button>
          </div>
          <CodeBlock
            code={
              invalid
                ? '// Fix the filter values before running this query.'
                : format === 'request'
                  ? request
                  : fetchCode
            }
            filename={format === 'request' ? 'request.http' : 'request.ts'}
          />
          <div className="preview-note">
            <ArrowRight size={14} />
            <p>
              Built from the {protocol === 'Data API' ? 'layout' : 'entity set'}{' '}
              you selected.{' '}
              {publicPreview
                ? 'Run query evaluates the bundled synthetic records in this browser.'
                : 'Run query sends this request through the local service.'}
            </p>
          </div>
        </section>
      </div>
      {requestError && (
        <div className="error-banner" role="alert">
          {requestError}
        </div>
      )}
      {compilation.error && (
        <p className="form-error" role="alert">
          {compilation.error}
        </p>
      )}
      {running && (
        <Button
          variant="outline"
          onClick={() => {
            abortRef.current?.abort()
            setRunning(false)
          }}
        >
          Cancel query
        </Button>
      )}
      <section className="panel query-results">
        <div className="panel-title">
          <Braces size={15} />
          <h3>Results</h3>
          <span className="muted text-xs">
            {responseInfo
              ? `${responseInfo.elapsedMs} ms · ${responseInfo.found ?? 'unknown'} matching records`
              : 'Server response'}
          </span>
        </div>
        {results ? (
          <CodeBlock code={results} filename="results.json" downloadable />
        ) : (
          <EmptyState
            title="Your results will appear here"
            description="Connect, set your filters, and run a bounded read request."
          />
        )}
      </section>
      <p className="subtle-note">
        Queries use the selected API and account permissions. FileMaker behavior
        depends on field type, indexing, locale, and API capabilities.
      </p>
      {saveOpen && (
        <SaveRequestDialog
          key={saved?.updatedAt ?? 'new'}
          open={saveOpen}
          onOpenChange={setSaveOpen}
          query={{
            entity: entity.name,
            conditions,
            match,
            limit: Number(limit),
            offset: 0,
          }}
          existing={saved}
          onSaved={setSaved}
        />
      )}
    </>
  )
}
