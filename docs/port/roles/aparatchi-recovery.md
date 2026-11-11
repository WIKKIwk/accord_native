# Worker queue and order detail recovery

Scope: the existing apparatus-worker/rezka queue, its saved read baseline and order detail sheet on iOS and Android. This is the requested mechanism follow-up, not completion of the whole aparatchi role.

Source: V2 baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`. Live V2 `44396752` has identical `lib/` and `test/`; its later commit changes iOS build configuration only.

## Read and presentation contract

| V2 source | Required behavior | V4 owner |
|---|---|---|
| `admin_production_map_orders_live_state.dart:_startWorkerLive` | Claim prepared baseline, restore bounded disk cache, otherwise atomic snapshot/catalog cold load; start live even after retryable cold failure | `WorkerQueueController`, `useWorkerQueue` |
| `worker_queue_warm_store.dart:WorkerQueueWarmStore` | One live owner; synchronous page lease; exact session/query identity; stale reads/releases ignored; no periodic HTTP polling | `workerQueueWarmStore`, `workerQueueRuntime` |
| `admin_production_map_orders_snapshot_cache.dart` | RAM/disk display is not write authority; 500ms optional disk bound, 400ms immutable safe persistence, flush safe disposal, no persistence of unacknowledged writes | `workerQueueCache`, `WorkerQueueController` |
| `admin_production_map_orders_live_state.dart:_runWorkerLiveStream` | First-message deadline 10s, retry WS with jittered exponential delay capped30s; 2s recovery restarts live; terminal authorization/contract failures stop; missing catalog refresh independent | `workerLive`, `WorkerQueueController` |
| `_requestStateReconcile`, `_applyCanonicalStateDelta` | Matching epoch/scope/base-revision; ignore duplicates/stale epochs; one active canonical read plus one queued refresh; late HTTP cannot replace newer live data | `workerDelta`, `workerLegacyState`, `WorkerQueueController` |
| `warehouse_live_client_io.dart` | Native25s protocol ping/pong, bounded handshake, cancellation never waits on dead socket | `workerLiveTransport`, `accord-production-live` |
| `admin_production_map_orders_screen_state.dart:_showWatchOrderDetail` | Row tap opens sheet immediately from display preview while queue is revalidating; authoritative freeze still blocks; loading controls are absent | Existing `WorkerScreen`, `OrderScreen`, `WorkerOrderDetails` |
| `admin_production_map_orders_admin_detail_preview.dart` | First detail failure stays inside visible sheet, scoped error and manual retry | `OrderScreen`, `WorkerDetailRecovery` |
| `admin_production_map_orders_admin_detail_host.dart` | Hydrated form survives revision updates; current authority retires; bounded reads retry200/500/1000/2000ms until healthy; no healthy polling, no mutation replay | `workerDetailRecovery`, `workerDetailRecoveryRead` |
| `admin_production_map_orders_worker_presentation.dart` | Retained display cannot supply action proof; account/assignment/freeze/epoch changes invalidate it | Existing presentation owner plus detail recovery |

## Surfaces

- Existing queue rows, machine/limit filter, refresh, load error and connection progress retain their existing platform-native presentation. Retryable connection failure keeps old rows/statuses and uses V2's300ms queue-progress grace; terminal error keeps retry.
- Existing iOS SwiftUI and Android sheet types, headers, errors/retry and form fields remain. No new task steps, buttons, server endpoints or user-facing copy are introduced.
- Existing frozen-order notice remains visible; stale list synchronization alone cannot suppress ordinary row opening.
- Parent queue cursor is null while validation is pending. Detail can obtain independent current scoped authority without waiting for global list recovery.
- Pending writes disable their existing controls and prevent cache certification. Reconnection never repeats a write, report, scan mutation or print.

## Source-test qualification

The four V2 tests expecting direct2s cold HTTP retry or immediate HTTP fallback on WS close/error fail at the selected baseline (recorded in `/tmp/accord-v2-deep-recovery-oracle.log`). They are not used to invent additional retries. Eleven selected V2 warm/detail tests pass; source behavior, including initial detail's manual retry, is preserved.
