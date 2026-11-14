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
   This applies `db/001_expenses.sql`, `db/002_workspaces.sql`, and `db/003_investments.sql`. Existing expenses are retained in the **Personal** workspace. The migrations are idempotent, preserve existing expenses, and use a database advisory lock to serialize concurrent deployments. They never run inside API requests. Use a separate Neon branch/database for preview deployments to avoid sharing production financial data.
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

## Investment portfolio and multi-month spending

### Portfolio

The dashboard now includes a workspace-specific **Investments** section, with its own holdings view. Investment contributions also count toward main spending totals; previous/opening holdings do not. All portfolio entries are persisted in PostgreSQL (`investments` table); there is no browser-storage fallback.

- Add monthly/one-time contributions with an investment date, including previous months.
- Add **Previous holdings** using original invested cost, a holdings-as-of date, and optional statement units. Do not duplicate those holdings with individual old contributions.
- Edit entries later to fill in allotted units or correct cost/date; delete with confirmation. Deleting here only removes a tracking record, never places a fund redemption.
- History defaults to all months, with a month filter. Portfolio summary always covers all stored entries, regardless of the history filter.
- Monthly contribution bars exclude opening/previous holdings so they do not inflate a month's contribution amount.
- Total invested uses original cost. Current value is total actual statement units multiplied by the latest fetched NAV; unrealized gain is that value minus cost. Return is absolute, not annualized/XIRR. No redemptions, trading, dividend accounting, fees, tax, or investment recommendations are implemented.
- All entries need actual units for whole-portfolio value/gain. Amount-only records are allowed and cost remains tracked, but valuation stays unavailable until every entry has units. The app does not divide historical investments by today's NAV or guess allotment prices.

### Fund data

The selected instrument is **HDFC Mid Cap Fund — Regular Plan — Growth Option**, AMFI scheme **105758**, not the Direct plan and not a stock. `GET /api/fund` fetches `https://api.mfapi.in/mf/105758/latest` from the server with a timeout, validates the scheme and NAV, and returns the NAV date, fetch timestamp, and source. No provider secret is needed.

Mutual funds publish daily NAVs on business days, not streaming stock quotes. The section refreshes NAV and portfolio every five minutes, on page focus, and offers manual NAV refresh. If a refresh fails, the last fetched value is visibly marked as possibly stale; if no data is available, no fabricated NAV is displayed. NAV fetching is independent of database access, and contributions can be saved even if the provider is down.

The provider response was confirmed through the page-fetch tool for the exact Regular Growth scheme. This sandbox's application runtime cannot reach `api.mfapi.in` because of its outbound network restrictions; the actual runtime HTTP check therefore correctly returned `502 NAV_UNAVAILABLE`. Successful live NAV fetching from the deployed Vercel function still needs checking after deployment. No test fixture is served as live NAV.

### Spending across months

Spending now defaults to **All time**, so food entries in different months both appear. All-time spending rhythm groups records by month. Monthly view includes a month picker and explicitly shows how many expenses are hidden in other months, with a **Show all months** control. Category filters still apply to the transaction list.

### Additional API routes

All investment reads/writes/deletes use `?workspace_id=<uuid>` and parameterized SQL:

- `GET /api/investments`: all entries for the workspace
- `POST /api/investments`: `{ "amount": "2500.00", "invested_on": "2025-01-15", "kind": "contribution", "units": "12.1234", "note": "January SIP" }`; omit units when unknown; kind can also be `opening`
- `PUT /api/investments/:id`: update the same fields, scoped to workspace
- `DELETE /api/investments/:id`: delete the workspace's matching entry
- `GET /api/fund`: latest published dated NAV for scheme 105758

Vercel's existing migration step applies `003_investments.sql` before deployment; health checks now also verify investment columns. No existing expense rows are modified. Authentication remains disabled; workspace separation is not access control.

### Verification for this change

- `npm ci`: passed (initial tests could not run until dependencies were installed in the fresh checkout).
- `npm test`: **12 passed**, including actual PostgreSQL migration SQL, previous-month expense preservation, backdated investments, workspace scoping, exact fund selection, and upstream failure handling. Embedded PostgreSQL is test-only.
- `npm run build`: **passed**, including TypeScript. An initial chart type mismatch was corrected before the successful build.
- `npm run test:smoke`: **13 passed**, including new investment input, date, workspace, update-ID, and delete-ID checks.
- Local `/api/fund`: correct explicit `502 NAV_UNAVAILABLE` under sandbox network restrictions.
- No production deployment or production database writes were performed for this change. Live investment persistence and provider access on Vercel need verification after merging/deploying.

### Contributions included in total spending

Investment **contributions** now count toward the main spending total, daily average, spending rhythm, category charts, transaction list, and CSV exports. They appear as an **Investments** spending group and use their investment dates for month filtering. The original six expense-entry categories remain unchanged.

This is a derived view of the existing database rows: an investment does not create a second expense row. Adding/editing/deleting in the portfolio immediately reloads the main dashboard. Deleting an investment from the main list removes the original investment row and refreshes the portfolio. Monthly filters and workspace boundaries apply to both sources.

Spending counts the contributed amount at cost, never current market value or NAV gains. **Previous holdings** remain part of total invested but are excluded from spending because they represent an opening balance. Do not manually add the same investment again as an ordinary expense.

Follow-up validation: `npm test` **14 passed**, `npm run build` passed. Tests cover inclusion exactly once, opening-holdings exclusion, investment month filtering, edit/delete recomputation, and correct deletion routing. Live investment persistence and NAV runtime verification still require deployment as noted above.

## Portfolio growth chart and layout refinement

The investment section now shows **Watch your portfolio grow**, comparing cumulative original invested cost with historical portfolio value in INR. It includes 1M, 6M, 1Y, and All ranges, dated tooltips, cost/value/gain summaries, and explicit loading/empty/provider-error states. The range is measured back from the latest available chart date, independent of the investment-history table filter.

Historical valuation uses the statement units recorded on or before each chart date multiplied by that date's NAV. It does not apply today's NAV to earlier dates or treat contributions as investment returns. Previous holdings begin on their recorded holdings-as-of date; the app does not reconstruct earlier ownership. Non-publishing dates use the last preceding published NAV, whose date is shown in the tooltip. Entries missing units cause the value curve to become unavailable from that entry onward, while invested cost remains visible. Later edits/deletions recompute the chart. No withdrawals/redemptions or annualized returns are modeled.

`GET /api/fund/history` retrieves historical NAV from `https://api.mfapi.in/mf/105758`, validates the exact Regular Growth scheme and every data point, deduplicates dates, and returns chronological data. The public fund history (not user data) is cached on the server for five minutes. The chart refreshes every five minutes and has a manual refresh button. Workspace-specific investments continue to come only from the database. Provider failures return `502 NAV_HISTORY_UNAVAILABLE`; retained history is labeled as potentially stale. No fabricated NAV or locally persisted portfolio data is used.

UI improvements use consistent section gaps, equal-width/aligned summary cards, stable chart heights, readable wrapping footnotes, normalized panel padding and corners, balanced category cards, better fund-card alignment, larger controls, mobile stacking, and reduced-motion support. Icon-only navigation now has accessible names. Dark mode is retained.

### Checks for this change

- `npm test`: **20 passed**, including historical valuation, contribution timing, preceding business-day NAV, missing-unit gaps, opening balances, edits/deletions, range filtering, scheme validation, history sorting, and duplicate dates.
- `npm run build`: **passed** including TypeScript.
- `npm run test:smoke`: **13 passed** against the production Next.js server.
- Runtime `/api/fund/history`: expected **502 NAV_HISTORY_UNAVAILABLE** under this sandbox's outbound restrictions. Live provider success from Vercel still requires verification after deployment.
- No production database records were changed and no deployment was published. No new database migration or environment variable is required.

## Mobile and web production-hardening pass

- Mobile bottom navigation with visible labels, scroll-aware active state, notch/home-indicator safe-area spacing, and a sticky workspace bar.
- Transactions and investment history become stacked, labeled cards on small screens instead of forcing sideways table scrolling. Desktop tables remain intact.
- Larger touch controls; 16px mobile input/select text to prevent iOS auto-zoom; zoom remains enabled. Dialogs scroll within dynamic viewport height and keep actions usable on shorter screens.
- Accessible skip link, named icon controls, reduced-motion CSS, a recoverable page error boundary, and responsive chart/form sizing.
- Portfolio code is split into its own chunk. Polling pauses in hidden tabs. Optional Realtime is probed before subscribing, stops in hidden tabs, and reconnects with bounded exponential backoff. History refreshes on focus. No user data is stored offline.
- Added nosniff, referrer, and permissions-policy headers; removed the framework-identifying response header. Existing Vercel iframe previews are not blocked.
- `npm run test:smoke` now also checks response security headers.

### Browser and CI checks

The real Chromium script `scripts/ui-smoke.mjs` covers 320px, 390px, 768px, and 1440px viewports: document overflow, long transaction notes, dialog bounds, mobile input text sizing, bottom navigation/tap targets, active section state, dark mode, and client exceptions. It uses clearly isolated API fixtures and therefore **does not** prove live database or NAV access. Screenshots go to Git-ignored `test-results/`.

On a machine with Playwright browser dependencies:

```sh
npx playwright install --with-deps chromium
npm run build
npm run test:ui:serve
```

Alternatively, start the server separately and run `TEST_URL=http://localhost:3000 npm run test:ui`. `CHROMIUM_PATH` can specify a compatible locally installed Chromium. The GitHub Actions workflow runs unit tests, the production build, installs Chromium with OS dependencies, runs browser checks, and uploads screenshots.

Local validation: production build passed; the unit/migration/growth suite passed; 13 production HTTP checks passed including security headers; production dependency audit reported zero vulnerabilities. The initial local Chromium launch failed because `libnspr4.so`/NSS system libraries are absent. Browser assertions are **not marked passed** locally; their CI run remains pending. The temporary bundled-browser dependency used to diagnose this was removed; standard Playwright is retained as a dev-only tool.

No deployment was published and no production data was modified. Live database/NAV checks and a real-device Safari/Android check remain release gates. Authentication is still intentionally disabled: all visitors can access every workspace. This must not be described as private multi-user financial storage; add authentication or deployment protection before exposing sensitive data.
