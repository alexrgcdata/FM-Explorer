# FM API Explorer

React/TypeScript developer workbench with neutral dark surfaces and orange accents, shadcn/Tailwind, an IndexedDB workspace, and a local Node service for FileMaker API requests.

**Created and maintained by Alex Seidler** · [alex@rgcdata.com](mailto:alex@rgcdata.com) · [GitHub](https://github.com/alexrgcdata)

FM API Explorer helps FileMaker developers, web developers, and AI/MCP builders understand the API-facing structure of a solution, explore records, test integration expectations, and generate useful documentation and code artifacts.

## Why use it?

**Understand your FileMaker API. Review changes. Hand off with confidence.**

FM API Explorer is an integration workbench for FileMaker consultants, web developers, and developers preparing context for agents. Inspect what a connection exposes, save representative read requests and expectations, compare dated schema inspections, and hand another developer a portable package with schema, types, API examples, and reviewed notes.

For example, a website expects an Email field. After a solution update, compare the API-visible schema, review the saved requests referencing Email, and rerun their checks. Package the inspected structure and developer-confirmed meanings for the person maintaining that website. The intended benefit is less repeated discovery, testing, and handoff preparation; time savings and customer demand still need real-solution trials.

The current release is an early local workbench validated against synthetic OData/Data API labs. Real FileMaker Server/Cloud acceptance is pending. Schema history documents changes and cannot restore a database. A handoff package provides context and read scaffolding; it does not establish that an agent understands every business rule.

## Start

Requires Node.js 24 or newer. Open `Start FM API Explorer.cmd`, or run:

```powershell
git clone https://github.com/alexrgcdata/FM-Explorer.git
cd FM-Explorer
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:4186/](http://127.0.0.1:4186/). Keep the service running while using the app. Nothing is deployed or published. Opening the HTML directly is unsupported. `npm run preview` serves static files only and cannot replace `npm start` for the connected application.

For UI development, keep `npm start` running and use `npm run dev` in another terminal. Vite runs on port 5186 and proxies `/api` to the service. Ports/origins are deliberately bounded; changing them requires matching configuration updates.

## Try the local database

1. Select **Local FileMaker Lab** (Data API) or **Local OData Lab**.
2. Click **Connect local lab**, then **Connect & discover**. No real account is needed.
3. Inspect the discovered schema, browse records, filter/sort pages, execute queries, and export integration artifacts.
4. Use **Connections** to test, disconnect, switch, and inspect history.

The lab is a protocol simulator containing six resources, 42 fields, five declared fixture relationships, and 104 synthetic records. It is not FileMaker Server and has no real customer data. OData intentionally returns at most seven rows per server page to exercise continuation handling. Data API represents boolean-like fixture fields as numeric values, while OData exposes its native Boolean type.

## Saved requests and response checks

See [roadmap.md](roadmap.md) for the delivery sequence. Step 1 is available under **Saved requests**. In **Query builder**, set your filters, click **Save request**, and choose the fields/types/null rules, minimum returned rows, and optional upstream response-time limit your integration expects. Save up to 100 requests per connection; run one or run the suite sequentially. A request error stops the suite. Cancel stops waiting for further reads.

Definitions and the latest 200 result summaries across connections persist in IndexedDB v2. Edits increment the definition revision and require a new run. Earlier results remain in history. No returned row values or authentication are stored in the check summaries. Saved query filter values are stored locally and may contain private data.

Export creates versioned JSON request definitions and summaries, with filter values redacted by default and `requiresFilterValues` marking definitions needing those values again. This release does not import or automatically execute exported definitions. Empty results make selected field checks inconclusive; a minimum-row failure still fails. Checks cover the returned page, not every record or a FileMaker backup.

## Schema history and comparisons

Open **Schema history**. Connecting or selecting **Capture current schema** preserves an inspection; choose earlier/later versions to compare resources, field names, normalized/native types, nullability, keys, indexes, and exposed navigation. History retains the latest 50 versions per connection. Older snapshots migrate into a baseline when IndexedDB upgrades to v3.

The comparison lists saved requests whose conditions, sorting, or field expectations reference changed metadata. **Review saved check** opens the matching request for manual review and rerunning. Comparisons do not execute queries automatically. **Export comparison** downloads JSON containing both schema versions, differences, scope notes, and affected-request references; it excludes record rows, saved query bodies/filter values, and authentication.

**Preview change example** is available for local lab connections. It illustrates an added AccountTier field, a missing Email field, and a changed FullName type. This example does not modify the lab, saved history, or a real database.

Missing metadata from partial discovery is marked unknown. A resource no longer exposed is not proof of deletion; account permissions can change visibility. Account identity/privileges are not fingerprinted, and migrated baselines lack saved target-host details. Versions from different known targets, protocols, databases, API versions, or metadata sources are rejected. Renames appear as missing/new names. Counts, sample records, descriptions, raw payloads, and timestamps do not produce structural changes. These are schema inspections, not backups or restore points.

## Integration and AI handoff packages

Open **Handoff package**, choose resources and saved requests, and add developer knowledge. Notes can describe a resource/field, status meanings, workflows, or agent constraints. They persist in IndexedDB v4. New notes are drafts; confirmation is an explicit human assertion. Editing text, category, or scope resets confirmation. Notes survive clearing schema history and are removed with their connection profile.

**Preview files** shows the generated documents. **Download handoff ZIP** creates a local archive containing:

- `manifest.json`: version, source/inspection/export times, resource-to-file mapping, scope/limitations, privacy flags, and SHA-256 file hashes (excluding the manifest itself).
- `schema.json`, separate `types/*.ts` modules and `schemas/*.json`: selected structural metadata, TypeScript, and JSON Schemas.
- `CONTEXT.md`, `AGENT-CONTEXT.md`, `knowledge.json`: observed metadata separated from human-confirmed knowledge and unverified drafts. No AI service is called.
- `requests.json`: selected saved read/check definitions and historical summaries, without original error bodies.
- `api-examples.json`, `read.mjs`, `README.md`: native bounded read examples, a dependency-free Node 24 runner, and authentication/setup guidance.

Credentials, returned records, and raw response bodies are not copied from the workspace. Saved filter values are redacted by default. Enabling **Include reviewed filter values** starts with empty inputs; enter approved values or explicitly select **Use saved value** per filter. Partially redacted requests have no compiled request spec, and the runner refuses to send them. It never drops their filters to run a broader query. Separate resource examples are unfiltered bounded reads of at most 10 rows.

The runner can list examples without network access. A user-selected read uses `FM_HOST` and `FM_AUTHORIZATION` supplied locally, rejects redirects, and has a 20-second timeout / 8 MiB response cap. It prints native JSON to the user's terminal, preserving numeric literals, and does not follow continuation pages or evaluate the saved check expectations. The package is capped at 5 MiB of source text; reduce scope if exceeded. Hashes detect changed file contents and do not establish trust or authorship. Human-authored notes, query descriptions, schema names, and host/database metadata may be private; review the preview before sharing.

These exports document an integration; they cannot restore a FileMaker database. External FileMaker acceptance remains pending.

## Connect a real FileMaker endpoint

Use **Add real endpoint** or **Connections → Add connection**. Enter an HTTPS host only, the exact hosted database name, and a protocol. API paths are constructed by the connector.

- Data API: FileMaker Server account/password or an existing Data API session token. API version is selectable.
- OData: FileMaker Server account/password or a FileMaker Cloud FMID token obtained through the appropriate external authentication flow.
- Use an account limited to the required metadata/record reads with the relevant API privileges. This application offers no record writes, uploads, or script execution. Existing FileMaker layout triggers/server behavior can still have server-side effects; review them when using a real solution.

Enter credentials locally in the app, never in chat. Authorization remains in local-service memory. Data API sessions created by the service are logged out on disconnect where possible; externally supplied tokens are forgotten locally without revoking the caller's session. Sessions expire after 15 minutes of inactivity. Reauthenticate after restarting the service. External Server/Cloud interoperability has not been verified against a real endpoint yet.

## Local storage and privacy

IndexedDB database: `fm-api-explorer`, version 4.

| Store | Contents |
| --- | --- |
| profiles | Nonsecret name, host, database, protocol, version |
| snapshots | Inspected schema, raw metadata, source/time, qualified counts, warnings; no record rows |
| schemaVersions | Up to 50 dated structural inspections per connection; no rows, raw payloads, or record counts |
| knowledgeNotes | Up to 200 developer-authored notes per connection, marked draft or human-confirmed |
| preferences | Active connection, favorites, compact rows, reduced motion |
| activity | Last 200 connection/query events; no query literal values, passwords, or tokens |
| requests | Saved read queries, filter values, expectations, and definition revisions |
| checkRuns | Latest 200 response-check summaries across connections; no returned record values |

The old nonsecret localStorage profile list migrates once. Browser storage is specific to the exact origin; localhost and 127.0.0.1, or different ports, use separate databases. IndexedDB is not an encrypted credential vault. Schema names, native metadata, and host names may themselves be private. Use Settings to clear saved snapshots, or remove a custom profile and its associated schema/history in Connections. Clearing browser site data removes this workspace.

Record pages and authorization are memory-only. Refreshing the page restores profiles/snapshots and asks the service which sessions remain active. Disconnected schema exploration works while the local app service runs. No external AI service or telemetry is called.

## Implemented

- Real connection/profile manager, auth dialog, connection testing, measured check times, disconnection, and persistent history.
- Data API layout discovery and field metadata, bounded pagination/sort/find, FileMaker errors, and separate record/portal identity metadata.
- OData metadata types, keys, navigation properties/bindings, counts, filters/sorts, and origin/resource-checked server continuation URLs.
- Dynamic schema tree/search, favorites, comparison, field details, source endpoints, and explicit unknown metadata.
- TanStack record browser with server filtering/sorting/paging, columns, raw JSON inspection, retry, and page export.
- Visual AND/OR query builder, request/fetch previews, actual server execution, response JSON, downloads, and cancellation of waiting in the client. An already-sent server read may still finish within the bounded request timeout.
- React Flow graph based on available evidence, path finding, navigation directions, and unlinked-resource inspection. Lack of exposed edges does not prove a table has no relationships.
- Schema-based TypeScript, JSON Schema, OpenAPI read snippets, Postman collections, Markdown context, and MCP definition templates, with credential placeholders.
- Keyboard search, responsive navigation, persisted display preferences, unknown-count handling, offline-schema states, and storage errors.

## Accuracy boundaries

Data API resources are layouts, not a complete base-table inventory. It does not expose the complete FileMaker relationship graph. The lab's Data API edges are explicitly declared fixture enrichment; OData edges come from navigation metadata. No key join or cardinality is guessed for a remote Data API connection.

Counts are shown only when returned by a server read, with coverage indicated. Decimal and unsafe integer JSON values are preserved as strings. Missing nullability/index/uniqueness remains unknown. Discovery is bounded to 250 resources and a metadata time budget; partial responses include warnings. OData inherited types currently produce a partial-schema warning rather than silently claiming complete inherited fields.

Generated OpenAPI documents are read-operation snippets, not an entire API contract. MCP output defines tools; a runnable MCP server is not implemented. OpenBridge connection support needs an agreed endpoint/auth/schema contract. No arbitrary request proxy, SQL runner, schema edits, record writes, or FileMaker scripts are provided.

## Possible future additions

Schema history and integration/AI handoff packages are available now. The next milestone is real-solution validation. See [roadmap.md](roadmap.md) for sequencing and acceptance criteria. Potential additions include:

- Verified MCP and OpenBridge adapters, with explicit permissions and reviewed tool definitions.
- Richer schema import, including possible FileMaker DDR support.
- Focused React starters, typed API clients, and hooks generated from selected resources.
- Real FileMaker Server/Cloud compatibility coverage, easier desktop installation, and possible team workflows.

These are planned or exploratory capabilities, not promises of functionality already available. Schema snapshots document inspected structure; they are not FileMaker database backups or restore files.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

Tests exercise both local protocol flows, session ownership, guards, empty finds, native errors, continuation pagination, schema parsing, precision, query escaping, and IndexedDB's exclusion of credentials/record rows. Browser checks use local synthetic data; they do not establish real FileMaker or physical iOS/Safari compatibility.

## Source

- `server/index.ts`: service, connection/session routes, validation, browser guards.
- `server/adapters.ts`: Data API/OData auth, metadata, reads, logout, bounded transport.
- `server/lab.ts`: synthetic native-shaped protocol endpoints.
- `src/lib/workspace.tsx`: active profiles/sessions/schema, history, preferences.
- `src/lib/storage.ts`: IndexedDB stores and migration.
- `src/lib/schema-history.ts`: structural comparison, provenance, and potential saved-request impact.
- `src/lib/handoff.ts`: portable package assembly, redaction, hashes, and ZIP creation.
- `src/lib/handoff-runner.ts`: standalone exported Node read runner.
- `src/lib/knowledge.ts`: developer-note validation.
- `src/lib/queries.ts`: protocol-specific request compilation.
- `src/lib/generators.ts`: integration artifacts from inspected metadata.
- `src/components/`: workbench views, connection/auth dialogs, shadcn primitives.
- `roadmap.md`: planned milestones and acceptance criteria.

## Author

**Alex Seidler** — creator and project maintainer.

Contact: [alex@rgcdata.com](mailto:alex@rgcdata.com)

Copyright © 2026 Alex Seidler.

## Workspace navigation and welcome

The selected entity is the main object: its name, observed or developer-confirmed description, and factual counts lead the page. Grouped information and compact table spacing restore the fuller workbench layout. Five persistent tabs organize **Overview, Schema, Relationships, API, and AI**. Overview brings together declared keys, reported counts, exposed connections, saved integration checks, and developer knowledge. Unknown business meaning stays explicit; the app does not infer API usage or workflow rules from field names.

The app starts on **Dashboard**, with the database name, connection state, three schema totals, three suggested steps (fields and types, records, relationships), and a clickable preview of exposed relationships. The highlighted Start here card makes the first step explicit; a collapsed Coming from MySQL? note maps fields and records to familiar terms and explains API-visible layouts/entity sets. The resource list stays in the collapsible rail instead of repeating on the dashboard. The two-row top bar places search beside the linked-bracket logo, with a compact, labeled **Connection** menu on the right and direct work-area links below. The Connection menu contains saved profiles, Manage connections, and New connection. Active navigation is highlighted; entity pages keep the selected resource as their prominent heading. The narrow resource list can collapse and becomes a drawer on smaller screens. Field details open on demand; records remain under Schema, and queries and generated types remain under API. Clicking Schema or API returns directly from these subviews. Metadata and context previews stay collapsed until requested.

A dismissible welcome screen credits **Alex Seidler / RGC Data Solutions**, linking to [rgcdata.com](https://rgcdata.com/) for custom FileMaker ↔ web ↔ mobile integrations, hosting, and complex development projects. Its optional five-step guide links to the relevant screens. X, Escape, or Explore workspace closes it. **Don't show this on startup** is saved locally in IndexedDB. **Help & shortcuts → Welcome & quick start** reopens it. The guide does not connect, execute a query, or open the external site automatically.

## Readability

The interface uses a 16px-equivalent body size, 14px-equivalent minimum supporting text, larger controls, and brighter secondary text using neutral near-black surfaces, orange (#F3A547) primary actions and navigation, and restrained violet (#9F8CB8) details with a subtle purple top bar. Success (#22C55E), warning (#F59E0B), and danger (#EF4444) remain separate status colors. Font sizes use rem units so browser text preferences and zoom remain useful. Data tables and code panels scroll within their own containers when needed. Relationship graphs can be zoomed and panned.
