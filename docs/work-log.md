# Work log

## 2026-11-13 (+03:00) — Recover and commit page-entry activation

- Request: commit the pending repository work and establish its provenance.
- Provenance: these changes were already present when this task began. They match T3 checkpoint `3fb02c2` from 2026-11-07 at 12:07:08 +03:00, but are absent from `origin/master` at `787ed10`. The original request and author are unknown; this recovery does not establish a merge or deployment.
- Behavior and purpose: allow teachers to log pages for inactive roster students and activate them after a successful save. Activation failures offer a retry without inserting pages again; ambiguous or missing roster names are rejected. English/Arabic messages and cache/URL documentation describe the behavior.
- Validation: `bun run build` passed; `bun run lint` passed with an existing fast-refresh warning in `src/i18n/LocaleContext.tsx`; both `bun test scripts/student-activation.test.js` (17 tests) and `bun test scripts/student-filter.test.js` (5 tests) passed. Build also reported the bundle-size warning. Google Sheets calls were mocked in tests; live Sheets/browser behavior was not exercised.

## 2026-11-13 (+03:00) — Require agents to document and commit work

- Request/reason: prevent unexplained uncommitted edits and make the date, purpose, and verification of agent work discoverable.
- Changes: added repository Git etiquette requiring dated work-log entries, focused commits before handoff (including labeled WIP), staged-diff inspection, and final commit/status verification. Preserve unrelated edits and existing history; obtain authorization for pushes and worktrees. Corrected the outdated statement that the repository has no tests.
- Standing preference: also added Git etiquette to `C:/Users/ASUS/.codex/AGENTS.md` so it applies across repositories. That global file is outside a Git repository; this entry records the change. Its existing Windows, delegation, worktree, tool, and managed log-pool instructions were preserved.
- Validation: read both resulting instruction files and reviewed the staged documentation diff with `git diff --cached --check`. Repository build, lint, and 22 tests passed before this documentation-only update; warnings and live-integration limits are recorded above.
