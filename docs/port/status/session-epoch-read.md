# session-epoch-read

Status: a read-only accessor for the existing in-memory session epoch is prepared; no role route is enabled.

## Open items

| Where | What is needed |
|---|---|
| Role consumers | New role code must snapshot `activeSessionEpoch(session)` and combine it with active object identity, role, capability and read-scope checks before and after asynchronous work and before every request/retry. The accessor is not wired into any role by itself. |
| Same-epoch transitions | Existing `saveSession` can replace and later restore a session object without incrementing `sessionEpoch`. An A → B → A sequence through that path is not detected by this accessor. Do not claim a complete session generation guarantee. |
| In-progress login | The epoch increments when login starts, but an operation started afterward may capture the new epoch while the previous session object remains active. A failed login can leave that object active. The accessor alone does not block that operation. |
| Session UI updates | Reading the epoch does not publish a change event. Role shells must arrange safe remount/visibility when active identity or scope changes. |
| Existing login transport | The previously documented conditional credential redirect risk remains open; this checkpoint changes no login or transport behavior. |

## Checkpoint

`activeSessionEpoch(session)` returns the existing process-local `sessionEpoch` only if the exact session object is currently active, otherwise `null`. It writes nothing, creates no credential or persistent access, and does not alter login, refresh, account switching or Worker/Preparation behavior. In-place token refresh keeps the epoch; login attempts, clear and account-switch installation increment the existing counter. The value is not a persistent identifier.

The auth regression cases cover a failed login which restores the same object, token refresh, clear, inactive sessions, and the known same-epoch `saveSession` A → B → A limitation, and a snapshot taken after a login attempt starts but before it fails. Tests use synthetic sessions and mocked responses, never real credentials or a backend.

## Verification

- 26 auth rollback and epoch tests passed; iOS TypeScript passed after regenerating this worktree's Expo route declarations.
- The full Node suite had 1,208 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker TypeScript errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
