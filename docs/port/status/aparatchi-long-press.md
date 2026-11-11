# Aparatchi long press

Status: focused fix merged into main; physical verification and the existing whole-role audit remain open.
Stopped at: real-phone comparison of queue long press. No additional implementation is pending for this reported fix.

Scope: the user's reported queue long-press flash, delayed opening and intermittent inline loading error, on iOS
and Android. This is a focused correction to the existing role, not a completion claim for the entire aparatchi port.
Base: `port/aparatchi-paint-parity` at `a4400f33`. Worktree: `accord_mobile_v4-aparatchi-long-press`, branch
`port/aparatchi-long-press`. The user authorized main integration on 2026-11-11; merge commit `095e85be` includes
the implementation commit `8ed92537` in `main` without conflicts.

## Changes

- Read and resolve actions before native presentation; pending/no-action results never mount a sheet.
- Replace the menu's QR bootstrap read with the V2 scoped worker-detail endpoint, preserving its five-second opening
  deadline and one retry for a stale epoch/revision. Reuse existing decoding and transport.
- Render prepared menu/review data directly, eliminating network effects inside the sheet and duplicate completed
  detail/preview reads. Keep production-action revalidation and explicit confirmations.
- Give immediate native long-press feedback. Hold one synchronous pending presenter and retire delayed results on
  query, account, apparatus or route changes. No completed-result cache or new network retry policy was added.
- Keep genuine read failures as short source notices, with no empty/error modal; subsequent explicit holds can recover.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs / limits |
|---|---|---|---|---|
| `_SequenceOrderRow._buildVisual` `sequence_widgets.dart:535`; Flutter `InkWell.handleLongPress` and `Feedback.forLongPress` | `workerLongPressFeedback.ts`, `WorkerScreen.tsx` | source compared | source compared | Feedback runs before the asynchronous read. Native haptic strength and iOS system-click audio need phone comparison. |
| `_hydrateWorkerActions` / `_readWorkerListDetail`, `worker_list.dart:12,172` | `workerLongPressPreparation.ts` | source compared | source compared | Same scoped endpoint, one deadline, stale-response retry and opening gate; cancelled reads cannot show stale UI. Host regression tests exercise these races. |
| `_showWatchOrderLongPress`, `screen_state.dart:2188,2241,2252` | `workerLongPressPreparation.ts`, `WorkerScreen.tsx` | source compared | source compared | Pending/no-action returns before presentation; source direct-astatka exceptions are retained. |
| `_BosmaWorkerFinishSheet`, `module_pages.dart:1135` | `WorkerLongPressActions.tsx` | source compared | source compared | Existing source text keys and action order retained; actions are ready on first render. Existing native layout and dismissal code is reused. |
| `_laminatsiyaWorkerHandoffBatch`, `screen_state.dart:2147` and paused handoff branch | `workerLongPressPreparation.ts` | source compared | source compared | Handoff lookup precedes display; direct astatka precedes handoff; lookup failure keeps the source report fallback and short notice. |
| `_showCompletedOrderReactivation`, `reactivation.dart:47` | `workerLongPressPreparation.ts`, `WorkerLongPressActions.tsx` | source compared | source compared | Full graph before preview, one retained review through dismissal/confirmation, no menu-render fetch. |
| `_showWorkerDetailError`, `worker_list.dart:195` | `WorkerScreen.tsx`, existing `WorkerPaddonFeedback` | source compared | source compared | Source message/fallback through the existing short native feedback surface; no red inline load-error sheet. |

Short V2 filenames above refer to `lib/src/features/admin/presentation/admin_production_map_orders_*`.

## Branch verification before main integration

- Before edits: 60/60 focused tests passed.
- Final focused suite: **83/83 passed**, including no-action/no-modal behavior, immediate feedback, repeated holds,
  live-revision retry, shared deadline, query/route cancellation, recovery after a failed read, direct astatka and
  completed-preview retention. Log: `/tmp/accord-long-press-final-focused.log`.
- iOS and Android TypeScript checks: exit 0. Project Expo lint: exit 0, zero errors and the existing unrelated
  `AdminClosedHistoryOwner.tsx:36` dependency warning. Log: `/tmp/accord-long-press-final-lint.log`.
- Full final suite: **6191 tests, 6165 passed, 14 failed, 12 TODO**. All fourteen non-TODO failure names were compared
  programmatically with the same tests run against an isolated export of the untouched starting commit `a4400f33`;
  all fourteen reproduce there. They are existing Node/native-module imports and native fixture failures, not newly
  introduced failures. Logs: `/tmp/accord-long-press-final-all-tests.log` and
  `/tmp/accord-long-press-baseline-failures.log`. The temporary baseline export was removed.
- Ledger check: exit 0; 1239 `@v2` and 115 `@v2-test` tags resolve. The eleven existing dynamic-endpoint diagnostics
  remain; this change adds no endpoint. Log: `/tmp/accord-long-press-final-ledger.log`.
- Whole-role text gate: exit 1, zero missing/extra lexical rows, zero ambiguous tags, and the same **442 iOS / 445
  Android global-scope rows** documented by the starting branch at `aparatchi-paint-parity.md:56`. It is not marked
  passed. No blanket text exceptions or changes to that gate were made. Log: `/tmp/accord-long-press-final-role-text.log`.
- `git diff --check`: exit 0. V2 remained clean and read-only.
- No physical device, simulator, emulator, real network mutation or printer was used.
- No text exception rows were added. The private-sheet text query reports zero extracted texts/surfaces, so that
  result does not prove text coverage. The source keys/action order were compared directly and exercised by native
  component harness tests; the broader role text diagnostic is recorded separately.

## Main integration — 2026-11-11

- Merged `port/aparatchi-long-press` into the current `main` with `--no-ff`; preserved the newer profile and main
  verification changes. `git merge-base --is-ancestor port/aparatchi-long-press main` passed.
- Main focused regression suite: **83/83 passed** (`/tmp/accord-long-press-main-focused.log`).
- Both platform TypeScript checks exited 0. Expo lint exited 0 with the same unrelated Admin hook warning
  (`/tmp/accord-long-press-main-lint.log`).
- The branch-wide test/text results above describe the pre-integration snapshot; these merge checks do not make a
  new whole-role or physical-device verification claim.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Real iPhone / Android | InkWell feedback and native sheet presentation | Check pending/no-action haptic without a sheet, working/paused menus, rapid repeated holds, normal tap afterwards, a busy live queue, and temporary loss/recovery of connectivity. Compare the actual opening delay and haptic on the phone. |
| Existing whole-role text provenance | `aparatchi-paint-parity.md:56` | The broader role's 442/445 scope rows remain outside this focused correction; no whole-role completion is claimed. |

## Deviations candidates

None added. Scope/route cancellation prevents an in-flight V4 presentation from appearing over a different page.

## Test mode pending

Shared test-mode work remains under D3 and was not changed by this fix.
