# FM API Explorer handoff

Updated October 30, 2026 after Alex resumed work. Maintainer: **Alex Seidler**, [hello@alexseidler.dev](mailto:hello@alexseidler.dev).

## Current state

The application is v0.9.1. It provides a local read-only FileMaker API workbench and a separate synthetic browser demo. The local service supports Data API/OData adapters; real FileMaker Server/Cloud acceptance is still pending. Schema history describes inspected structure and cannot restore FileMaker data.

The personal README follow-up is complete. It uses the personal contact address, keeps the walkthrough and architecture near the top, removes the slogan and em dashes, and links to detailed operating instructions. Existing application credits, repository visibility and license status were preserved. This repository has no project license file; dependency licenses remain separate.

## Source and commit links

The checkout's Git root and origin were verified before resuming. Repository: [alexrgcdata/FM-Explorer](https://github.com/alexrgcdata/FM-Explorer), branch `main`.

- Application checkpoint: [`9d3f4f8`](https://github.com/alexrgcdata/FM-Explorer/commit/9d3f4f87bdd8bcb148f7da2add365ffe607c9b57), v0.9.1 search, loading and release verification improvements.
- Export/query fixes: [`da9dd5f`](https://github.com/alexrgcdata/FM-Explorer/commit/da9dd5f), strict date validation and generated export regression checks.
- README follow-up and HEAD at resume: [`8048b7f`](https://github.com/alexrgcdata/FM-Explorer/commit/8048b7f6e5bbe255b6cc021be2af657bd2a297d2).
- [Current source](https://github.com/alexrgcdata/FM-Explorer/tree/main) and [release listing](https://github.com/alexrgcdata/FM-Explorer/releases). No tagged release was created by this work; v0.9.1 is the application version, not a claimed published GitHub release.

This handoff is a separate documentation checkpoint. To identify the commit containing its latest update, run `git log -1 --format=%H -- agentic_handoff.md`.

## Verification already performed

| When | Evidence | Boundary |
| --- | --- | --- |
| October 30 | 51 automated tests passed, type checking passed, connected build passed. | Synthetic/local protocol fixtures, fake IndexedDB, and generated-file checks. No real FileMaker host. |
| October 29 | Both builds and 25 FTP files verified; Chromium checked desktop, phone/tablet search, navigation, synthetic pagination and deferred screens. | Historical local evidence; does not establish deployed-host or physical Safari/iOS acceptance. |
| October 30 README follow-up | Relative documentation links resolved, diff whitespace check passed, changes pushed to `main`, clean working tree confirmed. | Documentation only; unchanged runtime tests were not repeated. |

No heavy checks, installations, watchers, servers, database calls or deployments were started for this resume task. No heavy-check slot or resource attribution was needed. This checkpoint records earlier verification rather than implying it was rerun after the hardware upgrade.

## Setup and delivery

Requires Node.js 24+ and npm. From a fresh clone: `npm ci`, `npm run build`, then `npm start`. Open `http://127.0.0.1:4186/` while the local service runs. Built-in labs require no real credentials. UI development uses `npm run dev` on port 5186 with the API service running separately.

For manual website delivery, `npm run build:ftp` creates `FTP-READY/dist/`; upload its contents, including all assets, into the chosen website subfolder. This demo accepts no real authentication and needs no backend. Root `dist/` is the connected local app, not the FTP deliverable. No FTP package was rebuilt or uploaded during the documentation/resume work. No deployed URL is certified by this handoff.

## Next steps and limits

1. Keep any portfolio wording, portfolio code or deployment with PROJECT MANAGER. This product task did not edit the parent portfolio.
2. When Alex authorizes a real target, validate the intended FileMaker versions/protocols, privileges, sessions, paging, filters/sorts, precision/date/time handling and exposed metadata. Enter credentials locally, never in handoffs or chat. Review possible FileMaker layout-trigger effects with the owner before reads.
3. Test a representative integration and have another developer use its exported handoff. Missing Data API relationships do not prove the solution has none; generated MCP definitions are not a runnable MCP server.
4. After an authorized manual upload, check HTTPS, assets, reloads, downloads and browser storage on that exact host. Hosted live connectors, PostgreSQL/team services, OpenBridge contracts, desktop packaging and pricing remain future work.
5. Coordinate a heavy-check slot before a later full suite/build if other product work is active. Do not rerun unchanged checks merely for documentation. No new subagents or persistent monitors are needed.

Schema names, notes and saved filter values may be private even though authentication and returned rows are excluded from persisted schemas. Review exports before sharing. No secrets, customer records, raw runtime configuration or clipboard captures belong in this file.

## Documentation

[README](README.md) · [Operating guide](docs/operating-guide.md) · [Readiness](READINESS.md) · [Roadmap](roadmap.md) · [FTP instructions](FTP-INSTRUCTIONS.txt).
