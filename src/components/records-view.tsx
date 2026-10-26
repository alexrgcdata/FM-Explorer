import { publicPreview } from '@/lib/runtime'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Columns3,
  Download,
  LoaderCircle,
  RefreshCw,
  Search,
  Table2,
} from 'lucide-react'
import type { DataRow, Entity } from '@/lib/data'
import type { RecordPage } from '@/lib/contracts'
import { useWorkspace } from '@/lib/workspace'
import { downloadFile } from '@/lib/generators'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Choice, CodeBlock, EmptyState, IconButton, TypeIcon } from './shared'

function display(value: unknown) {
  return value === null
    ? 'null'
    : value === undefined
      ? '—'
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
}
export function RecordsView({
  entity,
  compact,
}: {
  entity: Entity
  compact: boolean
}) {
  const w = useWorkspace(),
    [sorting, setSorting] = useState<SortingState>([]),
    [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState(''),
    [status, setStatus] = useState(''),
    [debouncedStatus, setDebouncedStatus] = useState(''),
    [field, setField] = useState(
      entity.fields.find((f) => f.type === 'text' && !f.global)?.name ?? '',
    ),
    [visibility, setVisibility] = useState<VisibilityState>({}),
    [selected, setSelected] = useState<{ row: DataRow; meta?: unknown } | null>(
      null,
    ),
    [limit, setLimit] = useState(10),
    [pages, setPages] = useState<{ offset: number; cursor?: string }[]>([
      { offset: 0 },
    ]),
    [pageIndex, setPageIndex] = useState(0),
    [result, setResult] = useState<RecordPage | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0)
  const load = useRef(w.loadRecords),
    inspect = useRef(w.inspectRows)
  load.current = w.loadRecords
  inspect.current = w.inspectRows
  const textFields = entity.fields.filter(
      (f) => f.type === 'text' && !f.global,
    ),
    page = pages[pageIndex] ?? { offset: 0 }
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setDebouncedStatus(status)
      setPages([{ offset: 0 }])
      setPageIndex(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, status, field])
  const sort = sorting[0],
    signature = JSON.stringify({
      profile: w.profile.id,
      session: w.session?.id,
      entity: entity.name,
      field,
      search: debounced,
      status: debouncedStatus,
      sort,
      offset: page.offset,
      cursor: page.cursor,
      limit,
      refresh,
    })
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    if (!w.session) {
      setResult(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    const conditions = [
      ...(debounced && field
        ? [
            {
              id: 'search',
              field,
              operator: 'contains' as const,
              value: debounced,
            },
          ]
        : []),
      ...(debouncedStatus &&
      entity.fields.some((f) => f.name === 'Status') &&
      !(debounced && field === 'Status')
        ? [
            {
              id: 'status',
              field: 'Status',
              operator: 'equals' as const,
              value: debouncedStatus,
            },
          ]
        : []),
    ]
    void load
      .current(
        {
          entity: entity.name,
          conditions,
          match: 'all',
          offset: page.offset,
          limit,
          ...(sort
            ? {
                sort: { field: sort.id, direction: sort.desc ? 'desc' : 'asc' },
              }
            : {}),
          ...(page.cursor ? { cursor: page.cursor } : {}),
        },
        controller.signal,
      )
      .then((response) => {
        if (!active) return
        setResult(response)
        inspect.current(entity.name, response.rows, response.total)
      })
      .catch((error) => {
        if (active && !controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : 'Could not load records.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [signature])
  const columns = useMemo<ColumnDef<DataRow>[]>(
    () =>
      entity.fields.map((f) => ({
        id: f.name,
        accessorFn: (row) => row[f.name],
        header: f.name,
        enableSorting: !['container', 'json', 'unknown'].includes(f.type),
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined)
            return <span className="faint mono">{display(value)}</span>
          if (f.name === 'Status')
            return (
              <span
                className={`status-pill ${['Active', 'Paid', 'Delivered'].includes(String(value)) ? 'positive' : 'pending'}`}
              >
                <span />
                {display(value)}
              </span>
            )
          if (f.type === 'boolean')
            return (
              <span className={value === true ? 'green' : 'muted'}>
                {display(value)}
              </span>
            )
          return (
            <span
              className={
                f.key
                  ? 'record-id'
                  : f.type === 'number' || typeof value === 'object'
                    ? 'mono'
                    : ''
              }
            >
              {display(value)}
            </span>
          )
        },
      })),
    [entity.fields],
  )
  const table = useReactTable({
    data: result?.rows ?? [],
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: (updater) => {
      setSorting(updater)
      setPages([{ offset: 0 }])
      setPageIndex(0)
    },
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
  })
  function next() {
    if (!result?.hasNext) return
    const destination = {
      offset: page.offset + result.rows.length,
      ...(result.nextCursor ? { cursor: result.nextCursor } : {}),
    }
    setPages((current) => [...current.slice(0, pageIndex + 1), destination])
    setPageIndex(pageIndex + 1)
  }
  return (
    <>
      <div className="entity-heading">
        <div className="entity-icon">
          <Table2 size={22} />
        </div>
        <div>
          <div className="entity-name">
            <h2>{entity.name}</h2>
            <span className="tag neutral">
              {result?.total ?? entity.count ?? '—'} reported total
            </span>
          </div>
          <p>
            Server pagination and filters. Record values are kept in memory.
          </p>
        </div>
        <Button
          variant="outline"
          className="ml-auto"
          disabled={!result || loading}
          onClick={() =>
            downloadFile(
              `${entity.name}-page.json`,
              JSON.stringify(result?.rows ?? [], null, 2),
            )
          }
        >
          <Download size={14} />
          Export page
        </Button>
      </div>
      {!w.session ? (
        <div className="offline-banner">
          Reconnect to request records. Saved schema remains available.
        </div>
      ) : (
        <section className={`panel records-panel ${compact ? 'compact' : ''}`}>
          <div className="panel-toolbar record-toolbar">
            <div className="record-search-controls">
              {textFields.length > 0 && (
                <Choice
                  label="Record search field"
                  value={field}
                  onChange={setField}
                  items={textFields.map((f) => ({
                    value: f.name,
                    label: f.name,
                  }))}
                />
              )}
              <div className="search-input wide">
                <Search size={14} />
                <Input
                  aria-label="Search records"
                  disabled={!textFields.length}
                  placeholder="Search selected field…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="record-tools">
              {entity.fields.some((f) => f.name === 'Status') && (
                <Input
                  aria-label="Filter record status"
                  placeholder="Status equals…"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
              )}
              <IconButton
                label="Reload record page"
                disabled={loading}
                onClick={() => setRefresh((n) => n + 1)}
              >
                <RefreshCw size={14} />
              </IconButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 size={14} />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  {table.getAllColumns().map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(v)}
                      disabled={
                        c.getIsVisible() &&
                        table.getVisibleLeafColumns().length === 1
                      }
                    >
                      {c.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {loading && (
            <div className="record-loading" role="status">
              <LoaderCircle size={17} className="animate-spin" />
              Loading records…
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && (
            <>
              <div className="table-scroll">
                <table className="records-table">
                  <thead>
                    {table.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        <th className="index-col">#</th>
                        {group.headers.map((h) => (
                          <th key={h.id}>
                            <button
                              disabled={!h.column.getCanSort()}
                              onClick={h.column.getToggleSortingHandler()}
                            >
                              <TypeIcon
                                type={
                                  entity.fields.find(
                                    (f) => f.name === h.column.id,
                                  )!.type
                                }
                              />
                              {flexRender(
                                h.column.columnDef.header,
                                h.getContext(),
                              )}
                              {h.column.getIsSorted() === 'asc' ? (
                                <ArrowUp size={12} />
                              ) : h.column.getIsSorted() === 'desc' ? (
                                <ArrowDown size={12} />
                              ) : (
                                <ArrowDownUp size={11} className="faint" />
                              )}
                            </button>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row, i) => (
                      <tr
                        key={row.id}
                        onClick={() =>
                          setSelected({
                            row: row.original,
                            meta: result?.recordMeta?.[i],
                          })
                        }
                      >
                        <td>
                          <button
                            className="row-open"
                            aria-label={`Inspect record ${page.offset + i + 1}`}
                          >
                            {page.offset + i + 1}
                          </button>
                        </td>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result && !result.rows.length && (
                <EmptyState
                  title="No records found"
                  description="Change your filter or check this account’s record access."
                />
              )}
            </>
          )}
          <div className="record-pagination">
            <span className="muted">
              {result?.rows.length
                ? `${page.offset + 1}–${page.offset + result.rows.length}`
                : '0'}{' '}
              of {result?.found ?? 'unknown'} matching records
              {result ? ` · ${result.elapsedMs} ms` : ''}
            </span>
            <div>
              <Choice
                label="Rows per page"
                value={String(limit)}
                onChange={(value) => {
                  setLimit(Number(value))
                  setPages([{ offset: 0 }])
                  setPageIndex(0)
                }}
                items={[5, 10, 20, 50, 100].map((n) => ({
                  value: String(n),
                  label: `${n} per page`,
                }))}
              />
              <IconButton
                label="First page"
                disabled={!pageIndex || loading}
                onClick={() => setPageIndex(0)}
              >
                <ChevronsLeft size={15} />
              </IconButton>
              <IconButton
                label="Previous page"
                disabled={!pageIndex || loading}
                onClick={() => setPageIndex(pageIndex - 1)}
              >
                <ChevronLeft size={15} />
              </IconButton>
              <span className="page-number">Page {pageIndex + 1}</span>
              <IconButton
                label="Next page"
                disabled={!result?.hasNext || loading}
                onClick={next}
              >
                <ChevronRight size={15} />
              </IconButton>
            </div>
          </div>
        </section>
      )}
      <p className="subtle-note">
        {publicPreview
          ? 'Search filters synthetic records in this browser. Export saves only the current page.'
          : 'Search sends a contains filter for the selected text field. Counts are server-reported when available. Export saves only the returned page.'}
      </p>
      {result?.warnings.map((warning, i) => (
        <p className="subtle-note" key={i}>
          {warning}
        </p>
      ))}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="record-dialog">
          <DialogHeader>
            <DialogTitle>Record details</DialogTitle>
            <DialogDescription>
              {entity.name} · original payload values
              {selected?.meta ? ' and FileMaker record metadata' : ''}
            </DialogDescription>
          </DialogHeader>
          <CodeBlock
            code={JSON.stringify(
              selected?.meta
                ? { fieldData: selected.row, ...(selected.meta as object) }
                : (selected?.row ?? {}),
              null,
              2,
            )}
            filename="record.json"
            downloadable
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
