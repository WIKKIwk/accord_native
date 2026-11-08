# apparatus-read-guard

Status: an opt-in send guard is prepared for the existing apparatus reader; no role route is enabled.

## Open items

| Where | What is needed |
|---|---|
| Guard scope | A caller must synchronously check the active session object, epoch, role, capabilities and read scope before initial send and after every awaited read/parse. This optional callback is not a session-change subscription and does not solve documented epoch limitations. |
| Redirects | Existing `authorizedFetch` calls `beforeSend` before the initial GET and a 401 retry, not before each followed GET redirect hop. A scope change between redirects can therefore precede a later hop. Do not treat this callback alone as a complete session-safety boundary. |
| Protected readers | This checkpoint does not change `workerRawMaterials.ts` or any Worker/Preparation source or caller. The assignment reader in that file has a separate unresolved scope guard need. |
| Native verification | Tests use mocked HTTP; no real backend or device was used. |

## Checkpoint

The existing `adminApparatus` and `readApparatus` accept an optional synchronous `beforeSend` callback. The old call path and arguments remain unchanged when it is omitted. An opt-in guard failure is returned to the caller unchanged and is not treated as a transient `TypeError` for the outer retry. Existing timeouts, abort behavior, 150 ms retry delay, parsing and legacy default behavior are retained.

This is an additive safety hook, not a claim of complete response isolation, redirect safety, or permission parity. It does not modify `authorizedFetch`, login or any existing role route.

## Verification

- Five existing apparatus tests and nine focused mocked guard, 401, retry and abort cases passed; iOS TypeScript passed.
- The full Node suite had 1,217 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker TypeScript errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
