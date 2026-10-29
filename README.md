# FM API Explorer

React/TypeScript developer workbench with neutral dark surfaces and orange accents, shadcn/Tailwind, an IndexedDB workspace, and a local Node service for FileMaker API requests.

**Created and maintained by Alex Seidler** · [alex@rgcdata.com](mailto:alex@rgcdata.com) · [GitHub](https://github.com/alexrgcdata)

FM API Explorer helps FileMaker developers, web developers, and AI/MCP builders understand the API-facing structure of a solution, explore records, test integration expectations, and generate useful documentation and code artifacts.

## Why use it?

**Understand your FileMaker API. Review changes. Hand off with confidence.**

FM API Explorer is an integration workbench for FileMaker consultants, web developers, and developers preparing context for agents. Inspect what a connection exposes, save representative read requests and expectations, compare dated schema inspections, and hand another developer a portable package with schema, types, API examples, and reviewed notes.

For example, a website expects an Email field. After a solution update, compare the API-visible schema, review the saved requests referencing Email, and rerun their checks. Package the inspected structure and developer-confirmed meanings for the person maintaining that website. The intended benefit is less repeated discovery, testing, and handoff preparation; time savings and customer demand still need real-solution trials.

The current release is an early local workbench validated against synthetic OData/Data API labs. Real FileMaker Server/Cloud acceptance is pending. Schema history documents changes and cannot restore a database. A handoff package provides context and read scaffolding; it does not establish that an agent understands every business rule.

## Release readiness — v0.9.0

**Ready for a public synthetic demo; not yet validated for production FileMaker integrations.** Automated checks and local browser trials cover the shipped build and protocol fixtures; actual Server/Cloud acceptance remains pending.

| Area | Status | Remaining acceptance |
| --- | --- | --- |
| FTP website demo | Built and locally verified under `/projects/explorer/` | After manual upload, verify HTTPS, assets/fonts, refresh, downloads and browser storage on the actual host. |
| Local read-only workbench | Synthetic Data API/OData protocol tests pass | Approved real endpoint/account and version-specific testing. |
| Schema/history/checks/exports | Local tests and browser workflows verified | Check a real integration, permission-limited discovery, and independently usable handoff. |
| Workspace privacy | Authentication fields and returned records excluded; raw cached payloads stripped | Schema names, notes and saved filter values remain sensitive; users review exports. |
| Hosted live connector | Not provided by the FTP build | Review hosting/runtime/security before accepting real credentials on a public website. |

Before calling live integrations production-ready, record actual FileMaker versions and test each API you intend to advertise: login/token ownership and expiry, insufficient privileges, empty results, paging beyond one page, filtering/sorting, large numbers/date/time fields, exposed navigation, reconnect/logout, and representative integration checks. Review layout/server-trigger behavior with the owner before reads. Enter credentials locally, never in issues or chat. Run a pilot with another developer and verify their exported handoff works without hidden chat history.

Navigation keeps Dashboard, Schema, Records, Relationships and History visible; **Tools** groups queries, saved checks, developer exports, handoff packages and AI context. Entity tabs keep **Fields** and **Records** distinct. Failed lazy-loaded screens offer a reload action without clearing the workspace. Connection removal requires confirmation and reports persistence errors.

The dependency audit on October 28, 2026 reported no known advisories in the installed dependency tree. This is a package-registry check, not a security certification. Browser QA uses Chromium; physical Safari/iOS testing and deployed-host acceptance remain pending. Records, relationship graphs, workspace transfers, handoff packages, and entity AI context load on demand to keep the first screen lighter.

Version 0.9.1 expands **Ctrl/Cmd+K** (or `/`) to resources, field names/native types, tools, saved checks, and workspace actions. Search for “TypeScript”, “Postman”, “MCP”, or “backup” to jump directly to the relevant screen. Enter opens the first result; Tab moves through result buttons. On narrow screens, use **Tools → Search workspace**. Date/timestamp filters reject invalid calendar values and trailing expressions. Generated TypeScript handles reserved resource names, and Postman/OpenAPI reads use canonical, encoded protocol paths rather than imported endpoint text.

## Start

### Website preview by FTP

Run `npm run build:ftp`, then upload the **contents** of `FTP-READY/dist/` into the domain's `projects/explorer/` folder. Alex's manual upload target is `https://alex.seidler.dev/projects/explorer/`. Find the domain's document root under cPanel **Domains**; it is not necessarily the account's main `public_html` folder. Do not upload the `dist` directory itself. Keep `index.html`, `favicon.svg`, `THIRD-PARTY-NOTICES.txt`, and the entire `assets/` directory together. See [FTP-INSTRUCTIONS.txt](FTP-INSTRUCTIONS.txt).

This command builds `website-upload/`, stages and verifies a fresh copy, then updates the same `FTP-READY/dist/` folder. `FTP-READY/READ-ME-FIRST.txt` gives upload steps; `BUILD-INFO.json` records build time and SHA-256 hashes. These two reference files stay on your computer. The preceding FTP package is retained under ignored `.local/ftp-previous-*` for recovery. Nothing deploys automatically. Relative asset paths allow other domains and subfolders without rewrites. `npm run build:website` still produces the original `website-upload/` output; the root `dist/` remains the local Node service build.

This separate browser-only build automatically loads synthetic fixtures. It uses no Node/PHP service, accepts no real database authentication, and makes no external database or AI requests. IndexedDB uses the separate `fm-api-explorer-showcase` database. Saved queries/notes belong to each visitor's browser. Response notes, synthetic-data labels, and the browser-preview footer distinguish simulated operations from real FileMaker reads. It demonstrates the interface, local filtering, exports, and workflows; it does not validate a real FileMaker connection. Keep the normal local build for real endpoint testing.

### Local connected application

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

Export creates versioned JSON request definitions and summaries, with filter values redacted by default and `requiresFilterValues` marking definitions needing those values again. Standalone request-definition exports are not imported or automatically executed. To transfer saved checks with their original values, use the separate workspace transfer below. Empty results make selected field checks inconclusive; a minimum-row failure still fails. Checks cover the returned page, not every record or a FileMaker backup.

### Save and restore your Explorer work

Open **Settings → Save & restore workspace**. Download a versioned JSON file for the current connection: its nonsecret connection details, up to 50 schema versions, saved check definitions, and developer notes. Download requires acknowledging that server/database names, saved filter values and note text may be private. Authentication fields, live sessions, returned records, raw API response bodies, activity logs, check-run results and display preferences are excluded. Secrets manually typed into filter values or notes are ordinary text and are included; this export is not automatic redaction.

Choose that file in the same dialog on another browser/computer and review its source and counts before **Import a copy**. Files are limited to 10 MB and validated before persistence. All writes use one IndexedDB transaction. Profiles with matching names, hosts, databases, protocols and API versions are reused. Differently named connections remain separate, even when they share a server/database. New profiles and imported checks/notes receive fresh identifiers. Existing definitions and current schema are never replaced. A connection exceeding 100 checks or 200 notes rejects the entire import. Existing schema history takes priority within its 50-version cap; additional imported versions are skipped with a count. Reimporting creates more copies.

Import never opens a connection or runs queries. Reconnect manually in the local application when ready. The website demo imports only bundled lab workspaces. Imported developer-note confirmation is carried over from the file, not independently verified. A workspace export preserves Explorer knowledge; it cannot restore FileMaker records, deleted fields, credentials or a database.

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

## Hosted backend preference

Alex prefers PostgreSQL for a future hosted backend. Confirm PostgreSQL access and the supported application runtime on the exact Namecheap plan before implementing deployment. The current FTP preview needs no backend or database.

## Possible future additions

Schema history and integration/AI handoff packages are available now. The next milestone is real-solution validation. See [roadmap.md](roadmap.md) for sequencing and acceptance criteria. Potential additions include:

- Verified MCP and OpenBridge adapters, with explicit permissions and reviewed tool definitions.
- Richer schema import, including possible FileMaker DDR support.
- Focused React starters, typed API clients, and hooks generated from selected resources.
- Real FileMaker Server/Cloud compatibility coverage, easier desktop installation, and possible team workflows.

These are planned or exploratory capabilities, not promises of functionality already available. Schema snapshots document inspected structure; they are not FileMaker database backups or restore files.

## Checks

Run `npm run verify:release` for the complete local release check. It runs the automated suite, builds the connected app and FTP demo, then independently verifies the FTP folder's complete file list, SHA-256 hashes, and entry-point assets. It stops on failure and never contacts a real FileMaker server. Browser QA and deployed-host acceptance remain separate.

Individual checks:

```powershell
npm run typecheck
npm test
npm run build
npm run build:ftp
```

Tests exercise both local protocol flows, session ownership, guards, empty finds, native errors, continuation pagination, schema parsing, precision, query escaping, and IndexedDB's exclusion of credentials/record rows. Browser checks use local synthetic data; they do not establish real FileMaker or physical iOS/Safari compatibility.

## Source

- `server/index.ts`: service, connection/session routes, validation, browser guards.
- `server/adapters.ts`: Data API/OData auth, metadata, reads, logout, bounded transport.
- `server/lab.ts`: synthetic native-shaped protocol endpoints.
- `src/lib/workspace.tsx`: active profiles/sessions/schema, history, preferences.
- `src/lib/storage.ts`: IndexedDB stores and migration.
- `src/lib/workspace-transfer.ts`: validated, credential-field-free workspace transfer and atomic import.
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

## Optional newcomer guidance

Use **Guide** in the header, **Explore with guidance** on the welcome screen, or **Settings → Explain each screen**. Guidance is off by default and its choice persists in IndexedDB. Each work area has a plain-English explanation, a suggested next action, and an expandable glossary; schema/record explanations stay beside the selected entity's tabs. Experienced developers can turn the guide off or dismiss it with X. The helper uses authored text, not an AI provider, and does not execute requests automatically.

The dashboard's optional **Do I need to upload database files?** explanation distinguishes connecting to a hosted FileMaker database from downloading exports. This app does not import `.fmp12` files. Website owners must upload the static build's assets when publishing the preview; end users do not supply those files to connect a database. Real Server/Cloud acceptance remains pending.

## Readability

The interface uses a 16px-equivalent body size, 14px-equivalent minimum supporting text, larger controls, and brighter secondary text using neutral near-black surfaces, orange (#F3A547) primary actions and navigation, and restrained violet (#9F8CB8) details with a subtle purple top bar. Success (#22C55E), warning (#F59E0B), and danger (#EF4444) remain separate status colors. Font sizes use rem units so browser text preferences and zoom remain useful. Data tables and code panels scroll within their own containers when needed. Relationship graphs can be zoomed and panned.
