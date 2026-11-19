# Quran Page Log

Railway hosts the React app and Bun API. Teachers use it for recitation, memorization, attendance, points, CST, roster, groups, activation, and Finals reports with PDF export. Teachers sign in with Google. The server calls Sheets with each teacher's permissions and stores OAuth credentials in SQLite on the Railway volume. The browser receives an HTTP-only session cookie with a rolling lifetime. The server refreshes Google access tokens as needed. Firebase Hosting serves a link to the new site.

## Development

Copy .env.example to .env.local and fill in the Google OAuth web client and sheet settings. Register APP_ORIGIN/auth/callback as an authorized Google redirect URI. Run bun install, then bun run dev:api and bun run dev in separate terminals. Run bun run build, bun run lint, and bun test to check changes. The Railway API test starts a local server and supplies fixture Google responses.

## Production

Fetch and verify origin/master, then deploy the committed revision with bunx @railway/cli up to the quran-page-log service. Check the deployment status and its /health endpoint. Set APP_ORIGIN to the HTTPS public origin and mount a persistent volume at /data. Set the worksheet ranges in Railway, including CST_SHEET_RANGE (defaults to CST!A2:D). Use one service replica for SQLite sessions and serialized sheet writes. To publish the migration link, run bunx firebase-tools deploy --only hosting --project pages-micro-service.
