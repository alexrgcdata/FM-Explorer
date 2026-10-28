import { ArrowRight, BookOpen, X } from 'lucide-react'
import type { Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import { publicPreview } from '@/lib/runtime'

type Explanation = {
  title: string
  text: string
  try: string
  action: string
  next: Page
  terms: [string, string][]
}
const resource: [string, string] = [
  'Resource',
  'Something the API makes available. Data API exposes FileMaker layouts; OData exposes entity sets. A layout is a view onto a solution, not a complete inventory of its tables.',
]
const field: [string, string] = [
  'Field',
  'One named piece of information, like Email or OrderDate. In SQL, this is a column. Its type describes what kind of value it can hold.',
]
const record: [string, string] = [
  'Record',
  'One item in the data, such as one customer. In SQL, this is a row.',
]
const schema: [string, string] = [
  'Schema',
  'The structure available through this connection: resources, fields, types, and exposed links. It describes the data; it is not a copy or backup of all records.',
]
const explanations: Record<Page, Explanation> = {
  overview: {
    title: 'Your starting point',
    text: 'This page summarizes the selected database. Start with its structure, then look at records and the links between resources.',
    try: 'Choose Explore fields & types, or select a resource in the resource list. You can return here using Dashboard.',
    action: 'Explore the structure',
    next: 'schema',
    terms: [
      [
        'Database',
        'An organized collection of information. A table groups similar records; each record has fields. In a relational database, records can be linked using identifiers.',
      ],
      [
        'API',
        'A way for one application to ask another system for information. FileMaker Data API and OData are two ways this app can read a hosted solution.',
      ],
      schema,
      resource,
    ],
  },
  'entity-overview': {
    title: 'Understand the selected resource',
    text: 'This overview brings together its identity, reported record count, exposed links, saved checks, and developer notes. Unknown business meaning stays unknown until someone documents it.',
    try: 'Open Schema to inspect fields. Select a connected entity to explore it.',
    action: 'Inspect its fields',
    next: 'schema',
    terms: [resource, field, record],
  },
  schema: {
    title: 'Read the structure before the data',
    text: 'Each row here is a field definition, not a customer or an order. The type tells you whether values are text, numbers, dates, or another kind of data.',
    try: 'Select a field name for its details. Then browse records to see how those fields appear in actual rows.',
    action: 'Browse records',
    next: 'records',
    terms: [
      field,
      [
        'Key',
        'A field identified as a key in the available metadata. It helps identify a record. Do not assume every field ending in ID is a declared key.',
      ],
      [
        'Nullable',
        'Whether a field can have no value. Unknown means the API did not tell us.',
      ],
    ],
  },
  records: {
    title: 'Look at a page of data',
    text: 'Each row is a record; each column is a field. Search, sorting, and pagination help inspect a small part of the data without loading the entire database.',
    try: 'Inspect a row, choose a text search field, or move to the next page. Export page downloads only the current returned page.',
    action: 'See its relationships',
    next: 'relationships',
    terms: [
      record,
      field,
      [
        'Pagination',
        'Dividing results into smaller pages. A returned page and a reported total are different things.',
      ],
    ],
  },
  relationships: {
    title: 'Follow connections between resources',
    text: 'Boxes represent resources; lines show relationships exposed or declared by the available source. Real solutions can have additional relationships this API does not reveal.',
    try: 'Select a box to highlight its connections. Use the path finder to trace a route between resources.',
    action: 'Build a read query',
    next: 'query',
    terms: [
      resource,
      [
        'Relationship',
        'A connection between resources. Arrows show the source and target of the available evidence; they do not prove business ownership or parent/child rules.',
      ],
    ],
  },
  api: {
    title: 'See how an integration asks for data',
    text: 'This is a request template for the selected resource. Merely viewing or copying it does not run a request.',
    try: 'Choose Build a read query to add conditions, or generate types and schemas for another developer.',
    action: 'Build a read query',
    next: 'query',
    terms: [
      [
        'API',
        'A way for software to ask another system for information. This app supports FileMaker Data API and OData.',
      ],
      ['Endpoint', 'The address of a particular API operation or resource.'],
    ],
  },
  query: {
    title: 'Ask a focused question',
    text: 'A query describes which records you want. Conditions such as Status equals Active narrow the result. All conditions means AND; any condition means OR.',
    try: 'Choose a field and comparison, enter a value, then Run query. Save request lets you keep that query and describe what its response should contain.',
    action: 'Review saved checks',
    next: 'requests',
    terms: [
      [
        'Filter',
        'A condition that selects matching records. It does not edit or delete records.',
      ],
      [
        'Read request',
        'An instruction to retrieve data. The request shown here follows the selected API format.',
      ],
    ],
  },
  requests: {
    title: 'Keep the expectations an integration relies on',
    text: 'A saved check combines a read query with expectations about its response. Passing means that bounded response met those expectations, not that the whole database is correct.',
    try: 'Create a request in Queries, select expected fields and types, then run it. Empty results may be inconclusive rather than a pass.',
    action: 'Create a read check',
    next: 'query',
    terms: [
      [
        'Expectation',
        'Something you require in a result: a field, type, minimum row count, or response-time limit.',
      ],
      [
        'Inconclusive',
        'The available response could not establish whether an expectation passed.',
      ],
    ],
  },
  history: {
    title: 'Compare what was visible at different times',
    text: 'Schema history keeps dated structural inspections. A missing field may reflect access or partial discovery, so review the scope before treating it as a deletion.',
    try: 'Choose two versions and review their differences and affected saved requests. Capturing another version does not modify FileMaker.',
    action: 'Review saved checks',
    next: 'requests',
    terms: [
      [
        'Snapshot',
        'A saved inspection of API-visible structure. It cannot restore the database or recover deleted data.',
      ],
      [
        'Baseline',
        'The earlier inspection you use as a reference when comparing changes.',
      ],
    ],
  },
  developer: {
    title: 'Turn inspected structure into useful code',
    text: 'Choose a document format to generate TypeScript, JSON Schema, OpenAPI read snippets, or a Postman collection. These exports describe the inspected scope.',
    try: 'Select a format and review it before copying or downloading. Use Handoff when you want a package with context and notes as well.',
    action: 'Prepare a handoff',
    next: 'handoff',
    terms: [
      [
        'TypeScript interface',
        'A description of the shape of a record for TypeScript code. It is not the record data.',
      ],
      [
        'JSON Schema',
        'A machine-readable description of a JSON value’s expected structure.',
      ],
    ],
  },
  ai: {
    title: 'Give a developer or agent a documented starting point',
    text: 'Context combines observed structure with developer-authored meanings. Draft notes stay separate from confirmed notes; this screen does not call an AI service.',
    try: 'Add field meanings or workflow guidance, review the context, then download it. A generated MCP definition is a template, not a running agent or server.',
    action: 'Prepare a full handoff',
    next: 'handoff',
    terms: [
      [
        'AI context',
        'Documentation an assistant can use as reference. It does not grant database access or establish unknown business rules.',
      ],
      [
        'MCP tool definition',
        'A description of a possible tool. It still needs an authorized implementation and server to run.',
      ],
    ],
  },
  handoff: {
    title: 'Package knowledge for the next person',
    text: 'Select the resources, saved checks, and developer notes needed for a particular integration. Preview the scope and download a portable ZIP.',
    try: 'Confirm the selected resources and review notes and filter values. Credentials and record rows are excluded; filter values are redacted by default.',
    action: 'Review generated documents',
    next: 'developer',
    terms: [
      [
        'Export',
        'A file you download from this app. It is an output to review or share, not a file you must upload to connect.',
      ],
      [
        'Handoff',
        'A package of schema, examples, and documentation for another developer or agent. It is not a FileMaker backup.',
      ],
    ],
  },
}

export function ScreenGuide({
  page,
  onNavigate,
  onConnect,
}: {
  page: Page
  onNavigate: (page: Page) => void
  onConnect: () => void
}) {
  const w = useWorkspace()
  if (!w.screenGuidance) return null
  const info = explanations[page]
  const needsConnection = !w.snapshot || (info.next === 'records' && !w.session)
  return (
    <aside className="screen-guide" aria-label={`Screen guide: ${info.title}`}>
      <div className="screen-guide-heading">
        <BookOpen size={17} />
        <h2>{info.title}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide screen explanations"
          onClick={() => void w.setScreenGuidance(false)}
        >
          <X size={16} />
        </Button>
      </div>
      <p>{info.text}</p>
      <p className="screen-guide-try">
        <strong>Try this:</strong> {info.try}
      </p>
      <div className="screen-guide-bottom">
        <details>
          <summary>Explain the terms</summary>
          <dl>
            {info.terms.map(([term, meaning]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
        <button
          className="quiet-link"
          onClick={() =>
            needsConnection ? onConnect() : onNavigate(info.next)
          }
        >
          {needsConnection
            ? w.snapshot
              ? 'Connect to read records'
              : 'Choose a connection'
            : info.action}
          <ArrowRight size={14} />
        </button>
      </div>
      {page === 'overview' && (
        <details className="screen-guide-files">
          <summary>Do I need to upload database files?</summary>
          <p>
            No. For a real connection, you enter the HTTPS server address,
            hosted database name, and an authorized account or token. This app
            does not accept a FileMaker .fmp12 file to discover its schema.
            Exports are files you download after exploring.{' '}
            {publicPreview
              ? 'This website preview uses bundled synthetic data; real connections require the local app.'
              : w.profile.lab
                ? 'The selected lab uses synthetic example data, so you do not need credentials to try it.'
                : 'A hosted database and an account with access to the selected API are required.'}
          </p>
        </details>
      )}
    </aside>
  )
}
