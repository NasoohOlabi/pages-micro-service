# Quran Page Log

A small React + TypeScript app for logging which Quran page each student has recited to, backed directly by a Google Sheet (no server). Teachers sign in with Google, search for a student, and log a page; entries are appended to the configured sheet via the Sheets API, with duplicate-entry protection.

## Stack

- [Vite](https://vitejs.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) for form state/validation
- [fuse.js](https://www.fusejs.io/) for fuzzy student-name search
- Google Identity Services + `gapi` client for auth and the Sheets API
- [Oxlint](https://oxc.rs/) for linting
- Deployed to Firebase Hosting

Package manager is **bun** — use `bun`, not `npm`/`yarn`/`pnpm`.

## Setup

```sh
bun install
cp .env.example .env.local
```

Fill in `.env.local`:

| Var | Description |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID for Google sign-in (Sheets + userinfo scopes) |
| `VITE_SHEET_ID` | Spreadsheet ID where entries are logged |
| `VITE_SHEET_RANGE` | Data range, header row excluded (e.g. `Sheet1!A2:D`) |
| `VITE_ROSTER_SHEET_ID` | Spreadsheet ID holding the student roster |
| `VITE_ROSTER_GID` | gid of the roster tab (from the sheet URL's `#gid=...`) |
| `VITE_ROSTER_NAME_COLUMN` | Column letter in the roster tab holding student full names |
| `VITE_TEACHERS_SHEET_ID` | Spreadsheet ID holding the Teachers tab |
| `VITE_TEACHERS_SHEET_NAME` | Tab name (in `VITE_TEACHERS_SHEET_ID`) listing teachers |
| `VITE_TEACHERS_NAME_COLUMN` | Column letter in the teachers tab holding teacher full names |
| `VITE_TEACHERS_EMAIL_COLUMN` | Column letter in the teachers tab holding teacher emails |

## Scripts

```sh
bun run dev       # start the Vite dev server
bun run build     # type-check (tsc -b) then build for production
bun run lint      # run oxlint
bun run preview   # preview the production build locally
```

## Deployment

Pushes to `main` trigger [.github/workflows/firebase-hosting.yml](.github/workflows/firebase-hosting.yml), which builds with bun and deploys `dist/` to Firebase Hosting (project `mrp-masjid-al-botty`). Build-time env vars come from GitHub Actions repo variables (`VITE_GOOGLE_CLIENT_ID`, `VITE_SHEET_ID`, `VITE_SHEET_RANGE`); the roster vars currently aren't wired into CI.
