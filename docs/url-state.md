# Query state

View state lives in the query string so a pasted link restores the same screen. Tabs, sub-tabs, filters, dates, search, and chart views are query state. Drafts, toasts, and auth are not.

There is no router. Firebase already rewrites every path to `index.html`. Search params are the URL.

All reads and writes go through `src/url/queryState.ts` (`useQueryState`). Components do not call `URLSearchParams`, `pushState`, or `replaceState`.

## Owned keys

Each tab owns a closed set of keys. Changing tabs drops every key the new tab does not own.

| Tab | Keys | Defaults (omitted from the URL) |
| --- | --- | --- |
| pages | `tab`, `sub`, `view`, `from`, `to`, `student` | `tab=pages`, `sub` absent = log, `view=students`, month range written on first stats visit |
| points | `tab` | none besides `tab=points` |
| attendance | `tab`, `sub`, `date`, `group` | `sub` absent = student, `date` absent = today, `group` only when `sub=group` |
| students | `tab`, `sub`, `q` | `sub` absent = list, `q` absent = no filter |
| finals | `tab`, `factor` | `factor` absent = `1` |

`sub` is one key with a per-tab enum. Legal values never overlap: `stats` (pages), `group` (attendance), `add` (students). A new sub-tab value must be unique across the app, or it needs its own key.

Examples:

```
?tab=pages&sub=stats&view=coverage&from=2026-08-01&to=2026-08-31&student=Ahmad
?tab=attendance&sub=group&date=2026-09-05&group=A
?tab=students&q=ahmad
?tab=finals&factor=1.5
```

## History

- `pushState` for tab and sub-tab changes. Back returns to the previous screen.
- `replaceState` for filters (`from`, `to`, `student`, `date`, `group`, `q`, `factor`, `view`). Date-picker keystrokes must not pile up history.

Omit a key when it equals the default. Do not `replaceState` a default into the URL except stats `from`/`to`: on first visit to stats with neither param, write this month's resolved ISO dates so a copied link is an absolute range.

Stats presets: week and month write resolved `from`/`to`. All-time deletes both.

## Stays in React

Form drafts (pages log, points, add student). Autocomplete open/highlight. Attendance status radios and selected-student chips. Stats "show all" and the selected time-chart bar. Roster row expansion. Locale (`localStorage`). Sheet payloads, load flags, toasts, Google token.

A new `useState` belongs in React when it is a draft, a transient widget, or fetched data. It belongs in the query string when another teacher should see the same screen from a pasted link.

## Adding a key

1. Add it to that tab's owned-key list and the parse/serialize in `src/url/queryState.ts`.
2. Read it from `useQueryState()`. Write it with `replaceState` (filter) or `pushState` (tab/sub-tab).
3. Give it a default that is omitted from the URL.
4. Confirm a pasted URL restores the screen, and that switching tabs drops the new key.

Done when the key is in the owned-key table above, no new `popstate` listener exists, and `bun run build` passes.
