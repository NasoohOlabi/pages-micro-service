# Server data cache

React Query owns server data. Components use `useQuery`; form drafts and URL state stay separate. One `QueryClient` is provided in `src/main.tsx`.

| Data | Fresh for | Retained while unused |
| --- | --- | --- |
| Roster | Until explicit refresh or conflict | Indefinitely; also saved across reloads |
| Roster tab title | Until explicit refresh | Indefinitely; also saved across reloads |
| Teachers | Until explicit refresh | Indefinitely; also saved across reloads |
| Page, points, CST logs | 15 minutes | 4 hours in memory |
| Attendance | 15 minutes | 4 hours in memory |

Fresh queries are reused and concurrent requests are deduplicated. Successful stale queries refresh when their screen is opened. Window focus and network reconnects do not trigger requests; there is no polling. Queries and mutations have no automatic retries, and revisiting a failed query does not retry it. The existing token handler still refreshes a rejected Google token once. Retry buttons explicitly refetch failed roster queries.

The signed-in **Refresh data** button invalidates cached data but fetches only active queries. Unused data waits until its screen is opened. The button has a one-minute cooldown to avoid repeated bursts, and reports refresh failures. Student and teacher lists do not automatically pick up other teachers' changes; use this button to fetch them.

Only the selected top-level tab and pages sub-tab mount. Student attendance history loads only when a roster row is expanded. Opening page entry does not load page statistics, points, CST or attendance logs.

## Roster

Groups, activation, autocomplete, student lists, finals, memorization, and the global active filter derive from one roster query. The cache retains blank rows so row numbers remain accurate.

A warm status change makes two requests: a targeted row read to verify identity and status, then a column F write. A group change uses one batch read for the header and student row, then a group-cell write. Successful writes immutably patch the shared cache; they do not reload the roster. Failed writes leave the last confirmed value and mark the roster stale so the next access can reload it. Patching preserves the original snapshot timestamp.

Roster and page/points/CST appends request confirmed formatted values in the append response and patch a warm cache when the returned physical rows are contiguous with the cached snapshot. They do not issue a post-save read. If the server reports a gap, the snapshot changed during the write, or response details are unavailable, only the affected cache is invalidated for the next access. Concurrent out-of-order append responses cannot turn an incomplete snapshot into a fresh cache. Page statistics and memorization share raw sheet values, with separate projections for archived rows. Duplicate-page checks explicitly fetch fresh values before writing.

Page entry offers inactive students regardless of the global filter. `savePageRows` appends pages, then explicitly ensures the student's column F is TRUE using a targeted live row read. Already active students need no status write. If activation fails after the append, the form reports that the pages were saved and offers an activation-only retry. The duplicate-page “log remaining pages” action uses the same save path.

Attendance saves fetch current sheet data before writing and skip unchanged statuses. Group and multi-student saves send all changed cells and any new date header in one `values.batchUpdate` call: one fresh read plus at most one write, regardless of group size. Empty saves make no requests. Successful cells patch the shared attendance cache, including history; failed batches do not patch it. There is no post-save reload.

Roster data, its tab title, and teacher lists are saved in `localStorage` under `quran-reference-cache-v1`, scoped to the signed-in email and the query's spreadsheet configuration. Their contents and timestamps are validated before restoration. Invalidations are saved too, so a deferred refresh still occurs after a reload. Blocked, full or corrupt storage falls back to in-memory caching. Logs and attendance are never persisted.

All caches, including the saved browser copy, clear on sign-out or account changes. In-flight roster mutations and log appends from an older session cannot repopulate the new session's cache. Normal browser reloads preserve reference data for the same signed-in account.

## Verification

```sh
bun test scripts/student-activation.test.js scripts/student-filter.test.js
bun run build
bun run lint
```

The checks exercise real query caches and observers with the Google API boundary replaced by a local fixture. They assert request counts, indefinite reference freshness, reload restoration, storage failure handling, explicit/deferred refresh, deduplication, targeted and batched writes, failure handling, account isolation, archived-page projections, and append cache updates and invalidation.

API behavior follows the official [Sheets append response](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append) and [values.batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate) contracts. Automatic refetch behavior follows [TanStack Query's query options](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery).
