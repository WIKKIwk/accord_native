# Aparatchi queue and order-sheet recovery

Status: requested source mechanism implemented on both platforms; native development-binary and device validation pending.
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

## Completed page/detail checkpoint

- `WorkerQueueController` and `useWorkerQueue` separate retained display rows from validated action authority. Prepared/disk rows open immediately, cold failure starts live recovery, scope/query changes retire the old owner, and foreground resumes refresh assignments before recovery. Query debounce reserves the new page lease before the old lease releases, preventing a second background socket between windows.
- Canonical HTTP reconciliation is single-flight with one queued rerun. Accepted live data defeats late HTTP; rejected older live data cannot invalidate a newer HTTP result. Independent catalog metadata cannot be overwritten by a slower queue read. Manual pull refresh updates catalog and queue independently.
- Retryable reads retain actual previous order statuses and use the existing localized reconnecting state plus V2's300ms queue-progress grace. A loaded query mismatch no longer suppresses ordinary row opening. Frozen orders still show their existing notice; unvalidated rows supply a null action cursor.
- The order sheet renders the row preview before full detail/section reads. Initial detail failure remains inline with manual retry. After hydration, scoped recovery preserves the mounted map/form, withdraws stale authority, retries reads200/500/1000/2000ms, and stops when healthy. Section errors retain their original classification; authorization/order denial stops recovery.
- Scoped detail sharing has a single5s deadline across at most two stale attempts; only unfinished GETs share. Old account/window/epoch responses and retired callbacks cannot populate or mutate a new sheet. Read-only apparatus details use the same lifecycle.
- Pending writes prevent snapshot persistence and safe warm handoff until the actual asynchronous write settles, including when the sheet closes. Recovery never repeats a write, report or print. Existing mutation/report/QR controls and their acknowledgement behavior remain guarded.

## Surface audit

| V2 surface and reference | V4 | iOS | Android | Evidence / limit |
|---|---|---|---|---|
| Worker queue cache/preview, `snapshot_cache.dart:14,73,152` | Warm/cache/page controller | compared | compared | Immediate display,500ms disk limit, no cached action proof; hook/controller tests |
| Queue reconnect/ready/gap, `live_state.dart:235,439,584` | Live/page controller | compared | compared | Exact cursor identity, terminal errors, independent catalog, no healthy polling; network/timer tests |
| Row tap, `screen_state.dart:1260,1440` | Existing WorkerScreen sheet open | compared | compared | Real rendered WorkerScreen callbacks open sheet from retained unsynchronized rows; native gesture recognition itself still needs a phone |
| Initial scoped hydration, `admin_detail_preview.dart:38,54,99` | OrderScreen/read owner | compared | compared | Preview first, full detail before sections, inline manual retry; actual screen harness |
| Hydrated recovery, `admin_detail_host.dart:107,128` | WorkerDetailRecovery | compared | compared | Form retention, retry pacing, background/close cancellation and terminal denial; actual screen/controller tests |
| Retired presentation callbacks, `worker_presentation.dart` | Existing presentation plus authority predicate | compared | compared | Retired callbacks cannot start reads/forms/writes; existing state/merge/handoff tests retained |
| Pending write ownership, `read_only_sheet.dart:266` | Existing mutation state notification | compared | compared | Fence ends when the real promise settles, not on view unmount |

## Final verification

- Full Node suite:5807 total,5784 passed,11 failed,12 TODO. The unmodified main baseline has5727 total,5704 passed,the identical11 failed names and12 TODO. No new failing name. These native Expo/Reanimated Node harness failures are not asserted to be device failures. Logs: `/tmp/accord-recovery-all-tests-final.log`, `/tmp/accord-recovery-main-baseline-tests.log`.
- Detail/recovery focused suite126/126; queue/warm/controller41/41; transport expanded88/88. Real React screen/component boundaries run with host mocks; no simulator or physical device was used.
- Both native TypeScript projects pass. Lint exits0 with the existing single AdminClosedHistoryOwner ticket warning. Both final Hermes bundles export under `.expo/recovery-export-ios` and `.expo/recovery-export-android`; neither proves a native app build or device presentation.
- Expo autolinking resolves `AccordProductionLiveModule` for both Apple and Android. Native Swift/Kotlin core compilation and URL/heartbeat host checks pass; the whole native Expo module/app build remains open above.
- Ledger check resolves 1195 source tags and 111 test tags, retaining eleven existing dynamic-endpoint diagnostics. The existing whole-role text gate remains open (iOS278 missing/104 extra; Android278/112;158 surfaces). No text exception, source exclusion, baseline change or unrelated role completion is claimed.
- Original V2 stays clean at44396752; the selected baseline clone is clean atf11910bb. No server stock mutation, account login, printer operation or device installation was performed.
- Runtime: Metro on8081 serves this worktree rather than main. The existing development URL/QR is unchanged. The branch is not merged into main and was not pushed.

## Deviations candidates

- Four source-baseline V2 recovery tests expect direct2s HTTP retry or immediate HTTP fallback on WS outage, but fail unchanged. Port uses the actual V2 live/reconcile mechanism; it adds neither periodic HTTP polling nor automatic mutation replay.
- V2 retries a missing catalog once when a real stream first responds (`live_state.dart:401-409`); repeated catalog failure during an otherwise healthy idle stream has no independent periodic catalog retry (`:1612-1643`). This source limitation is preserved, not silently redesigned.

## Test mode pending

V2 demo fixtures remain deferred under D3. No fake runtime behavior is introduced.

## Needs from the integrator

None for source integration of this requested scope; the branch remains separate from main.
