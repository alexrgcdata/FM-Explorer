import { useState } from 'react'
import {
  BookOpen,
  Code2,
  Download,
  FileCode2,
  FileJson,
  PlugZap,
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
  entities: options,
}: {
  entity: Entity
  protocol: Protocol
  ai?: boolean
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
          snapshot,
        )
      : generate(entity, kind, protocol, {
          profile,
          snapshot,
          auth: session?.auth,
        })
  const filename = `${all && kind === 'markdown' ? profile.database : entity.name.toLowerCase()}.${selected.extension}`
  return (
    <>
      <div className="entity-format-selector">
        <Choice
          label="Document format"
          value={kind}
          onChange={(value) => setKind(value as ExportKind)}
          items={tools.map((tool) => ({ value: tool.id, label: tool.title }))}
        />
      </div>
      <div className="panel generator-workspace">
        <div className="generator-toolbar">
          <span className="muted">{filename}</span>
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
                <strong>Include all inspected resources</strong>
                <small>
                  All resources, fields, and available relationship evidence
                </small>
              </span>
            </div>
            <Switch
              id="all-schema"
              aria-label="Include all inspected resources"
              checked={all}
              onCheckedChange={setAll}
            />
          </div>
        )}
        <CodeBlock code={code} filename={filename} />
      </div>
    </>
  )
}
