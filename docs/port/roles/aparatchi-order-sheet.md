# Aparatchi — order detail parity contract

Scope: the eleven differences F01–F11 in `../status/aparatchi-audit.md`: the operator order sheet, its material panels, output progress, issue completion and directly opened dialogs/sheets. Both iOS and Android are included. This is not a declaration that the entire aparatchi role's 29 surfaces have been ported.

Specification: Accord V2 baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`. The checked-out V2 HEAD `44396752396b69bc5ba9198a9352b71848b3b86a` has identical `lib/` and `test/` content. V2 and Mini ERP remain read-only. Work stays on `main`, as explicitly requested by Wikki.

## Material visibility and actions

- Keep assigned materials visible after start, including a running order whose actions are pause/complete. Do not use `assigned_materials_display_only` as a visibility requirement.
- Pending intake and attached assignments have independent expandable lists, counts, loading/error/empty states. Intake requires the synchronized server `material_intake_allowed` flag and is excluded for cutting.
- Assignment rows retain the V2 title/code deduplication, group, barcode, execution status and scanned state. Balance totals group case-insensitive UOMs, sum finite positive received/consumed quantities and clamp remaining to zero.
- Preserve `worker_material_assignment_allowed` from the apparatus catalog. With this permission, expose the precomputed material-use panel; otherwise expose the link-request panel during required start-material scanning. Exclude training orders from these real material mutations.
- Direct use performs GET `/v1/mobile/worker-material-use`, requires an eligible barcode with a positive `placement_version`, asks for explicit confirmation and POSTs that same version. Cancel, wrong barcode, expired permission or changed account/order cannot send the mutation. A failed permission read clears stale eligibility. A successful response requires `ok=true` and the matching barcode.
- Link requests use GET/POST `/v1/mobile/material-link-requests`. Creation requires explicit selected barcodes; nothing is preselected. Recheck permission and assignments after preflight and after the picker. Track the latest request per mover, prevent duplicate pending creation, allow pending cancellation, and refresh material assignments once per approved/stale request ID. An ambiguous creation response triggers verification without automatically repeating POST.
- Keep refresh notifications queued while confirming, picking or saving. Hidden/background panels resume their refresh on return. Reads issued before a mutation cannot overwrite post-mutation verification. Session/order identity and active-session guards apply before writes and async updates; token refresh within the same active login does not change the read scope.

## Progress and completion

- Print/laminate progress is available on both platforms for pause/complete/resume states. Resolve the current occurrence, including alternative apparatus groups. Fetch all producer WIP batches with `status=all`, `limit=500`; preserve duplicate IDs until the highest revision is selected.
- Count the same V2 output action/status pairs. Exclude another order/occurrence, void/peremotka outputs and layer remainders. Sum meters in micro-units, retain missing-measurement counts, round planned length upward to 500 m, clamp the visual bar and remaining quantity, and retain V2's unclamped percentage text.
- Refresh progress on entry, output revision, active production updates and a 30-second foreground timer. Keep the previous totals visible during refresh; report loading, failure and unknown meters separately.
- A non-training ordinary completion with an issue note sends `action=freeze`, `freeze_with_issue=true`, `issue_note`; it bypasses output printing and full-report validation. A closing-output completion stays a report. Safe-stop pause requires output or an issue note and retains `freeze_request_id` and `completion_request_note`. Any partially entered output, including waste, prevents the empty-output safe-stop shortcut.
- Optional ordinary/closing report notes serialize through `completion_request_note`; the queue serializer does not accept a generic `description` field. Existing output, returned-paint, report and server control guards remain in force.

## Linked surfaces and platform controls

- Long-press a material row: medium haptic, QR sheet, barcode and stock details, existing-printer selection and reprint. Prepare/validate the same stock barcode and print payload before printing; confirm that same reprint ID afterward. Cancellation is not success. Failed confirmation after a successful print shows the V2 warning and success snackbar.
- Missing material/mold alerts retain V2's print-apparatus, active-order, synchronized-control and training guards. Disable concurrent sends; retry the same request ID after failure; show success only after server acknowledgement.
- Reuse recorded V2 translations for actions, material headers, balances, progress, report labels, delivery confirmation, QR details and stage status. Preserve literal V2 text where it uses Urdu-aware literals.
- Roll selection remains a dismissible 70% bottom sheet with empty initial selection. Quantity/report remains a dialog, with no outside-tap dismissal; saving blocks cancellation. iOS uses an RN modal dialog with native SwiftUI action buttons and a scrollable keyboard-aware form; Android uses Compose `AlertDialog`. Confirmation alerts are native SwiftUI/Compose alerts. Existing order buttons remain actual SwiftUI/Compose controls.
- Previously requested design changes remain: native iOS glass controls, completion above roll removal, and the sheet safe-area/background fix. They are user-authorized presentation changes.

GoDEX and deferred test mode remain excluded by the port decisions. No backend contracts, production data, dependencies, branches or signing configuration change in this scope.

## Follow-up printing contract

- Wikki temporarily excludes USB and Wi-Fi **printing choices**. Output, WIP reprint, raw split and preparation printing select a Bluetooth printer. Transport implementations remain available for later; GScale's scale selection is unchanged.
- Use the V2 offline wire contract and execute each returned local print job once. A cancelled selection or changed session cannot submit the report/reprint. Printing failure after a committed report reports that failure and does not resubmit the production action.
- On iOS dismiss the report modal and await its actual dismissal before presenting the native printer sheet. Do not introduce a timer to hide presentation races.
- A server `completion_request` acknowledgement displays the pending-request notice and preserves the returned-paint draft; it is not a completed production report.
- Real printer delivery remains unverified until tested on hardware.

## Cancel started work

- Show undo-start for an assigned laminate/glue/cut apparatus only with synchronized active in-progress control, queue-manage permission, operator role, own worker reference and a valid server cancel token. Training orders are excluded.
- Ask the V2 localized native confirmation before sending anything. Re-read control and compare session ID, token, worker and previous state immediately before POST. A lost or rejected response triggers authoritative queue refresh without an automatic retry or invented rollback.

## Scanned WIP history

- Expose the header action only for an assigned laminate/glue/cut apparatus, an operator with queue-read permission and a loaded order with a confirmed stage (or exactly one matching map node). Capture the stage at opening.
- The native 76% sheet shows loading, error/retry, empty, localized state, worker, linked time and blocked-return reason. Long press requests return only for unused active/unprocessed WIP with a server return token and queue-manage permission.
- Confirm natively, recheck identity/permission/item, lock dismissal and concurrent writes while saving, and reconcile after any attempted write including a lost response. Opening, reading, retrying, cancelling or dismissing history never retires order control. An account change clears data and blocks the old write.

## General QR handoff

- Preserve the scanned QR when opening an order. Normalize HTTP(S) path/query payloads with V2's `qr_payload`, `progress_qr`, `epc` precedence, retaining leading zeroes and the final decoded path segment. The root-path behavior is checked against Dart's [URI implementation](https://github.com/dart-lang/sdk/blob/main/sdk/lib/core/uri.dart).
- Load authoritative order control and validate that initial input once, without a second camera and without automatically submitting Start. Manual entry uses the same path. Account changes discard late results.
- On iOS await the full-screen camera modal's actual `onDismiss` before presenting the order sheet. Android transfers directly. An order identity change mounts fresh state.
- Busy-apparatus switch/report/handoff remains an open follow-up; QR handoff alone does not claim to complete that flow.

## Work instructions

- Both worker drawer/FAB entries open the actual instructions. iOS uses its existing Expo Router home stack; Android retains the existing worker shell/section and its app-lock owner. Reuse the existing Rezka implementation of the same V2 `AparatchiWorkInstructionsScreen` rather than maintaining a second guide.
- Read apparatus once with limit 300, restrict to assigned IDs with V2's case-insensitive deduplication followed by exact ID matching, and retain print/flexo/laminate/glue/cut/generic guide sections and all four translations.
- Preserve V2 loading and empty behavior (including a failed apparatus read), current-session/capability guards, native iOS/Android views, back navigation and the app-lock boundary.

## Daily work corrections and QR

- Retain the full history batch and revision. Only waiting WIP can be corrected; a Rezka master can correct its own output. Resolve the apparatus operation by V2's canonical/physical/work-unit IDs and legacy suffix fallback.
- Prefill the editor and preserve hidden metrics. Match print/laminate/glue/cut weights, core-in-net exception, diameter, returned ink, leftover rolls and conditional waste fields. Require positive visible quantities and compare bobina against measured gross at six-decimal precision, retaining measured gross for tare-only edits.
- Require a separate reason step before one revisioned correction. Use native fields/buttons on both platforms, block repeated taps while saving, discard stale account results, replace the acknowledged server batch and reconcile after an uncertain failure without retrying the write.
- Long press opens the WIP QR/reprint sheet with the same Bluetooth printing path. A sheet edit waits for the sheet's actual dismissal before presenting the editor. Missing QR has the V2 notice. Correction notices render after the form instead of trying to present a second native modal during dismissal.

## Integrated lamination report

- Route laminate Astatka and full completion to V2's atomic report. Native inputs collect output, core, waste and the two net remainder weights; bind the current session and all source revisions. Active zero-output Astatka and paused/completed reporting preserve V2 output semantics. Completion with a reason retains the existing issue/freeze path.
- Persist the exact business request in the existing SQLite preference store before POST, scoped by server/role/actor/apparatus/order/action. Reopen by request ID, recognize an existing receipt, and retry only on explicit confirmation. An uncertain response retains its payload. Clear only a matching acknowledged request so an old response cannot erase a newer report.
- Print after the atomic receipt. Validate enabled QR jobs before hardware writes, await actual iOS form dismissal for the printer picker, keep saved output on printer cancellation/failure, and expose saved output/remainder QR previews, history and explicit reprints. Unsupported remainder-weight backends and missing mounted sources stop recording with the V2 notice.
- Generic glue/cut completion, multi-frame Rezka output, non-print worker handoff, and busy-apparatus QR switching remain separate open work; this checkpoint does not claim those paths are complete.
