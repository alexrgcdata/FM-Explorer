import { useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  Code2,
  Download,
  FileCode2,
  FileJson,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'
import type { Entity, Protocol } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import {
  allMarkdown,
  downloadFile,
  generate,
  type ExportKind,
} from '@/lib/generators'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Choice, CodeBlock } from './shared'

const devTools = [
  {
    id: 'typescript',
    title: 'TypeScript',
    subtitle: 'Typed interfaces',
    icon: Code2,
    extension: 'ts',
  },
  {
    id: 'jsonschema',
    title: 'JSON Schema',
    subtitle: 'Structured validation',
    icon: FileJson,
    extension: 'schema.json',
  },
  {
    id: 'openapi',
    title: 'OpenAPI',
    subtitle: 'API specification snippet',
    icon: FileCode2,
    extension: 'openapi.json',
  },
  {
    id: 'postman',
    title: 'Postman',
    subtitle: 'Ready-to-import collection',
    icon: Terminal,
    extension: 'postman.json',
  },
] as const
const aiTools = [
  {
    id: 'markdown',
    title: 'AI context',
    subtitle: 'Schema documentation',
    icon: Sparkles,
    extension: 'md',
  },
  {
    id: 'mcp',
    title: 'MCP definitions',
    subtitle: 'Read tool templates',
    icon: PlugZap,
    extension: 'mcp.json',
  },
] as const
export function GenerateView({
  entity,
  protocol,
  ai = false,
  onEntity,
  entities: options,
}: {
  entity: Entity
  protocol: Protocol
  ai?: boolean
  onEntity: (name: string) => void
  entities: Entity[]
}) {
  const { profile, snapshot, relationships, session } = useWorkspace()
  const [kind, setKind] = useState<ExportKind>(ai ? 'markdown' : 'typescript')
  const [all, setAll] = useState(false)
  const tools = ai ? aiTools : devTools
  const selected = tools.find((t) => t.id === kind) ?? tools[0]
  const code =
    ai && all && kind === 'markdown'
      ? allMarkdown(
          protocol,
          options,
          relationships,
          profile.database,
          snapshot?.source,
        )
      : generate(entity, kind, protocol, {
          profile,
          snapshot,
          auth: session?.auth,
        })
  const filename = `${all && kind === 'markdown' ? profile.database : entity.name.toLowerCase()}.${selected.extension}`
  return (
    <>
      <div className="view-intro">
        <div>
          <h2>
            {ai
              ? 'Give your agents the full picture.'
              : 'Less boilerplate. More building.'}
          </h2>
          <p>
            {ai
              ? 'Clear, structured context for your next AI-powered integration.'
              : 'Turn your schema into a useful starting point for your integration.'}
          </p>
        </div>
        <span className="tag neutral">
          <Braces size={12} />
          Schema-powered
        </span>
      </div>
      <div className={`generator-options ${ai ? 'two' : ''}`}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`generator-card ${kind === tool.id ? 'active' : ''}`}
            onClick={() => setKind(tool.id)}
          >
            <span className="tool-icon">
              <tool.icon size={20} />
            </span>
            <strong>{tool.title}</strong>
            <span>{tool.subtitle}</span>
            {kind === tool.id && (
              <Check size={14} className="selection-check" />
            )}
          </button>
        ))}
      </div>
      <div className="panel generator-workspace">
        <div className="generator-toolbar">
          <div>
            <span className="muted">
              {protocol === 'Data API' ? 'Layout' : 'Entity set'}
            </span>
            <Choice
              label="Export resource"
              value={entity.name}
              onChange={onEntity}
              items={options.map((e) => ({ value: e.name, label: e.name }))}
            />
          </div>
          <Button
            onClick={() =>
              downloadFile(
                filename,
                code,
                selected.extension === 'md'
                  ? 'text/markdown'
                  : selected.extension === 'ts'
                    ? 'text/typescript'
                    : 'application/json',
              )
            }
          >
            <Download size={14} />
            Download {selected.extension === 'ts' ? 'interface' : 'file'}
          </Button>
        </div>
        {ai && kind === 'markdown' && (
          <div className="export-option">
            <div>
              <BookOpen size={16} />
              <span>
                <strong>Include the full solution</strong>
                <small>
                  All resources, fields, and available relationship evidence
                </small>
              </span>
            </div>
            <Switch
              id="all-schema"
              aria-label="Include the full solution"
              checked={all}
              onCheckedChange={setAll}
            />
          </div>
        )}
        <CodeBlock code={code} filename={filename} />
      </div>
      <div className="generator-notes">
        <div>
          <ShieldCheck size={19} />
          <span>
            <strong>{ai ? 'Private by default' : 'Generated locally'}</strong>
            <p>
              {ai
                ? 'No AI service is called. No record values or credentials are included.'
                : 'No external services. Exports use the inspected metadata.'}
            </p>
          </span>
        </div>
        <div>
          <ArrowUpRight size={19} />
          <span>
            <strong>
              {kind === 'mcp'
                ? 'A definition is a starting point'
                : 'Made to be adapted'}
            </strong>
            <p>
              {kind === 'mcp'
                ? 'A working MCP server needs handlers, authentication, and validation.'
                : 'Verify types and requests against your live endpoint when connected.'}
            </p>
          </span>
        </div>
      </div>
    </>
  )
}
