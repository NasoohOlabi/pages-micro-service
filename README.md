# Quran Page Log

Railway hosts the React app and Bun API. Teachers sign in with Google. The server calls Sheets with each teacher's permissions and stores OAuth credentials in SQLite on the Railway volume. The browser receives an HTTP-only session cookie. Firebase Hosting serves a link to the new site.

## Development

Copy .env.example to .env.local and fill in the Google OAuth web client and sheet settings. Register APP_ORIGIN/auth/callback as an authorized Google redirect URI. Run bun install, then bun run dev:api and bun run dev in separate terminals. Run bun run build and bun run lint to check changes.

## Production

Deploy the Dockerfile with bunx @railway/cli up to the quran-page-log service. Set APP_ORIGIN to the HTTPS public origin and mount a persistent volume at /data. Use one service replica for SQLite sessions and serialized sheet writes. To publish the migration link, run bunx firebase-tools deploy --only hosting --project pages-micro-service.
