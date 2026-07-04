# AGENTS.md

Quran Page Log: a React/TypeScript SPA (Vite) that lets teachers log student Quran-page recitations directly into a Google Sheet. No backend — auth and data access happen client-side via Google Identity Services and the `gapi` Sheets client.

## Commands

Use **bun** for everything — this repo has a `bun.lock`, not a `package-lock.json` or `yarn.lock`.

```sh
bun install              # install deps
bun run dev               # dev server (Vite)
bun run build              # tsc -b && vite build — must pass before considering a change done
bun run lint                # oxlint
bun run preview              # preview a production build
```

There is no test suite. Treat `bun run build` (type-check) and `bun run lint` as the verification bar for any change.

## Code layout

- [src/auth/](src/auth/) — Google sign-in (`useGoogleAuth` loads GIS + gapi scripts, manages the access token and user profile)
- [src/sheets/](src/sheets/) — Sheets API access: [sheetsClient.ts](src/sheets/sheetsClient.ts) (append/read the log sheet, dedupe), [rosterClient.ts](src/sheets/rosterClient.ts) (fetch student names for autocomplete), [schema.ts](src/sheets/schema.ts) (zod schema + column order — must match `VITE_SHEET_RANGE`)
- [src/form/](src/form/) — the entry form: [EntryForm.tsx](src/form/EntryForm.tsx), [StudentAutocomplete.tsx](src/form/StudentAutocomplete.tsx) (fuse.js fuzzy search), [fields.ts](src/form/fields.ts) (field metadata)
- [src/config.ts](src/config.ts) — reads/validates `VITE_*` env vars; throws on startup if any are missing
- [src/App.tsx](src/App.tsx) — top-level sign-in / form switch

## Conventions

- Functional components, hooks, no class components.
- No semicolons, single quotes — match the existing style (oxlint/formatting is not auto-fixing, so follow surrounding code by eye).
- Styling is Tailwind utility classes inline in JSX; no CSS modules or styled-components.
- Errors that mean "you don't have sheet access" should be raised as `SheetsAccessError` (see [sheetsClient.ts](src/sheets/sheetsClient.ts)) so the UI can show a friendly message instead of a generic failure.
- `COLUMN_ORDER` in [schema.ts](src/sheets/schema.ts) must stay in sync with the actual sheet columns and `VITE_SHEET_RANGE` — if you add/reorder a form field that maps to a sheet column, update both.
- Comments are rare and only used to explain non-obvious *why* (e.g. the column-order/range coupling, the roster-cache lifetime). Don't add explanatory comments for self-evident code.
- Env vars are accessed only through [src/config.ts](src/config.ts), never `import.meta.env` directly in components.

## Environment

Local dev needs a `.env.local` (see [.env.example](.env.example)) with Google OAuth + two spreadsheet configs (entry log + roster). Without these, `config.ts` throws on load.

## Deployment

The git remote (`origin`) only has a `master` branch, but the CI workflow ([.github/workflows/firebase-hosting.yml](.github/workflows/firebase-hosting.yml)) only triggers on push to `main`, and it deploys to Firebase project `mrp-masjid-al-botty`. So pushing to `master` never triggers that CI deploy.

**Always deploy locally when asked to deploy** — don't rely on CI. Run the Firebase CLI directly:

```sh
bun run build
npx firebase-tools deploy --only hosting --project pages-micro-service
```

The locally logged-in Firebase account only has access to the `pages-micro-service` project (per [.firebaserc](.firebaserc)), which differs from the project the CI workflow targets — always deploy straight to `pages-micro-service`.
