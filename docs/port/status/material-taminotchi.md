# Material ta’minotchi

Status: final integration and parity audit in progress; not a completed-role declaration.
Stopped at: sequence cache/replay audit, final gates and receipt text reconciliation.

Branch: `port/material-taminotchi`, based on main `0a07da54`. Worktree: `/Users/wikki/Desktop/Accord_project/accord_mobile_v4-material-taminotchi`. Nothing merged into main. The user’s dirty main checkout remains separate.

Specification: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`. V2 was read only. Oracle/contract capture ran in temporary exports; `.expo/material-v2-baseline` is an isolated reference export. Historical `material.md` and `material-source-checkpoint.md` describe earlier incomplete work and are superseded by this status for this branch.

## Implemented scope

- Both native Material shells: home, cards/FAB, drawer/dock, profile/settings/PIN, real shared Chat/unread, history routes and capability denial.
- Compact tasks: Worker list/search/filter/buttons, Dart lexical integer/Unicode validation, saved selections, warm cache, atomic live delta/reconnect/resync and native supply-task socket extension.
- Full order: overview/image, material balances/unlink/QR, molds/QR, expected summary, production map/WIP, read-only stage history and linked receipt with return refresh.
- Global supply sequence and separate manual/QR/bulk assignment bottom sheet, quick scanner, source diagnoses/ambiguity and width rules.
- General manual/QR assignment, native order/apparatus pickers, candidate detail, close-before-confirm flow, unlink and source timed notices.
- Existing inventory movements owner and History API/model/views reused.
- Preparation/GScale receipt and batch/printing logic reused through Material-only policy/presentation/device guards. Other-role defaults preserved.

## Surface audit

`ok` means source and implementation code were compared, not that real-phone layout or hardware was tested. V2 paths below are under `lib/src/features/` unless stated otherwise.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Material home/cards/FAB; `material_taminotchi/presentation/material_taminotchi_home_screen_widgets_part_01.dart` | `MaterialHome.*`, `MaterialHomeRoute` | ok | ok | Native drawing; same actions/order/scope notice. |
| Drawer/dock; Material declarations and `material_taminotchi_dock.dart` | `MaterialDrawer`, `MaterialBottomBar.android`, `MaterialLayout.*` | ok | ok | iOS native tabs; source destinations/Chat retained. |
| Profile/settings/PIN; Material profile route | `MaterialProfile.*`, shared Profile | ok | ok | Existing native pages; no daily-work action. |
| Capability denial; `lib/src/app/app_router_declarations_part_01.dart:183` | `MaterialLayout.*`, `materialRouteAccess` | ok | ok | Plain centered localized access-denied text. |
| Home scan; `showRawMaterialScanDialog` | `MaterialHomeRoute`, shared `RawSplitScanner` | ok | ok | Existing scanner reused. |
| Tasks list/search/filter; `SupplyTasksScreen` | `MaterialTasks.*`, `MaterialTasksRoute` | ok | ok | Existing Worker native list/workspace/filter. |
| Full order sheet; `admin_production_map_orders_screen_read_only_sheet.dart` | `MaterialTaskDetail`, `useMaterialTaskDetailContent` | ok | ok | Shared native sheet/Worker sections, no Worker mutations. |
| Long-press receipt; `_openMaterialOrderReceipt` | `useMaterialTaskReceipt` | ok | ok | Full-order arguments and return refresh. |
| Sequence list; `SupplySequenceScreen` | `MaterialSequence.*` | auditing | auditing | Global source cache and legacy delta replay final check. |
| Sequence assignment; `_SequenceRawMaterialAssignmentSheet` | `MaterialSequenceAssignment.*` | ok | ok | Shared source controller, native sheet. |
| Embedded sequence scan | `MaterialQuickScanner.*`, `useMaterialQuickScanner` | ok | ok | Source two-second repeated QR suppression. |
| Bulk save/ambiguity choice | `materialSequenceAssignmentController` | ok | ok | Sequential stop-on-first-failure. |
| Manual/QR assignment; `AdminRawMaterialAssignmentsScreen` | `MaterialAssignments.*` | ok | ok | Native controls, shared source state. |
| Assignment order picker | `useMaterialAssignmentPicker`, platform views | ok | ok | Existing native list/filter reused. |
| Candidate details then confirmation/choice | `MaterialAssignments.*`, `materialAssignmentsController` | ok | ok | iOS waits for detail-sheet dismissal. |
| QR diagnosis/unlink/notice | `materialAssignmentPresentation`, `useMaterialAssignments` | ok | ok | Case-sensitive identity, source tone/five-second notice. |
| Inventory; `InventoryMovementsScreen` | `MaterialMovements.*`, `WorkerInventoryScreen` | ok | ok | Existing full owner reused. |
| History/details; Material widgets/declarations parts 01–03 | `MaterialHistory.*`, history routes | ok | ok | Same limit/order/labels and native sheet. |
| Receipt wrapper; `_MaterialGScaleControlScreen` | `MaterialReceipt.*`, `useMaterialReceipt` | ok | ok | Material shell retained; GoDEX D13 exception. |
| Print form and close confirmation | `GScaleScreen.*`, `gscaleMaterialPresentation` | auditing | auditing | Final source text/control audit. |
| Archive details/nested receipt QR | `MaterialArchive.ios`, `GScaleScreen.android`, `GScaleReceipt.android` | auditing | auditing | Metadata, warning/success, empty-EPC/busy states. |
| Device picker/technical details | `DeviceSheet.*`, `MaterialDevicePicker.*` | auditing | auditing | Material-only source presentation. |
| Manual server; `ManualServerSheet` | `MaterialDevicePicker.*`, `useMaterialManualServer` | auditing | auditing | Probe, dismiss, then return selected endpoint. |

## Validation

- Earlier focused run: 616 passed. Final whole-project suite, both TypeScript projects, lint and text reconciliation are in progress; final results will replace this line.
- Offline Android/iOS Hermes exports passed before final receipt edits; these are not native builds.
- Swift/Kotlin native host tests passed for actual supply-task socket admission and 25-second protocol ping. Worker/warehouse socket admission remains isolated.
- Captured 32 V2 request/response exchanges from 23 source tests (order-scan bootstrap, Preparation, Qolip). Pinned order-scan fixture was already identical. New captures under `tests/contracts/f11910bb/` preserve historical fixture baselines.
- Independent pinned V2 oracle: 153 passed, 10 failed. Baseline failures remain evidence, not a replacement specification. Final triage follows below.
- Current-tree ledger check passes. Pinned f119 check reports seven existing Metalayzer symbols added after f119; baseline and other-role tags remain unchanged.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Final integration/text audit | Role/text ledger and surfaces above | Finish sequence cache/replay and gates, record exact diagnostic verdicts. |
| Physical phone/hardware | Native Material/GScale/scanner/printer surfaces | Real Android/iPhone, scale and Bluetooth/Zebra USB/Wi-Fi printer validation. No simulator/device used. Rebuild the development client for the new native supply socket. |
| GoDEX | D13; V2 GoDEX choices | Intentionally excluded, including restored choices/dispatch; no GoDEX parity claim. |
| Shared demo mode | D3 | Deferred shared work; no fake replacement. |
| Pinned V2 widget failures | `qolip_tasks_test.dart`, `material_taminotchi_home_screen_test.dart` | Preserve oracle failure evidence; obsolete widget-key assertions do not define production behavior. |

## Deviations candidates

- Source manual assignment changes order without eagerly running the QR branch’s candidate reload; preserved.
- Existing inventory-only Material home-route/capability mismatch remains unchanged.
- Older development clients without `openSupplyTasks` use the real React Native WebSocket fallback; protocol ping requires the rebuilt native bridge.

## Test mode pending

Shared demonstration mode remains deferred by D3; reserved-token notice retains its existing behavior.

## Needs from the integrator

No extra code wiring handoff. Merge review, native client build and physical checks remain. No push/merge performed.
