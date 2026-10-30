# FM API Explorer

FM API Explorer helps developers inspect the part of a FileMaker solution exposed through its Data API or OData endpoint. You can explore fields and records, save read queries with response checks, compare schema inspections, and export types, API examples, and notes for another developer.

Created and maintained by **Alex Seidler**. Contact: [hello@alexseidler.dev](mailto:hello@alexseidler.dev) · [GitHub](https://github.com/alexrgcdata)

## Try it locally

You need Node.js 24 or newer and npm. The synthetic lab needs no FileMaker installation, database files, account, or API key.

```powershell
git clone https://github.com/alexrgcdata/FM-Explorer.git
cd FM-Explorer
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:4186/](http://127.0.0.1:4186/) and keep the terminal running. Select **Local FileMaker Lab**, then connect and discover its schema.

1. Open **Schema** and select Customers to inspect field definitions.
2. Switch to **Records** and try filtering or sorting a page.
3. Open **Tools → Queries**, build a read, and save its response expectations under **Saved checks**.
4. Use **History** to compare inspections. The lab's change example illustrates a difference without altering a database.
5. Open **Tools → Handoff** to review the schema, types, read examples, and developer notes before exporting.

For UI development, leave the local service running and use `npm run dev` in another terminal. Vite serves the UI at port 5186 and proxies API requests to port 4186. `npm run preview` alone does not provide the local API service.

## How it works

| Part | Responsibility |
| --- | --- |
| React and TypeScript | Entity navigation, TanStack record tables, React Flow relationships, query building and generated documents. Vite, shadcn and Tailwind provide the build and UI foundations. |
| IndexedDB | Connection profiles, metadata-only schema history, saved checks and developer notes. Authentication fields and returned records are not persisted. |
| Local Node/Fastify service | Loopback-only API boundary, in-memory sessions, input guards and bounded reads through Data API/OData adapters. |
| Browser-only website build | Synthetic fixtures evaluated in the browser, with separate browser storage and no real database authentication. |

The connectors preserve unsafe numeric values as strings, restrict continuation URLs to the expected origin and resource, and distinguish unknown metadata from confirmed schema changes. Exported handoffs keep observed metadata separate from developer-confirmed notes and require review of saved filter values.

Useful starting points in the code are [server/adapters.ts](server/adapters.ts), [src/lib/schema-history.ts](src/lib/schema-history.ts), [src/lib/workspace-transfer.ts](src/lib/workspace-transfer.ts), and [tests/](tests/).

## Website demo

`npm run build:ftp` creates `FTP-READY/dist/`. Upload its **contents**, including the full assets folder, to your chosen website subfolder. This build needs no backend and cannot connect to a real FileMaker database. The root `dist/` belongs to the local connected application; it is not the FTP deliverable. See [FTP-INSTRUCTIONS.txt](FTP-INSTRUCTIONS.txt) for the upload steps.

## Current status and limits

Version 0.9.1 has been exercised with synthetic Data API/OData responses. On October 30, 2026, all **51 tests**, type checking, and the connected build passed. No real FileMaker endpoint was tested. The suite covers request/session guards, pagination, precision, query validation, schema comparisons, generated exports, and IndexedDB transfer and recovery behavior.

Data API resources are layouts, not a complete base-table inventory or relationship graph. Schema snapshots cannot restore FileMaker data. OpenAPI exports are read-operation snippets, and MCP exports are definitions rather than a running MCP server. Real Server/Cloud compatibility, physical Safari/iOS behavior, and the current deployed website still need acceptance checks.

Enter real credentials locally, never in chat or issues. They stay in local-service memory. Schema names, saved filter values, and developer notes can contain private information, so review exports before sharing them. FileMaker layout triggers may have server-side effects even when this app only reads; review those with the solution owner before connecting.

## Documentation and checks

- [Operating guide](docs/operating-guide.md): installation, real connection setup, storage, saved checks, schema history, exports and privacy details.
- [Readiness](READINESS.md): assessed source commit, verification evidence and remaining acceptance.
- [Roadmap](roadmap.md): possible future additions and their acceptance criteria.

Run `npm test`, `npm run typecheck`, and `npm run build` for the local checks. `npm run verify:release` also builds the browser demo and verifies its FTP manifest and assets. It creates local files and does not deploy anything.

## License and credits

Copyright © 2026 Alex Seidler. This repository has no project license file; its public visibility is not an open-source license grant. Third-party dependencies retain their own licenses, and the website build includes `THIRD-PARTY-NOTICES.txt`.

The application's existing Alex Seidler / RGC Data Solutions credits are retained.
