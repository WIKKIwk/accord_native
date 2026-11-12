# FAB QR result: previous-stage input rolls

Scope: the missing input-roll block in the existing worker order sheet on iOS and Android. This does not port the rest of `_ReadOnlyOrderDetailSheet` again.

Source: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`; the inspected V2 HEAD is `44396752396b69bc5ba9198a9352b71848b3b86a`. The relevant `lib/` files have no changes between these commits.

## Entry and data

- `_openWorkerQrScanner` → `_handleWorkerFabQr` → `_showWatchOrderDetail(initialScanQrPayload: ...)` in `admin_production_map_orders_screen_state.dart`.
- The existing V4 FAB scanner delivers `initialScanQr` to `OrderScreen`; the server validates the exact QR before it becomes selected. Start remains an explicit action.
- `_loadInputProgressBatches` / `_fetchInputProgressBatches` in `admin_production_map_orders_read_only_sheet.dart`: waiting WIP for the same order, limit 500; filter by the concrete consumer stage, including alternatives. Training uses the previous and next apparatus filters. Complete scoped bootstrap candidates replace an independent list request.
- Keep production and opening-WIP candidates in the same block when both are required. `_openingWipAsProgressBatch` determines the displayed opening quantity and unit.
- The independently validated scanned roll is retained even if the initial list omits it. It is revalidated before reuse after a list refresh. Only the exact batch ID or QR receives the checkmark. List rows are informational and do not select a roll when tapped.
- Shared implementation: `workerInputProgress.ts` and `components/useWorkerInputProgress.ts`. Existing control, assignment, current-session and explicit Start gates remain authoritative.

## Visible states and order

V2 `admin_production_map_orders_detail_material_widgets.dart`:

1. `_PreviousProgressQrTile`: confirmation or scan-needed heading; preceding apparatus and the selected quantity/unit (otherwise the preceding apparatus only).
2. `_InputProgressBatchList`: products heading; total/open/used summary; loading indicator, error or empty text; otherwise all matching rows in source order, with the accepted production roll first as in `_acceptPreparedFabScan` / `_handleQuickScan`.
3. `_InputProgressBatchTile`: selected checkmark or scan/used icon; source/action title; scan/used status and quantity/unit; the existing V2 QR line. The selected row has a tinted background and outline.
4. Existing Start/Resume controls follow the block. No additional navigation, dialog, button, hint or camera is introduced.

The block is shown when the existing start/resume preparation surface requires previous/opening input, as in `admin_production_map_orders_start_card.dart`. It stays in the existing sheet scroll area and uses native SwiftUI / Compose content. Dismissal, back behaviour and haptics belong to the existing sheet/scanner and are unchanged by this block.

## Exact text keys

All keys already exist in the generated V4 localization catalog and match V2:

- `worker.progress.previous.confirmed`, `worker.progress.previous.qr`, `worker.progress.products`, `worker.progress.none`.
- `worker.progress.summary.empty`, `.unused`, `.used_all`, `.mixed`.
- `worker.progress.action.complete`, `.pause`, `.detach_roll`, `.roll_complete`, `.output`.
- `worker.progress.batch_title`, `.batch_status`, `.scan_required`, `.used`, `.qr`.
- `worker.error.network_timeout`, `worker.error.wip_route_source`, `.wip_route_destination`, `.wip_route_ambiguous`, `.wip_route_changed`, `worker.wip.access_denied`, `worker.wip.load_failed`.

No text exceptions are added for this scope.
