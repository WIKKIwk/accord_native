# Aparatchi queue and order-sheet recovery

Status: transport/warm checkpoint complete; page/detail integration being verified.
Source: `f11910bb2c8c7081ce26770e69811b03fd0739ed`, read-only baseline clone in `.expo/accord-v2-baseline`. The original V2 checkout remains clean at `44396752`; `lib/` and `test/` are identical to the selected source.

## Completed transport/cache checkpoint

- Worker cold read joins snapshot/catalog under10s without an additional profile GET. Background reads are independent. Snapshot query/cursor, pending deduplication, fresh read epoch and304 handling follow V2.
- Native production live transport has10s connection timeout and25s protocol ping/pong liveness, with Swift URLSession and Android OkHttp. A disconnected peer does not hold cancellation. The actual RN WebSocket remains usable on Expo Go/old binaries; native heartbeat is available after a development-binary rebuild.
- Compact state-v2 negotiates once to canonical-v1 on unsupported protocol. Snapshots/deltas retain actor sections, reject gaps/stale revisions and signal canonical reconciliation. Ready/error/current/foreground hooks allow the page and warm owners to separate display from authority.
- Warm store has exact account/query identity, exclusive page leases, bounded initial reads, cursor recovery and a single canonical repair budget. Repeated resync cannot create HTTP polling. Account/permission loss withdraws the baseline; token-only refresh retains its read scope.
- Disk cache reuses `ProductionSnapshotStore`, validates compact/canonical snapshot plus catalog, bounds restore to500ms, captures immutable save data with400ms debounce, supports pending-save cancellation and safe disposal flush, and fences session/storage generations.
- Verification:54 focused transport/cache tests passed in `/tmp/accord-recovery-core-focused.log`; expanded transport suite88/88 passed. Both native TypeScript projects passed. Lint exited0 with the existing AdminClosedHistoryOwner ticket warning. Swift and Kotlin transport cores compiled; host URL-policy tests and OkHttp25000ms ping/10000ms connect/no-redirect configuration checks passed.

## Open items

| Where | V2 reference | What remains |
|---|---|---|
| Native development binary | `warehouse_live_client_io.dart` | Rebuild the app to include `AccordProductionLive`; full Expo wrapper build and real-device/network-switch/ping-pong validation are not yet performed. Existing binaries use a real RN socket with its existing heartbeat limitation. |
| Whole aparatchi role | `docs/port/status/aparatchi-followup.md` | Existing role-wide text/surface work is outside this mechanism follow-up. No existing exception or ledger exclusion is added. |

## Deviations candidates

- Four source-baseline V2 recovery tests expect direct2s HTTP retry or immediate HTTP fallback on WS outage, but fail unchanged. Port uses the actual V2 live/reconcile mechanism; it adds neither periodic HTTP polling nor automatic mutation replay.

## Test mode pending

V2 demo fixtures remain deferred under D3. No fake runtime behavior is introduced.

## Needs from the integrator

None for source integration of this requested scope; the branch remains separate from main.
