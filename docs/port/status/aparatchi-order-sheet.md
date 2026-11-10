# Aparatchi order sheet — iOS and Android

Status: F01–F11 implemented and locally verified. Physical-device visual, camera and printer verification remains open. No claim of complete whole-role parity.

Contract: `../roles/aparatchi-order-sheet.md`. Original findings: `aparatchi-audit.md`. Source baseline: `f11910bb2c8c7081ce26770e69811b03fd0739ed`; V2 `lib/test` matches the checkout and remains unchanged. All work is in `/Users/superuser/Desktop/erp/accord_native` on the existing `main`, following Wikki's explicit instruction. No commit, push or deployment was performed.

## Changes

| Finding | Implementation on both platforms |
|---|---|
| F01 | Assigned materials remain visible on running orders, including pause/complete-only controls. |
| F02 | Separate pending intake list, count, expansion, loading/error and empty state. |
| F03 | Shared output calculation and foreground/revision refresh; real SwiftUI/Compose progress views. Latest WIP revisions, alternative occurrences, missing meters and exclusions are preserved. |
| F04 | Completion issue note → freeze-with-issue. Closing report and safe-stop remain distinct; optional notes use the actual queue wire field. |
| F05 | Catalog permission is preserved; eligible material GET, scanner, native confirmation and versioned POST are connected. |
| F06 | Explicit roll picker, request create/status/cancel, permission rechecks and approved/stale assignment refresh. Hidden/background updates wait; old reads cannot overwrite mutation verification. |
| F07 | V2 assignment details/status and received/used/remaining balances by UOM. |
| F08 | Material long press, haptic, QR information, printer selection, identity-safe reprint, cancellation and confirmation warning/success snackbar. |
| F09 | Missing raw-material/mold alert buttons with V2 guards, stable retry identity and duplicate-send prevention. |
| F10 | Recorded locale text for actions/material/progress/report/delivery/QR/status labels; four-locale regression coverage. |
| F11 | iOS quantity form is a keyboard-aware dialog with native SwiftUI buttons; outside/swipe dismissal is blocked. Android retains its native Compose dialog. |

## Surface audit

V2 paths below are relative to `lib/src/`; the `admin_production_map_orders_` prefix refers to `features/admin/presentation/`.

| V2 surface and location | V4 files | iOS | Android | Comparison |
|---|---|---|---|---|
| `admin_production_map_orders_start_card.dart:555,603` pending/attached materials | `src/OrderScreen.tsx`, `WorkerMaterialList.*` | code checked | code checked | Independent headers, counts, load/error/empty states and always-visible attached materials. |
| `admin_production_map_orders_detail_material_widgets.dart:915,980,1112,1172` assignment, QR and reprint | `workerMaterialPresentation.ts`, `WorkerAssignedMaterialQr.tsx`, `workerAssignedMaterialReprint.ts`, printer selectors | tested logic | tested logic | Same metadata, barcode identity, preparation → print → confirm, cancel and warning paths. Native printer transports are reused. |
| `admin_production_map_orders_worker_output_progress.dart:10,161,237` | `workerOutputProgress.ts`, `useWorkerOutputProgress.ts`, `WorkerOutputProgress.*` | tested logic | tested logic | Same producer/occurrence selection, highest-revision aggregation, micro-units, output exclusions and progress states. Native visual verification is pending. |
| `features/material_link/presentation/worker_material_use_panel.dart` | `workerMaterialLinkApi.ts`, `workerMaterialState.ts`, `WorkerMaterialPanels.tsx`, `WorkerAlert.*` | tested logic | tested logic | Eligibility, explicit confirmation, placement version, cancellation, error and account guards replay V2 contracts. |
| `features/material_link/presentation/material_link_request_panel.dart`; `material_link_request_card.dart:219` picker | same shared API/state, `useWorkerMaterialPanels.tsx`, `WorkerMaterialRollPicker.*` | tested logic | tested logic | Worker request panel and picker only. The separate recipient/admin structured-chat card is outside this order-sheet scope. |
| `features/material_link/presentation/order_alert_button.dart` | `workerOrderAlert.ts`, `WorkerOrderAlertButton.tsx` | tested logic | tested logic | Missing-material/mold guards, server acknowledgement, stable retry ID, concurrent taps and stale session. |
| `admin_production_map_orders_progress_qty.dart:146,807,2104`; `read_only_helpers.dart:295` | `workerCompletion.ts`, `OrderScreen.tsx`, `WorkerFormDialog.*` | code + logic tests | code + logic tests | Issue, safe-stop, closing-output and training branches; dialog instead of iOS sheet. No outside dismissal; explicit cancel remains. |
| Start-card action labels, progress/delivery/report localization | `workerOrderText.ts`, `useWorkerOrderText.ts`, order and native child views | four-locale test | four-locale test | Existing recorded catalog reused; no text exceptions added. |

## Verification

- Unmodified V2 material-use/request/alert oracle: **40/40 pass**, run from the baseline's temporary export. `/tmp/accord-worker-v2-material-oracle.log`.
- Unmodified V2 worker output progress oracle: **2/2 pass**. `/tmp/accord-worker-v2-progress-oracle.log`.
- Re-recorded fixtures at the pinned baseline: `worker_material_use_panel_test.json` (17 requests), `material_link_request_test.json` (54), `order_alert_button_test.json` (6). For material-use recording only, the temporary test harness used Flutter's `expectSync` with the same assertions because instrumentation added an async boundary inside `MockClient`; unmodified original tests separately passed. The fixture records this provenance. No V2 checkout files were edited.
- `node --test tests/worker*.test.cjs tests/nativeSheet.test.cjs tests/headerAccountSwitcher.test.cjs tests/roleControls.android.test.cjs tests/preparationReprint.test.cjs`: **338/338 pass**. `/tmp/accord-worker-parity-suite-final.log`.
- Focused new parity/presentation suite: **54/54 pass**. `/tmp/accord-worker-focused-final.log`.
- `npx tsc --noEmit -p tsconfig.ios.json` and `tsconfig.android.json`: **exit 0**. The prior Android self-resolving type-import errors were removed by sharing output/palette prop types.
- Metro health and both Expo manifests: **HTTP 200**. Fresh complete (`lazy=false`) development bundles: iOS **HTTP 200 / 15,672,956 bytes**; Android **HTTP 200 / 15,880,476 bytes**. This verifies JS transformation, not device rendering or a native binary build.
- `port_ledger.mjs check --v2 <baseline-export>`: **exit 0**, 1083 `@v2` tags and 91 `@v2-test` tags resolve. Eleven existing dynamic-endpoint diagnostics remain; the two newly connected material endpoints occur literally in V2.
- Whole-role `port_ledger.mjs text aparatchi both --v2 <baseline-export>`: **exit 1**, unchanged from the audit: iOS 280 missing / 99 added, Android 280 missing / 108 added; zero ambiguous tags, 158 surface/guard entries. It covers the entire broader role and does not establish this scoped screen's runtime parity. No acceptance rows were added to hide those differences.

- `npx expo lint`: **exit 0**, no errors; one pre-existing `react-hooks/exhaustive-deps` warning at `src/admin/AdminClosedHistoryOwner.tsx:36` (`ticket`). `/tmp/accord-worker-final-lint.log`.
- Final `git diff --check`: **exit 0**. The previous uncommitted welcome/theme/account/header work was preserved. No dependency, protected port configuration or reference-repository source changes were introduced.

## Remaining verification and scope limits

- Test on a real iPhone and Android: running-order material expansion; empty and pending intake; permission-enabled scan → yes/no; explicit roll selection → request/cancel → pushed approval; ordinary issue completion versus closing report and safe stop.
- Verify camera permissions, keyboard/large-text layout, sheet scrolling through the bottom safe area, light/dark themes, physical printer choice/cancel, one reprint and successful/failed server confirmation. No camera, printer, device, simulator or emulator was exercised.
- Structured material-link approval in a recipient/admin chat, the entire worker queue/WIP/lamination/rezka role and the remaining whole-role text differences are not newly declared complete by this order-sheet implementation.
- V2 and Mini ERP working trees were checked and remained clean. No real API commands, alert messages, print jobs, database writes or external deployments were sent.
