import { useState, type ReactNode } from 'react'
import {
  Check,
  Copy,
  Download,
  Braces,
  Hash,
  CalendarDays,
  ToggleLeft,
  Type,
  Clock3,
  FileQuestion,
  FileJson,
  Image,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { downloadFile } from '@/lib/generators'
import type { FieldType } from '@/lib/data'

export const typeIcons = {
  text: Type,
  number: Hash,
  date: CalendarDays,
  timestamp: Clock3,
  boolean: ToggleLeft,
  time: Clock3,
  container: Image,
  json: FileJson,
  unknown: FileQuestion,
}
export function TypeIcon({ type }: { type: FieldType }) {
  const Icon = typeIcons[type]
  return <Icon size={14} className={`type-icon type-${type}`} />
}

export function IconButton({
  label,
  children,
  onClick,
  className = '',
  disabled = false,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className={className}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
export function Choice({
  value,
  onChange,
  items,
  label,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  items: { value: string; label: string }[]
  label: string
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
    return true
  } catch {
    toast.error('Clipboard unavailable. Select and copy the text instead.')
    return false
  }
}
function Highlight({ text }: { text: string }) {
  return (
    <>
      {text
        .split(
          /("[^"\n]*"|'[^'\n]*'|\b(?:export|interface|type|const|return|GET|POST|true|false|string|number|boolean)\b|\/\/[^\n]*)/g,
        )
        .map((part, i) => (
          <span
            key={i}
            className={
              part.startsWith('//')
                ? 'syntax-comment'
                : /^['"]/.test(part)
                  ? 'syntax-string'
                  : /^(export|interface|type|const|return|GET|POST)$/.test(part)
                    ? 'syntax-keyword'
                    : /^(string|number|boolean|true|false)$/.test(part)
                      ? 'syntax-type'
                      : ''
            }
          >
            {part}
          </span>
        ))}
    </>
  )
}
export function CodeBlock({
  code = '',
  language,
  filename,
  downloadable = false,
}: {
  code: string
  language?: string
  filename?: string
  downloadable?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const resolvedLanguage =
    language ??
    (filename?.endsWith('.json')
      ? 'JSON'
      : filename?.endsWith('.md')
        ? 'Markdown'
        : filename?.endsWith('.http')
          ? 'HTTP'
          : 'TypeScript')
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>
          <Braces size={14} />
          {filename || resolvedLanguage}
        </span>
        <div>
          {downloadable && (
            <IconButton
              label="Download file"
              onClick={() =>
                downloadFile(filename ?? 'export.txt', code, 'text/plain')
              }
            >
              <Download size={14} />
            </IconButton>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (await copyText(code)) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              }
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <pre tabIndex={0} aria-label={`${resolvedLanguage} code preview`}>
        <code>
          {code.split('\n').map((line, i) => (
            <span className="code-line" key={i}>
              <span className="line-number" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <Highlight text={line} />
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="empty-state">
      <Braces size={27} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
