# FM API Explorer readiness

Reviewed October 30, 2026. Created and maintained by **Alex Seidler** ([hello@alexseidler.dev](mailto:hello@alexseidler.dev)).

**Status:** suitable for a synthetic product demonstration and developer source review. Real FileMaker integration acceptance remains pending. No hosted live connector is supplied by the website build.

## Source and public links

- Repository: [alexrgcdata/FM-Explorer](https://github.com/alexrgcdata/FM-Explorer), default branch `main`, public visibility confirmed during this review; unchanged.
- Assessed application commit: [`9d3f4f87bdd8bcb148f7da2add365ffe607c9b57`](https://github.com/alexrgcdata/FM-Explorer/commit/9d3f4f87bdd8bcb148f7da2add365ffe607c9b57) (v0.9.1).
- [README and startup guide](README.md) · [source/tests](tests/) · [remaining roadmap](roadmap.md).
- This follow-up changes documentation only. For its latest documentation commit, run `git log -1 --format=%H -- READINESS.md`; the application version is unchanged.
- No project license file is present. Visibility and license status are preserved; dependency licenses are separate.

## Setup

Requires Node.js 24+ and npm. From a cloned repository:

```powershell
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4186/`. Keep the local Node service running. The built-in synthetic lab requires no FileMaker account. `npm run dev` is the UI development server at port 5186 and requires the local API service separately. `npm run preview` alone does not provide that API service.

The website demo is a different build: `npm run build:ftp` produces `FTP-READY/dist/`. Upload that folder's **contents**, including all assets, into the chosen website subfolder. It runs synthetic fixtures entirely in the browser, accepts no real credentials, and requires no backend. Root `dist/` belongs to the connected local application and is not the FTP deliverable. Nothing was uploaded or deployed in this review.

## Verification

Fresh checks on October 30:

| Check | Result |
| --- | --- |
| `npm test` | 51 passed, 0 failed; local fixtures/fake IndexedDB/generated-file checks, no remote FileMaker requests. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; connected application build. |
| Browser/FTP acceptance | Not repeated during this documentation review. Prior October 29 work recorded local Chromium flows, both builds and 25 verified FTP files; that evidence does not prove the deployed host is current. |

The suite checks both synthetic protocol flows, auth/session and request guards, continuation handling, numeric precision, query/date validation, schema comparison, saved checks, generated exports, handoff redaction/hashes, and workspace transfer/migration/rollback. No coverage percentage is claimed. `npm run verify:release` is available to rerun tests, both builds and FTP manifest/asset checks; it creates local build artifacts and does not deploy them.

## Remaining acceptance

1. Use an approved real FileMaker Server/Cloud endpoint and account. Record actual versions and test each advertised protocol: privileges/metadata gaps, token expiry/ownership, empty results, paging, filters/sorts, numeric/date/time values, reconnect/logout and exposed relationships.
2. Validate one real integration's saved checks and schema comparison, then have a second developer use an exported handoff without hidden setup instructions. Data API layouts are not a complete base-table/relationship inventory; snapshots cannot restore FileMaker data.
3. After an authorized manual upload, verify HTTPS, subfolder asset loading, reloads, downloads and browser storage on the actual host. No live demo URL is certified by this review. Physical Safari/iOS acceptance remains pending.
4. Review runtime/security requirements before hosting a live connector. PostgreSQL/team hosting, OpenBridge adapters, a runnable MCP server, desktop distribution and paid services remain future work, not shipped capabilities.

No credentials, customer records, production writes, visibility/license changes, new versioned release, or portfolio-site edits were part of this pass.
