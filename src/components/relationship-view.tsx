import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowRight,
  ArrowUpRight,
  KeyRound,
  Link2,
  Route,
  Table2,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import type { Relationship } from '@/lib/contracts'
import { Button } from './ui/button'
import { Choice, TypeIcon } from './shared'

type TableNode = Node<{ entityName: string }, 'table'>
function SchemaNode({ data, selected }: NodeProps<TableNode>) {
  const { entities } = useWorkspace()
  const entity = entities.find((e) => e.name === data.entityName)!
  return (
    <div className={`graph-table ${selected ? 'focused' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="graph-table-title">
        <Table2 size={15} />
        <strong>{entity.name}</strong>
        <span>{entity.fields.length}</span>
      </div>
      <div className="graph-fields">
        {entity.fields.slice(0, 4).map((f) => (
          <div key={f.name}>
            <TypeIcon type={f.type} />
            <span>{f.name}</span>
            {f.key ? (
              <KeyRound size={11} className="amber" />
            ) : f.reference ? (
              <Link2 size={11} className="purple" />
            ) : (
              <small>{f.type}</small>
            )}
          </div>
        ))}
      </div>
      <div className="graph-table-foot">
        {entity.count ?? '—'} records{' '}
        <span>+{Math.max(0, entity.fields.length - 4)} fields</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
const nodeTypes = { table: SchemaNode }
const positions = [
  { x: 30, y: 60 },
  { x: 380, y: 60 },
  { x: 730, y: 60 },
  { x: 730, y: 370 },
  { x: 380, y: 370 },
  { x: 30, y: 370 },
]
function findPath(
  from: string,
  to: string,
  direction: string,
  relationships: Relationship[],
): string[] {
  const queue = [[from]],
    visited = new Set([from])
  while (queue.length) {
    const path = queue.shift()!,
      end = path.at(-1)!
    if (end === to) return path
    const next = relationships.flatMap((r) => [
      ...(r.source === end && direction !== 'upstream' ? [r.target] : []),
      ...(r.target === end && direction !== 'downstream' ? [r.source] : []),
    ])
    for (const name of next)
      if (!visited.has(name)) {
        visited.add(name)
        queue.push([...path, name])
      }
  }
  return []
}
export default function RelationshipView({
  initialEntity,
  onOpen,
}: {
  initialEntity: string
  onOpen: (name: string) => void
}) {
  const { entities, relationships } = useWorkspace()
  const initialNodes: TableNode[] = entities.map((entity, i) => ({
    id: entity.name,
    type: 'table',
    position:
      i < positions.length
        ? positions[i]
        : { x: (i % 3) * 350 + 30, y: Math.floor(i / 3) * 310 + 60 },
    data: { entityName: entity.name },
  }))
  const [focused, setFocused] = useState<string | null>(initialEntity)
  const [from, setFrom] = useState(initialEntity)
  const [to, setTo] = useState(
    entities.find((e) => e.name !== initialEntity)?.name ?? initialEntity,
  )
  const [direction, setDirection] = useState('any')
  const [path, setPath] = useState<string[] | null>(null)
  const [orphansOnly, setOrphansOnly] = useState(false)
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [flow, setFlow] = useState<ReactFlowInstance<TableNode> | null>(null)
  useEffect(() => {
    if (!flow || !canvasRef.current) return
    const observer = new ResizeObserver(() => {
      void flow.fitView({ padding: 0.15 })
    })
    observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [flow])
  const connected = useMemo(
    () =>
      new Set(
        relationships
          .filter((r) => r.source === focused || r.target === focused)
          .flatMap((r) => [r.source, r.target]),
      ),
    [focused],
  )
  const orphans = entities
    .filter(
      (e) =>
        !relationships.some((r) => r.source === e.name || r.target === e.name),
    )
    .map((e) => e.name)
  const displayNodes = nodes.map((n) => ({
    ...n,
    selected: path?.includes(n.id) || n.id === focused,
    className: orphansOnly
      ? orphans.includes(n.id)
        ? ''
        : 'dimmed-node'
      : path
        ? path.includes(n.id)
          ? ''
          : 'dimmed-node'
        : focused && !connected.has(n.id) && n.id !== focused
          ? 'dimmed-node'
          : '',
  }))
  const edges = relationships.map((r, i) => {
    const inPath = path?.some(
      (name, index) =>
        index < path.length - 1 &&
        ((name === r.source && path[index + 1] === r.target) ||
          (name === r.target && path[index + 1] === r.source)),
    )
    const active =
      !orphansOnly &&
      (path ? inPath : !focused || r.source === focused || r.target === focused)
    return {
      id: `edge-${i}`,
      source: r.source,
      target: r.target,
      label: r.field,
      type: 'smoothstep',
      animated: !!active && (!!focused || !!path),
      style: {
        stroke: active ? 'var(--primary)' : 'var(--graph-edge)',
        strokeWidth: active && path ? 2 : 1.4,
        opacity: active ? 0.8 : 0.2,
      },
      labelStyle: { fill: 'var(--muted-foreground)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--background)' },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    }
  })
  function reset() {
    setFocused(null)
    setPath(null)
    setOrphansOnly(false)
  }
  const choices = entities.map((e) => ({ value: e.name, label: e.name }))
  return (
    <>
      <div className="view-intro">
        <div>
          <h2>See how everything connects.</h2>
          <p>
            Select a table to highlight its relationships. Drag to arrange your
            view.
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          Show all relationships
        </Button>
      </div>
      <section className="panel relationship-panel">
        <div className="graph-pathbar">
          <span>
            <Route size={15} />
            Path finder
          </span>
          <Choice
            label="Path start resource"
            value={from}
            onChange={(v) => {
              setFrom(v)
              setPath(null)
            }}
            items={choices}
          />
          <ArrowRight size={13} className="faint path-arrow" />
          <Choice
            label="Path end resource"
            value={to}
            onChange={(v) => {
              setTo(v)
              setPath(null)
            }}
            items={choices}
          />
          <Choice
            label="Path direction"
            value={direction}
            onChange={(v) => {
              setDirection(v)
              setPath(null)
            }}
            items={[
              { value: 'any', label: 'Any direction' },
              { value: 'downstream', label: 'Downstream' },
              { value: 'upstream', label: 'Upstream' },
            ]}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFocused(null)
              setOrphansOnly(false)
              setPath(findPath(from, to, direction, relationships))
            }}
          >
            Find path
          </Button>
        </div>
        {path && (
          <div className="path-result" role="status">
            {path.length ? (
              <>
                <Route size={13} />
                {path.join(' → ')}
                <span>
                  {Math.max(0, path.length - 1)} hops ·{' '}
                  {direction === 'any' ? 'undirected' : direction}
                </span>
              </>
            ) : (
              'No path exists in the selected direction.'
            )}
          </div>
        )}
        <div className="graph-canvas" ref={canvasRef}>
          <ReactFlow
            onInit={setFlow}
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => {
              setFocused(node.id)
              setPath(null)
              setOrphansOnly(false)
            }}
            onNodeDoubleClick={(_, node) => onOpen(node.id)}
            onPaneClick={reset}
            nodesConnectable={false}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.25}
            maxZoom={1.5}
            colorMode="dark"
            proOptions={{ hideAttribution: false }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="var(--graph-dot)"
              gap={20}
              size={1}
            />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor="var(--graph-edge)"
              maskColor="var(--graph-mask)"
              pannable
              zoomable
            />
          </ReactFlow>
          {orphansOnly && (
            <div className="orphan-message" role="status">
              {orphans.length
                ? `${orphans.length} resources have no exposed connections. This does not prove they have no FileMaker relationships.`
                : 'Every resource has a connection in the available evidence.'}
            </div>
          )}
        </div>
        <div className="graph-footer">
          <span>
            <span className="legend-line" />
            {relationships.length} relationships · inspected evidence
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOrphansOnly(!orphansOnly)
              setFocused(null)
              setPath(null)
            }}
          >
            {orphansOnly ? 'Show connected' : 'Show unlinked'}
            <span className="tag neutral">{orphans.length}</span>
          </Button>
          {focused && (
            <Button variant="ghost" size="sm" onClick={() => onOpen(focused)}>
              Explore {focused}
              <ArrowUpRight size={13} />
            </Button>
          )}
        </div>
      </section>
      <div className="info-banner">
        <Link2 size={16} />
        <p>
          These connections come from available evidence. Arrows denote the
          source → target. Path finding uses the selected direction; graphs show
          only exposed or explicitly declared relationships.
        </p>
      </div>
    </>
  )
}
