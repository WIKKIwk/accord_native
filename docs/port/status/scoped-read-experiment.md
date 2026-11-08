# scoped-read-experiment

Status: isolated, opt-in research prototype. It is not imported by a role, merged to main, or approved for production use.

## Open items

| Where | What is needed |
|---|---|
| JS-to-native dispatch | A JavaScript scope check is not atomic with the actual native request. Expo fetch awaits body normalization before `request.start`; a logout or scope change in that interval can still allow an old token to be sent to the configured origin. A reliable native dispatch guard or session-change cancellation, with platform evidence, is needed. |
| Native redirects and credential stores | Expo SDK 58 source selects no cookies and no redirect following for the requested modes on Android, and disables request cookies and redirects in the iOS delegate. Real iOS/Android builds, custom network configurations and credential-store/challenge handling remain unverified. Post-response URL checking cannot undo a native leak if a platform follows an unexpected redirect. |
| Session lifetime | The existing epoch accessor does not detect all same-epoch A → B → A transitions, nor a failed login after a snapshot captured during that login; it publishes no change event. The caller must also enforce role, capability, UI lifetime and post-parse scope, but that does not by itself resolve the native dispatch gap. |
| Retry and parity | 401 is returned without reauthentication or retry; redirects are limited to the original HTTPS origin and plain-ASCII `/v1/mobile/` paths without percent-encoded segments. Backend/proxy normalization is not proven solely by this URL check. This intentionally differs from legacy V2 behavior and needs a product decision before use. Existing login's conditional credential redirect issue is not changed. |
| Resources and devices | A single body is fully buffered without a separate byte limit. Large-body limits and device memory behavior need review. No native build, real device, real credential or backend was used. |

## Prototype

`scopedRead` is a new standalone module with no production callers. It uses explicit `expo/fetch`, GET only, `credentials: omit`, manual redirects, a synchronous caller predicate and active-session object/token/epoch/scope checks before and after each JavaScript hop. Cross-origin, non-HTTPS, credential-bearing URL, non-mobile and encoded-path redirects are rejected by the JavaScript loop; this conservative path restriction can reject valid APIs. A mismatched response URL is detected only after the response arrives. Timeout or abort invalidates the operation so a late mocked redirect cannot initiate a later request.

The prototype does not edit `authorizedFetch`, auth, Worker, Preparation or their callers. It does not send login credentials or automatically refresh on 401. Existing application behavior is unchanged unless a future caller explicitly imports and invokes it, which remains prohibited until the open items are resolved.

## Verification

- 26 focused tests use synthetic sessions and a fake `expo/fetch`; they cover same-origin hops, cross-origin rejection, 401, callback scope changes, late timeout/abort, response URL mismatch and async guard failure. No real network was used.
- Existing auth and authorized-fetch regression tests passed. The full Node suite had 1,243 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker TypeScript errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
