# Penny — personal money tracker

A mobile-responsive Next.js + Express spending tracker backed only by Neon PostgreSQL. Includes INR (₹) totals, three charts, six colored categories, date/note entry, confirmed deletion, workspace creation/switching, search, CSV export, and light/dark modes. No authentication, browser storage, offline queue, mock transactions, or in-memory database fallback.

## Deploy to Vercel

1. Import this GitHub repository into Vercel. Deploy the branch containing these changes.
2. Choose **Next.js** as the framework, repository root as the root directory, and Node.js **22.x**. Keep the output-directory override empty. `vercel.json` sets `npm ci` and `npm run build:vercel`.
3. Add a server-only **`DATABASE_URL`** environment variable using your Neon pooled PostgreSQL connection string, with TLS enabled. Set it for the intended deployment environment(s). Do not use a `NEXT_PUBLIC_` prefix.
4. Optional: add **`NEON_REALTIME_URL`** and **`NEON_REALTIME_SECRET`** from Neon to enable live subscriptions. Without these, data still refreshes from Postgres every 30 seconds, on focus, and after each mutation.
5. Vercel now applies migrations automatically before building whenever `DATABASE_URL` is configured. Production builds fail clearly if it is missing or migrations fail. To apply migrations manually from a trusted terminal:
   ```sh
   npm ci
   npm run migrate
   ```
   This applies `db/001_expenses.sql` and `db/002_workspaces.sql`. Existing expenses are retained in the **Personal** workspace. The migrations are idempotent, preserve existing expenses, and use a database advisory lock to serialize concurrent deployments. They never run inside API requests. Use a separate Neon branch/database for preview deployments to avoid sharing production financial data.
6. Deploy or redeploy after adding/changing environment variables. Verify `/api/health` returns 200, then create a workspace and test adding/deleting an expense.

The repository is prepared for deployment; no Vercel project has been created or modified and no deployment has been published by this task. The local `.env.local` is Git-ignored and is **not** automatically transferred to Vercel. Add environment values through Vercel's secure project settings. Rotate the database password previously shared in chat before production use.

### Deployment architecture

- Next.js serves the UI normally, without a custom server.
- `pages/api/[...path].ts` is a Node API route that passes the original request/response to the shared **Express** application in `server/app.mjs`. Body parsing is disabled in Next so Express handles JSON parsing and validation consistently. All browser API URLs are relative/same-origin.
- `server/db.mjs` reuses a small `pg` pool. On Vercel it registers with `attachDatabasePool` for Fluid compute lifecycle management. `npm run build` is database-independent; the Vercel-specific `build:vercel` step applies migrations first.
- The API function has a 60-second duration budget. SSE requests terminate after 50 seconds (including subscription setup), clean up timers/subscriptions on response close, and reconnect using the browser's EventSource behavior. Keep Fluid compute enabled. Realtime is optional and consumes function execution time while connected.
- `server/index.mjs` remains an optional standalone Express/Next entrypoint for container/Node hosting; Vercel does not use it.
- The dashboard and API never store money data on the client. React holds only current fetched view data and unsaved form state. API responses use `Cache-Control: no-store`.

## Local development

Use Node.js 22.x:

```sh
npm ci
cp .env.example .env.local
# Fill DATABASE_URL and optional Neon Realtime variables securely.
npm run migrate
npm run dev
```

Production equivalent:

```sh
npm run build
npm start
```

Both scripts bind to `0.0.0.0` for hosted previews. Optional standalone server: `npm run start:standalone`.

## Workspaces, categories, and currency

- Header dropdown switches the entire dashboard, transaction list, exports, writes, deletions, and Realtime subscription to the selected workspace.
- **+ New workspace** creates a named workspace in PostgreSQL.
- Existing expenses migrate to Personal. Foreign keys link each expense to one workspace; deletions match both the workspace and expense UUID.
- Categories: unknown (gray), food (red), waste (gold), needs (blue), tech (green), self (purple).
- All amounts remain **INR**, stored as integer minor units to avoid floating-point storage errors.
- Charts: category donut, daily rhythm, category comparison. The daily rhythm chart always shows the selected calendar month, even when all-time totals are selected.
- Theme initially follows the system; the moon/sun button toggles it. Theme and workspace selection remain in session-only React state. Reload returns to Personal and the system appearance.

## API

- `GET /api/health`: verifies both Postgres connectivity and the columns used by the tracker; indicates whether Realtime variables are configured, not whether a subscription is healthy
- `GET /api/workspaces`: database workspace IDs/names
- `POST /api/workspaces`: `{ "name": "Travel" }`
- `GET /api/expenses?workspace_id=<uuid>`: workspace ledger
- `POST /api/expenses?workspace_id=<uuid>`: `{ "amount": "123.45", "category": "food", "note": "Lunch", "spent_on": "2026-11-14" }`
- `DELETE /api/expenses/:id?workspace_id=<uuid>`: permanently deletes matching row
- `GET /api/events?workspace_id=<uuid>`: server-side Neon subscription forwarded through SSE, never exposing Realtime secrets

Omitted workspace IDs default to Personal for backward compatibility. Writes use parameterized SQL and Zod input validation. Cross-origin writes are rejected.

**Security:** authentication is disabled as requested. Every visitor can read all workspaces and add/delete expenses. Workspace separation is organization, **not access control**. Do not expose sensitive financial data publicly without authentication or deployment-level protection.

## Neon provisioning

`neon.ts` enables Realtime and disables auth. The initializer linked the requested project locally but did not verify access:

```sh
neon init -y --org-id org-plain-moon-11905093 --project-id wispy-bird-23536025 --branch production --services postgres,realtime
neon deploy
```

The sandbox could not reach the Neon control-plane API. A supplied PostgreSQL connection was configured locally, but authenticated database queries fail with `Connection terminated unexpectedly`. DNS and TCP connectivity alone do not prove database access. Run provisioning/migrations from a network with Neon access, and confirm the endpoint and credentials are active.

## Tests and verified results

```sh
npm test          # eight tests, including actual SQL migration checks in embedded PostgreSQL
npm run build    # production build, includes /api/[...path] as a dynamic route
npm start        # separate terminal
npm run test:smoke # eight real HTTP routing/validation checks, no database writes
npm run test:e2e # actual database workspace/create/read/isolation/delete + Realtime
```

For a different port or deployment, set `TEST_URL=https://your-deployment.vercel.app` (or local URL). Smoke checks are non-mutating. E2E creates and cleans up a temporary workspace and expense; its final workspace cleanup requires DATABASE_URL in the test runner. Run only against a test database. Vercel deployment protection, if enabled, must also permit the test runner.

Verified after the Vercel changes:

```text
npm test: 8 passed, 0 failed
npm run build: compiled successfully; TypeScript passed
Route (app): /, /_not-found
Route (pages): ƒ /api/[...path]
Next production server: ready
HTTP smoke checks: 8 passed
  Homepage: 200
  Invalid workspace name: 400
  Invalid expense amount: 400
  Invalid workspace ID: 400
  Invalid deletion ID: 400
  Unknown API route: 404
  Invalid JSON: 400
  Cross-origin write: 403
Database health: 503 (connection terminates unexpectedly)
```

Database migrations, actual persistence, and Neon Realtime remain **unverified** due to database connectivity. No published Vercel deployment has been tested. Build and routing readiness do not imply a working database.

## Follow-up: live database diagnosis and migration fix

The existing public production deployment was checked read-only:

- `/api/health` returned `{ "database": "connected", "realtime": false }`.
- `/api/workspaces` and `/api/expenses` both returned the old generic database request error.

This establishes that the deployed app can connect to Postgres; the earlier local connection failure is not evidence of a current production connection failure. Missing/outdated schema is a likely cause, but the old public error hides the precise SQL error. No credentials were decrypted and no production rows were changed during this investigation.

This branch changes the deployment pipeline to apply the existing SQL migrations, checks actual app columns in the health endpoint, and returns curated error codes (`DB_SCHEMA_MISSING`, `DB_AUTH_FAILED`, `DB_PERMISSION_DENIED`, `DB_NOT_CONFIGURED`, `DB_UNAVAILABLE`) without disclosing raw database errors. The dashboard no longer describes every ledger loading failure as an unreachable database.

Tests execute both SQL files against embedded PostgreSQL (test-only PGlite) and verify reruns, preservation of existing entries, workspace scoping, and deletion. This is not a substitute for a live Neon integration test. Production build and all eight unit/migration tests passed. A production Vercel build without DATABASE_URL was also verified to stop with a clear error.

**These changes must be deployed before the live site benefits.** The deployed version has not been changed by this investigation. On successful deployment, health should return `database: connected` and `schema: ready`; if a build migration fails, inspect that build's migration error code instead of repeatedly changing the connection string.
