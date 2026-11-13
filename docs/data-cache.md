# Server data cache

React Query owns server data. Components use `useQuery`; form drafts and URL state stay separate. One `QueryClient` is provided in `src/main.tsx`.

| Data | Fresh for | Retained while unused |
| --- | --- | --- |
| Roster | 5 minutes | 15 minutes |
| Roster tab title | 1 hour | 1 hour |
| Teachers | 15 minutes | 30 minutes |
| Page, points, CST logs | 1 minute | 15 minutes |
| Attendance | 30 seconds | 15 minutes |

Fresh queries are reused and concurrent requests are deduplicated. Stale queries refresh when mounted or when the network reconnects. Window focus does not trigger requests; there is no polling. Queries and mutations have no automatic retries; the existing token handler still refreshes a rejected Google token once. Retry buttons explicitly refetch failed roster queries.

## Roster

Groups, activation, autocomplete, student lists, finals, memorization, and the global active filter derive from one roster query. The cache retains blank rows so row numbers remain accurate.

A warm status change makes two requests: a targeted row read to verify identity and status, then a column F write. A group change uses one batch read for the header and student row, then a group-cell write. Successful writes immutably patch the shared cache; they do not reload the roster. Failed writes leave the last confirmed value and mark the roster stale. Patching preserves the original snapshot timestamp so repeated writes do not indefinitely postpone fetching other teachers' changes.

Adding a student invalidates the roster once, since Sheets chooses the appended row. Page/points/CST appends invalidate only their affected sheet. Page statistics and memorization share raw sheet values, with separate projections for archived rows. Duplicate-page checks explicitly fetch fresh values before writing.

Page entry offers inactive students regardless of the global filter. `savePageRows` appends pages, then explicitly ensures the student's column F is TRUE using a targeted live row read. Already active students need no status write. If activation fails after the append, the form reports that the pages were saved and offers an activation-only retry. The duplicate-page “log remaining pages” action uses the same save path.

Attendance saves fetch current sheet data before writing and patch successful cells into the shared attendance cache, including history. They do not reload the whole sheet after each save.

All caches clear on sign-out or account changes. In-flight roster mutations from an older session cannot repopulate the new session's cache. No spreadsheet data is persisted to browser storage.

## Verification

```sh
bun test scripts/student-activation.test.js scripts/student-filter.test.js
bun run build
bun run lint
```

The checks exercise real query caches and observers with the Google API boundary replaced by a local fixture. They assert request counts, freshness, deduplication, targeted writes, failure handling, account isolation, archived-page projections, and invalidation after appends.
