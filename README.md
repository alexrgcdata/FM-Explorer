# FM API Explorer

React/TypeScript developer workbench with charcoal/amber styling, shadcn/Tailwind, an IndexedDB workspace, and a local Node service for FileMaker API requests.

**Created and maintained by Alex Seidler** · [alex@rgcdata.com](mailto:alex@rgcdata.com) · [GitHub](https://github.com/alexrgcdata)

FM API Explorer helps FileMaker developers, web developers, and AI/MCP builders understand the API-facing structure of a solution, explore records, test integration expectations, and generate useful documentation and code artifacts.

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

## Connect a real FileMaker endpoint

Use **Add real endpoint** or **Connections → Add connection**. Enter an HTTPS host only, the exact hosted database name, and a protocol. API paths are constructed by the connector.

- Data API: FileMaker Server account/password or an existing Data API session token. API version is selectable.
- OData: FileMaker Server account/password or a FileMaker Cloud FMID token obtained through the appropriate external authentication flow.
- Use an account limited to the required metadata/record reads with the relevant API privileges. This application offers no record writes, uploads, or script execution. Existing FileMaker layout triggers/server behavior can still have server-side effects; review them when using a real solution.

Enter credentials locally in the app, never in chat. Authorization remains in local-service memory. Data API sessions created by the service are logged out on disconnect where possible; externally supplied tokens are forgotten locally without revoking the caller's session. Sessions expire after 15 minutes of inactivity. Reauthenticate after restarting the service. External Server/Cloud interoperability has not been verified against a real endpoint yet.

## Local storage and privacy

IndexedDB database: `fm-api-explorer`, version 3.

| Store | Contents |
| --- | --- |
| profiles | Nonsecret name, host, database, protocol, version |
| snapshots | Inspected schema, raw metadata, source/time, qualified counts, warnings; no record rows |
| schemaVersions | Up to 50 dated structural inspections per connection; no rows, raw payloads, or record counts |
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

Versioned schema comparisons are available now. The next planned milestone is the integration and AI handoff package. See [roadmap.md](roadmap.md) for sequencing and acceptance criteria. Potential additions include:

- Portable integration and AI handoff bundles containing schema, TypeScript, API examples, developer notes, and check definitions.
- Developer-authored business meanings, workflow notes, and agent constraints alongside observed metadata.
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
- `src/lib/queries.ts`: protocol-specific request compilation.
- `src/lib/generators.ts`: integration artifacts from inspected metadata.
- `src/components/`: workbench views, connection/auth dialogs, shadcn primitives.
- `roadmap.md`: planned milestones and acceptance criteria.

## Author

**Alex Seidler** — creator and project maintainer.

Contact: [alex@rgcdata.com](mailto:alex@rgcdata.com)

Copyright © 2026 Alex Seidler.
