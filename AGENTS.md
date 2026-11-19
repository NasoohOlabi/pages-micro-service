# AGENTS.md

Quran Page Log is a React/TypeScript app teachers use to record Quran recitation, points, sabr, and attendance. Railway runs the Bun server for Google OAuth, sessions, and Sheets requests.

## Git etiquette and work records

- Start each task by inspecting `git status` and the existing diff. Preserve unrelated work; include pre-existing edits only when the user authorizes it.
- Document every change task in [docs/work-log.md](docs/work-log.md): date with timezone, the request and reason, what changed, verification results, and remaining limitations. Record the start time when known; label recovered work and unknown provenance honestly.
- Always commit your work before handing back to the user, unless they explicitly request otherwise. Commit coherent units as you go during longer tasks. If interrupted or incomplete, make a clearly labeled WIP commit with the remaining work and failed checks documented.
- Stage explicit paths or hunks, inspect the entire staged diff, and run `git diff --cached --check` before committing. Use a descriptive subject and a body explaining what changed, why, and how it was verified; reference the work log. Update behavior documentation in the same commit as the behavior.
- Verify the commit with `git log -1` and `git status --short`. Finish with all your changes committed, report the commit hashes and any remaining changes, and state whether anything was pushed. If Git prevents a commit, report the exact blocker and affected paths rather than claiming completion.
- Preserve existing history; amend, rewrite history, push, or create worktrees only when the user authorizes that action.

## Commands

Use **bun** for everything — this repo has a `bun.lock`, not a `package-lock.json` or `yarn.lock`.

```sh
bun install              # install deps
bun run dev:api          # Bun API on port 3000
bun run dev              # Vite client on port 5173
bun run build              # tsc -b && vite build — must pass before considering a change done
bun run lint                # oxlint
bun run preview              # preview a production build
```

Run `bun run build` (type-check) and `bun run lint` for changes. For student activation, page logging, or visibility changes, also run `bun test scripts/student-activation.test.js` and `bun test scripts/student-filter.test.js`. For auth, Sheets transport, or Railway API changes, run `bun test scripts/railway-api.test.js`.

## Code layout

- [src/auth/](src/auth/) — reads the server session and starts Google sign-in
- [server/](server/) — Google OAuth, SQLite sessions, and scoped Sheets operations. Keep Google credentials on the server.
- [src/sheets/](src/sheets/) — Sheets API access: [sheetsClient.ts](src/sheets/sheetsClient.ts) (append/read the log sheet, dedupe), [rosterClient.ts](src/sheets/rosterClient.ts) (fetch student names for autocomplete), [schema.ts](src/sheets/schema.ts) (zod schema + column order — must match `SHEET_RANGE`)
- [src/form/](src/form/) — screens that write data: [PagesTab.tsx](src/form/PagesTab.tsx) (log vs stats), [EntryForm.tsx](src/form/EntryForm.tsx), [PointsForm.tsx](src/form/PointsForm.tsx), [AttendanceForm.tsx](src/form/AttendanceForm.tsx), [RosterView.tsx](src/form/RosterView.tsx)
- [src/stats/](src/stats/) — read-only views: [PagesStats.tsx](src/stats/PagesStats.tsx), [FinalsView.tsx](src/stats/FinalsView.tsx)
- [src/url/](src/url/) — query state ([queryState.ts](src/url/queryState.ts) / `useQueryState`). Use this module to change the selected view.
- [src/config.ts](src/config.ts) — logical sheet names shared by browser and server
- [src/App.tsx](src/App.tsx) — sign-in and the top-level tab switch (`tab` query param)

## Conventions

- Functional components, hooks, no class components.
- No semicolons, single quotes — match the existing style (oxlint/formatting is not auto-fixing, so follow surrounding code by eye).
- Styling is Tailwind utility classes inline in JSX; no CSS modules or styled-components.
- Errors that mean "you don't have sheet access" should be raised as `SheetsAccessError` (see [sheetsClient.ts](src/sheets/sheetsClient.ts)) so the UI can show a friendly message instead of a generic failure.
- `COLUMN_ORDER` in [schema.ts](src/sheets/schema.ts) must stay in sync with the actual sheet columns and `SHEET_RANGE` — if you add/reorder a form field that maps to a sheet column, update both.
- Comments are rare and only used to explain non-obvious *why* (e.g. the column-order/range coupling, the roster-cache lifetime). Don't add explanatory comments for self-evident code.
- Read runtime Sheets configuration on the server. Use [src/config.ts](src/config.ts) for logical sheet names.
- Query state — tabs, sub-tabs, filters, dates, search, and chart views live in the query string. Read [docs/url-state.md](docs/url-state.md) before adding a tab, filter, or `useState` that decides what the screen shows.

## Environment

Copy [.env.example](.env.example) to .env.local and fill in the server settings. Register the APP_ORIGIN/auth/callback redirect with Google.

## Deployment

Fetch origin and confirm the deployment source contains current origin/master. Push verified changes to master when authorized. Deploy that revision to the existing Railway service using the instructions in [README.md](README.md). Verify the Railway deployment and a production health request.

Firebase Hosting serves the migration link from firebase-landing. Use the Firebase CLI with --project pages-micro-service when that page changes.
