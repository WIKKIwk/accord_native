# aparatchi-fab-input-progress

Status: requested block implemented; real-phone validation pending
Stopped at: code, focused regression tests and both platform checks complete on main

The user authorized working and committing directly on `main`. The V2 reference is the existing FAB scan result, limited to its previous-stage input-roll block; no other order-sheet features are claimed as ported here.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Real phones | FAB QR → order sheet | No device is currently connected to Metro; native appearance and scrolling have not been exercised on a phone. No simulator/emulator was used. |

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `_PreviousProgressQrTile`, `admin_production_map_orders_detail_material_widgets.dart:112` | `WorkerInputProgress.ios.tsx`, `WorkerInputProgress.android.tsx` | code compared | code compared | Native controls and system colors; same confirmation/source/quantity. |
| `_InputProgressBatchList`, same file:221 | same components and `useWorkerInputProgress.ts` | code compared | code compared | Same summary, loading/error/empty states and complete matching list in the existing scroll area. |
| `_InputProgressBatchTile`, same file:329 | same components and `workerInputProgress.ts` | code compared | code compared | Exact selected batch/QR is highlighted; rows do not authorize selection by tapping. Same source/action/status/quantity/QR text. |
| `_OpeningWipQrTile`, same file:3 | `workerInputProgress.ts` | code compared | code compared | Same production + opening list and quantity/unit fallbacks. |

## Validation

- `port_ledger.mjs drift`: no changed files in `lib/` / `test/` between the baseline and the inspected V2 HEAD.
- The tile is not a ledger page. The encompassing `_ReadOnlyOrderDetailSheet` spans 39 surfaces and is outside this targeted change.
- Its broad text gate already fails before this change: iOS 352 V2-only / 237 V4-only; Android 351 / 246. These whole-sheet gaps are not fixed or accepted as exceptions by this patch.
- After the port, the broad text-gate counts are unchanged. No new text exceptions or accepted rows were added.
- 138 focused QR, FAB, scan-bootstrap, candidate API and order-presentation tests pass. This includes 10 new source-derived tests for the four-roll example, concrete and alternative consumer stages, scoped bootstrap reuse, independent QR revalidation, stale reads, opening WIP, visible states, and native rendering on both platforms.
- `tsc --noEmit -p tsconfig.ios.json` and `-p tsconfig.android.json`: pass.
- `npm run lint`: 0 errors, 1 pre-existing warning in `src/admin/AdminClosedHistoryOwner.tsx`.
- Both full Metro development bundles compile and contain their own native `WorkerInputProgress` view.
- `git diff --check`: pass. The V2 working tree remains untouched and clean.

## Deviations candidates

None for the requested block.

## Test mode pending

The existing shared API test-mode policy is unchanged.

## Needs from the integrator

None; the requested block is wired into the existing `OrderScreen` on both platforms.
