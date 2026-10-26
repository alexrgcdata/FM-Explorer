# FM API Explorer — Delivery roadmap

Updated: October 26, 2026

Product job: help a developer inherit a FileMaker solution, understand its integration-facing structure, and give people or agents a reliable starting package.

The current application is a local workbench with IndexedDB, read-only Data API/OData connectors, and a synthetic protocol lab. A schema snapshot describes what was inspected; it cannot restore a FileMaker database or deleted data.

## Current local sequence

1. **Prepare a real connection.** Paste a server/API URL, recognize its host/database/protocol, and save a profile without credentials if needed. Copy a setup request for the solution owner. These actions do not test connectivity or contact the server.
2. **Run one approved real-solution trial.** Enter credentials locally, inspect account-visible metadata, browse a bounded page, and check pagination, filters, and one numeric/date field. Record the actual server version and protocol tested; leave other compatibility combinations unverified.
3. **Prove the integration workflow.** Save a schema baseline and one representative read check. Review a controlled change, then export a handoff another developer can use. Record whether this catches a problem or saves work.
4. **Refine from pilot feedback.** Observe whether FileMaker and SQL/web developers can find fields, records, and a useful export without coaching. Improve the specific stumbling points before adding more tools.
5. **Choose a hosted backend only when needed.** PostgreSQL is Alex's preference. Verify the exact Namecheap plan's database access and supported application runtime first. The public FTP preview remains separate; no hosted backend or production upload is part of this local work.

Local connection preparation now supports a pasted Data API/OData URL, a credential-free saved profile, and a copyable setup request. A real target and test account are still required for step 2. The public preview does not accept real credentials. Keep working in the current checkout; do not move folders or change the FTP build as part of local feature development.

## Step 1 — Save requests and verify their responses (implemented locally)

Create a reusable library of named queries per connection. Save explicit expectations about returned rows, required fields, payload types, nulls, and response time. Rerun one check or a connection's suite. Show pass, fail, request error, or inconclusive with reasons. Persist query definitions and summaries in IndexedDB, excluding credentials and returned records.

Acceptance: save a query, reload, run it successfully, deliberately create an incorrect expectation, observe a useful failure, fix it, and export a definition/result summary without record values. Offline saved requests remain readable; execution requires an active connection. Checks cover a bounded returned page, not an entire database.

## Step 2 — Keep schema versions and compare changes (implemented locally)

Preserve dated schema versions instead of overwriting the previous version. Compare added/removed resources and fields, native type/nullability/key changes, and exposed navigation. Associate each snapshot with its source, protocol, account-visible scope, completeness, and warnings. Link changed fields to saved requests that use or expect them. Treat missing metadata from partial discovery as unknown, not a confirmed deletion.

Acceptance: a controlled lab schema change produces a precise before/after comparison and identifies affected saved checks. The UI never implies automatic repair or database restore.

## Step 3 — Generate an integration and AI handoff package (implemented locally)

Bundle selected schema, TypeScript, API examples, saved request/check definitions, and Markdown context into a versioned downloadable package. Include a manifest, source/time, limitations, and instructions. Exclude authentication material and record values by default; let users review/redact saved filter values before including them.

Add developer-authored entity/field descriptions, status meanings, workflow notes, and agent constraints. Keep observed metadata, human-confirmed business knowledge, and suggested inferences distinguishable. Use portable Markdown/JSON rather than assuming any particular AI provider.

Acceptance: a second developer or agent can use one self-contained package to understand and exercise a chosen read integration without chat history or hidden project context.

## Step 4 — Validate usefulness on real solutions

Use approved endpoints and credentials entered locally. Verify FileMaker Server/Cloud versions, privileges, metadata gaps, finds, sorting, precision, paging, and native errors. Run one existing integration through the request/check/compare/handoff workflow. Record actual onboarding/debugging effort and actionable failures. Seek a small number of real developer/consultant trials before treating market demand as established.

Acceptance: documented real-server coverage and evidence that the workflow saves effort or catches a meaningful integration problem. Lab tests alone do not establish product demand or remote compatibility.

## Step 5 — Add targeted generators and richer knowledge sources

Use pilot feedback to choose the next capability: a React starter, API client/hooks, DDR/richer schema import, or a reviewed business map. Generate a narrow working read-only slice before broad CRUD scaffolding. FileMaker agent/MCP adapters must use verified contracts and remain separate from the knowledge/checking layer.

Acceptance: the selected generator produces runnable output with clear permission boundaries and validation. Business workflow suggestions require evidence and human confirmation.

## Step 6 — Package the product

Improve installation, update/recovery behavior, performance, documentation, and accessibility. Decide whether a desktop wrapper or team service solves an observed need. Assess distribution/pricing only after pilot evidence; do not create hosting, accounts, billing, telemetry, or paid services prematurely.

## Current implementation boundary

Step 1 is implemented. Seventeen automated tests pass, including v1-to-v2 IndexedDB migration, request persistence, 200-result retention, deletion cascades, response evaluation, and redacted export defaults. Browser verification covered saving an Active-customer query, a successful check, a deliberately incorrect FullName number expectation producing seven type mismatches, correcting it, running the suite, exporting, and reloading with all three summaries preserved. No console errors were observed in this flow.

Step 2 is now implemented locally. IndexedDB v3 preserves a migrated baseline plus up to 50 versions per connection. Structural comparisons qualify partial/unknown metadata and link changed fields to saved request expectations, filters and sorts. The lab example is an illustrative comparison, not a change to the running synthetic server. Browser verification covered real refreshes producing unchanged comparisons, the illustrative changed comparison, affected-request navigation, JSON export, and responsive widths. Twenty-five automated tests cover the combined application, including migration, history immutability/retention, scope mismatch, partial discovery and change impact. Real FileMaker interoperability remains unverified.

Step 3 is implemented locally in v0.4.0. All 33 automated tests and the build pass. Packages are ZIP archives with selected schema, TypeScript/JSON Schemas, native API examples, a dependency-free Node read runner, check definitions/history, portable Markdown/JSON knowledge, manifest provenance/limits, and SHA-256 file hashes. IndexedDB v4 preserves earlier stores and adds up to 200 developer notes per connection. Notes distinguish drafts from explicit human confirmation. Saved filter values require per-value review; redacted requests are blocked, never broadened. Browser ZIPs were independently opened with Python and their hashes/redaction verified. The extracted reviewed OData read returned seven Active fixture rows out of twelve matching. Tests also execute a native Data API find with externally supplied ephemeral lab authorization. No real customer data or remote FileMaker server was used.

Steps 4–6 remain planned. No new external endpoint, production write, automatic monitoring, AI provider, or deployment was used. Continue using the local lab until Alex supplies an approved real target. The next milestone is Step 4: approved real-solution trials and documented interoperability/usefulness.
