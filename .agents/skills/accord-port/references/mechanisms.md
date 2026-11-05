# V2 mechanisms to preserve

These cross-cutting behaviours are easy to lose because no single screen shows them. V4 status is from
2026-11-05. "Audit" means V4 has something similar that nobody has compared line by line.

## Transport

| Mechanism | V2 behaviour | V2 source | V4 status |
|---|---|---|---|
| Request timeout | 10 s per request; `_post` and `_put` can override it | `mobile_api.dart` `_requestTimeout` | Differs: `workerApi.ts` uses 5 s and 15 s, and other calls have none |
| Resilient GET | Only when `retryTransient` is set, never for mutations. 2 attempts, 10 s each, 15 s total, 150 ms apart. Retries on 502, 503, 504, on timeout, on a 2xx HTML body for `/v1/mobile/`, and on client errors except TLS and transport policy | `core/network/resilient_api_read.dart` | Missing |
| Transport policy | HTTPS only, no user info; `http` to loopback only in debug | `core/network/api_transport_policy.dart` | Audit: `authorizedFetch.ts` is stricter and has no debug loopback |
| Redirects | Followed by hand, only for GET and HEAD. Refuses a downgrade from HTTPS. Strips `authorization`, `cookie` and `proxy-authorization` across origins. An API redirect limit applies | `core/network/mobile_http_client.dart` | Missing: RN `fetch` follows redirects itself, so confirm what it does before assuming parity |
| 401 handling | Single in-flight re-login with the saved phone and code, retry once. A failed re-login clears the account and session | `mobile_api.dart` `_sendAuthorized`, `_performStoredAccountReauthentication` | Audit: `auth.ts` `refreshSession` |
| Errors | `MobileApiException` carries `code`, `message`, `statusCode`, `apparatusOptions`, `details`, `activeKadrCount`, `scannedKadrCount`, `orderTitle`, `requestId`, `diagnostics`. Screens branch on these | `mobile_api.dart` | Missing |
| Large JSON | Bodies from 128K code units are decoded in a background isolate | `core/api/json_payload_decoder.dart` | No JS equivalent. Measure on a real admin payload and open an item if it janks |
| Network requirement | Blocking dialog when the network is required | `core/network/network_requirement_runtime.dart` | Missing |
| Server address | Saved endpoints with normalization and last-used time | `core/network/server_endpoint_store.dart` | Audit: `auth.ts` `normalizeServer` |

## Writes and consistency

| Mechanism | V2 behaviour | V2 source | V4 status |
|---|---|---|---|
| Read invalidation | Every mutation bumps a read epoch before and after it runs, so a read started earlier is never shared with a later caller | `mobile_api.dart` `_mutationRequest`, `_queueSnapshotReadEpoch` | Audit |
| Idempotency | `idempotency-key` header in the form `mobile:canonical-apparatus:<op>:<micros36>-<counter36>`, plus idempotency fields in some bodies (19 files) | `mobile_api.dart`, `core/api/admin/apparatus_transfer_command_store.dart` | Partial: some body fields in `OrderScreen.tsx`; the header is absent |
| Session read scope | Pending reads and actions are tied to server, role, ref, capabilities and assignments, and exclude token refreshes | `core/session/session_read_scope.dart` | Partial: `auth.ts` session epoch |
| Runtime reset | Switching account or logging out clears runtime state everywhere | `core/session/runtime/app_runtime_reset.dart` | Audit |

## Live data

| Mechanism | V2 behaviour | V2 source | V4 status |
|---|---|---|---|
| Sockets | `admin/production-maps/live`, `admin/warehouses/live`, `admin/inventory/live`, `admin/system/monitor/live`, `app-update/android/live`, `chat/live`, `preparation/orders/live`, `production-tasks/live` | `core/realtime/`, API parts | Two done: `workerLive.ts` and `chatLive.ts` |
| Silence timeout | A stream is closed after 7 s of silence by default | `withLiveStreamSilenceTimeout` | Audit: `workerLive.ts` closes on 10 s without a first message |
| Scoped deltas | Apply a delta only when epoch, scope and rev line up with the cursor; otherwise reload a snapshot | `core/realtime/sequence_delta.dart`, `mobile_api_admin_production_map_state_delta.dart` | Done for worker in `workerDelta.ts`; audit |
| Warm stores | In-memory stores show data at once and survive handoffs | `core/production/*_warm_store.dart`, `admin_sequence_warm_store.dart` | Missing as named stores |
| Snapshots on disk | Persisted production snapshots | `core/cache/production_snapshot_store*.dart` | Missing |

## App-wide

| Mechanism | V2 source | V4 status |
|---|---|---|
| Saved accounts and switching, with secrets in native storage | `core/session/accounts/` | Missing: one credential set in `auth.ts` |
| Route guards by capability and role | `app/app_router_*` | Missing |
| Localization in 4 locales, with Urdu right-to-left via `UrduAwareText` | `core/localization/` | Missing: hard-coded Uzbek |
| Security gate with PIN and biometrics | `core/security/` | Audit: `appLock.ts`, `WorkerSecurity.tsx` |
| Order image cache with disk store | `core/cache/order_image_cache.dart` | Audit: `orderThumbnail.ts` |
| Chat local database | `features/chat/data/` | Partial: `chatOutbox.ts` |
| Push, local notifications, notification routing | `core/notifications/` | Missing |
| Android self-update | `core/update/` | Missing |
| Printing | see `native-bridges.md` | Missing |
| Test mode: enabled from the welcome screen; API methods return demo data | `core/test_mode/`, 236 `isEnabled()` call sites in `core/api` | Missing; ported last |

## Test mode rule

Do not copy the `if (await TestModeController...)` branch into each V4 API function while the real path
is being ported. Tag those branches as pending in `PORT.md`. The test mode step, after all roles, ports them in one place, so V4
gets the same behaviour without mixing demo data into every function.

## Dormant in V2

Iroh transport stays out unless the user decides otherwise. `canUseFor` needs `IROH_AUTO_CONNECT`,
which defaults to false, and no Makefile, CI or `accord_deploy_mac` build sets it. The items are listed
in `docs/port/EXCLUDED.txt`.
