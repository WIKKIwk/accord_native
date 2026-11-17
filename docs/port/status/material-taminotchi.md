# Material ta’minotchi

Status: software port implemented on Android and iOS; physical acceptance and unrelated baseline gates remain open. Not marked as a completed role.
Stopped at: software verification finished; phone/hardware acceptance and merge review follow.

Source branch: `port/material-taminotchi`, based on main `0a07da54`; source tip `1f9bde96`. Source worktree: `/Users/wikki/Desktop/Accord_project/accord_mobile_v4-material-taminotchi`. Integrated locally into main on 2026-11-17, retaining main `615ff2bf` (including the user's Preparation and Qolipchi work). The user's original uncommitted files remain separate from the merge commit.

Specification: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`. V2 was read only. Oracle/contract capture ran in temporary exports; `.expo/material-v2-baseline` is an isolated reference export. Historical `material.md` and `material-source-checkpoint.md` describe earlier incomplete work and are superseded by this status for this branch.

## Implemented scope

- Both native Material shells: home, cards/FAB, drawer/dock, profile/settings/PIN, real shared Chat/unread, history routes and capability denial.
- Compact tasks: Worker list/search/filter/buttons, Dart lexical integer/Unicode validation, saved selections, warm cache, atomic live delta/reconnect/resync and native supply-task socket extension.
- Full order: overview/image, material balances/unlink/QR, molds/QR, expected summary, production map/WIP, read-only stage history and linked receipt with return refresh.
- Global supply sequence and separate manual/QR/bulk assignment bottom sheet, quick scanner, source diagnoses/ambiguity and width rules.
- General manual/QR assignment, native order/apparatus pickers, candidate detail, close-before-confirm flow, unlink and source timed notices.
- Existing inventory movements owner and History API/model/views reused.
- Preparation/GScale receipt and batch/printing logic reused through Material-only policy/presentation/device guards. Other-role defaults preserved.
- Restored the source logout PIN/biometric cleanup that the historical partial checkpoint deliberately omitted. An optional callback runs inside the existing serialized logout before clearing the session; the lock write checks the original account/epoch/identity and stays in the existing lock-storage queue.

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
| Sequence list; `SupplySequenceScreen` | `MaterialSequence.*` | ok | ok | Global canonical cache, stream cursor validation, exact legacy move/replay; source catalog limit 200. |
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
| Print form and close confirmation | `GScaleScreen.*`, `gscaleMaterialPresentation` | ok | ok | Source values, order spinner, exact Yo‘q/Ha confirmation, save/print/printer-event snackbars. |
| Archive details/nested receipt QR | `MaterialArchive.ios`, `GScaleScreen.android`, `GScaleReceipt.android` | ok | ok | Source metadata, inline warning/error and success snackbar, empty-EPC/busy states. |
| Device picker/technical details | `DeviceSheet.*`, `MaterialDevicePicker.*` | ok | ok | Source connection order, native controls, USB-error snackbar, Bluetooth disclosures. |
| Manual server; `ManualServerSheet` | `MaterialDevicePicker.*`, `useMaterialManualServer` | ok | ok | Probe, dismiss, then return selected endpoint. |
| Logout; `core/security/state/security_controller.dart:59`, `core/session/accounts/account_switch_controller.dart:88` | `useMaterialSession`, optional `auth.logout`/`appLock.clearAppLock` callbacks | ok | ok | Clears the original account lock before session removal; a newer login remains protected. |

### Text-report surfaces

The 33 static report entries include duplicate call/declaration references and optional branches. These are their runtime verdicts, in addition to the assignment/detail/scanner surfaces above. Ellipses abbreviate the long GScale part filenames; GScale paths are under `features/gscale/`.

| V2 surface and location (under `lib/src/`) | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `core/widgets/feedback/rps_qr_reprint_sheet.dart:122,124` delete dialog/AlertDialog | `MaterialArchive.*` | unreachable | unreachable | Material archive supplies only onReprint, no onDelete/onEdit/onPayloadTap; source conditions omit delete/copy. |
| `gscale/...resplit2_methods_03.dart:73` standalone PopScope | Material receipt route/layout | unreachable | unreachable | controlOnly returns at12–70 before this standalone exit guard. |
| `gscale/...methods_05.dart:148` batch QR confirmation | `GScaleScreen.*`, `materialArchivePrintConfirmation` | ok | ok | Full message and source Yo‘q/Ha; original lifetime checked before write. |
| `gscale/...methods_03.dart:170` default-warehouse picker | GScale shared picker | unreachable | unreachable | Entry is in the standalone Server section; Material controlOnly exposes Print/history. |
| `gscale/...methods_03.dart:330` item picker | `useGScalePicker`, native `ChoiceSheet` | ok | ok | Shared native picker, source empty/error/photo-choice surfaces. |
| `gscale/...methods_03.dart:471` warehouse picker | `useGScalePicker`, native `ChoiceSheet` | ok | ok | Source item-independent Material scope and selection. |
| `gscale/...methods_03.dart:653` apparatus picker | `GScaleScreen.*` | ok | ok | Plain source options; result resolves after sheet dismissal. |
| `gscale/...methods_05.dart:18,55` archive receipt/details sheets | `MaterialArchive.ios`, Android Material archive sheets | ok | ok | Separate nested sheets with source dismissal/actions. |
| `gscale/...declarations_part_01.dart:449` device sheet and showPrintDevicePicker references356/448 | `MaterialDevicePicker.*`, `DeviceSheet.*` | ok | ok | Material-only opt-in, source discovery and local device paths. |
| `gscale/...widgets_part_02.dart:78` manual-server sheet | `MaterialDevicePicker.*`, `useMaterialManualServer` | ok | ok | Native nested sheet; probe then dismissal then selection. |
| `material_taminotchi/...widgets_part_01.dart:64` history details | Existing `MaterialHistory.*` | ok | ok | Reconnected full source history sheet. |
| `gscale/presentation/gscale_mode_screen.dart:261` device selection | Material receipt header | ok | ok | Source device picker through Material shell. |
| `material_taminotchi/...widgets_part_01.dart:243` Home scanner | `RawSplitScanner`, `MaterialHomeRoute` | ok | ok | Reused scanner; same QR normalization/assignment navigation. |
| `core/widgets/feedback/rps_qr_reprint_sheet.dart:99` success snackbar | `useMaterialArchiveReceipt`, native CustomerSnackbar | ok | ok | Four seconds; warning remains inline. |
| `gscale/...methods_02.dart:160` save-context snackbar | `GScaleOperatorStore`, native CustomerSnackbar | ok | ok | Source message and repeated-notice revision. |
| `gscale/...methods_02.dart:200` batch-information snackbar | Shared operator | unreachable | unreachable | Active non-draft returns at95; savingDraft returns at164. |
| `gscale/...methods_02.dart:285,293` printer done/error snackbars | `GScaleOperatorStore`, native CustomerSnackbar | ok | ok | Source event-key deduplication and four-second status. |
| `gscale/...methods_02.dart:377` late ERP error snackbar | `GScaleOperatorStore`, native CustomerSnackbar | ok | ok | Same inline error plus deduplicated snackbar and existing automatic stop policy. |
| `gscale/...methods_03.dart:90` simple receipt success | Shared GScale Preparation branch | unreachable | unreachable | `_isTayyorlovSimpleWarehouse` requires tayyorlov_masteri. |
| `gscale/...methods_03.dart:236` warehouse-setup snackbar | Shared standalone Server section | unreachable | unreachable | Not exposed by Material controlOnly. |
| `gscale/...methods_03.dart:283` missing-session preset snackbar | Original Material session guard | unreachable | unreachable | Material requires a real session and does not pass Preparation formula presets. |
| `gscale/...methods_04.dart:243` manual print snackbar | `GScaleOperatorStore`, native CustomerSnackbar | ok | ok | Source print-success text/transport/count. |
| `gscale/...methods_05.dart:207,247` archive print snackbars | `GScaleOperatorStore`, native CustomerSnackbar | ok | ok | Source local/remote success messages. |
| `gscale/...declarations_part_01.dart:216` USB detection error snackbar | `useMaterialDeviceNotice`, `MaterialDevicePicker.*` | ok | ok | Source prefix and four-second repeated error handling. |
| `material_taminotchi/...declarations_part_02.dart:327`, widgets01:206,236 scope snackbars | `MaterialHomeRoute`, existing Preparation notice host | ok | ok | Source missing-group text and original navigation guard. |

## Source-branch validation before integration

- Final whole project: **9,031 passed, one unrelated existing Admin failure, 12 existing TODO tests** (9,044 total, exit 1). The sole failure is reproduced unchanged in an isolated export of base main. Logout/account/lock focused follow-up: **91 passed**.
- Android and iOS TypeScript pass. Lint exits 0 with one existing `AdminClosedHistoryOwner.tsx:36` dependency warning. Offline Android/iOS Hermes exports pass; these are not native builds.
- Pinned Material text gate passes on both platforms: zero missing/added/ambiguous/global-only diagnostics. `docs/port/text/material.tsv` contains 1,248 evidence rows (including other-role imports, non-UI literals, runtime/borrowed source edges and unreachable/excluded branches). This is an audited static-source result, not a screenshot/layout proof.
- Swift/Kotlin native host tests passed for actual supply-task socket admission and 25-second protocol ping. Worker/warehouse socket admission remains isolated.
- Captured 32 V2 request/response exchanges from 23 source tests (order-scan bootstrap, Preparation, Qolip). Pinned order-scan fixture was already identical. New captures under `tests/contracts/f11910bb/` preserve historical fixture baselines.
- Independent pinned V2 oracle: 153 passed, 10 failed. Nine Qolip/Material widget cases fail on old task keys, missing legacy read-error text or old refresh counts; the Home GScale case expects a widget type absent from its native control-only tab tree (`No element`, source test266). Task/model/API and receipt defaults/batch-order rules pass. No V2 test or source file was modified.
- Current-tree ledger check passes. Pinned f119 check reports seven existing Metalayzer symbols added after f119; baseline and other-role tags remain unchanged.
- Final current-tree check resolves 1,685 source tags and 118 source-test tags. The pinned Material role report runs successfully. All 16 literal-endpoint warnings are inherited/dynamically constructed shared endpoints; this role adds no unreferenced endpoint.

## Checkpoints

- `d8b7066f` — task transport/runtime, Dart wire validation, shared assignment rules and pinned contract captures.
- `af6a9c04` — both native role flows, full detail/sequence/assignment, shared receipt/devices and source logout cleanup.
- `1f9bde96` — source audit checkpoint, per-text verdicts and verification/acceptance record. The source worktree was clean; the user's uncommitted main edits are intentionally preserved.

## Main integration

- Resolved 12 conflicts against main `615ff2bf` without selecting one role's implementation wholesale. Qolip's external task stream and Material's optional task stream/cache both remain. Shared lexical JSON parsing preserves the two tested contracts.
- Qolip's boolean guards/read witnesses remain unchanged. Material explicitly retains its original legacy authorized-read/401-refresh policy through separate `beforeSend` options; Material stage history opts into its legacy read policy. The Qolip order-products path keeps `checkAfter=false`, while Material's guarded path keeps `checkAfter=true`. Global authentication was not changed to resolve these conflicts.
- Worker overview keeps both Qolip's `summaryTitle` override and Material's `summaryKind` information fallback. Native task sockets retain the 25-second protocol ping, bounded 10-second Upgrade and existing endpoint isolation; both Material and Qolip Swift/Kotlin host checks pass.
- Preserved the exact bytes and modes of the original dirty `AGENTS.md`, `src/app/ios-preparation/(home)/_layout.tsx`, `src/preparation/PreparationUI.android.tsx`, plus all 125 untracked GScale build files. Tracked-file copies and the hash manifest are under ignored `.port/material-merge-preserve-20261117T085134Z/`. These user edits are not staged in the merge.
- The current-main baseline has 20 pre-existing test failures: the Admin scaffold assertion, 17 Admin warehouse test-loader failures and two base inventory test-file loader failures. An isolated read-only export of `615ff2bf` reproduces all 20 (16 passed/20 failed in those four files); none of those production/test files was edited by this merge. The loader failures refer to the existing `shared/productionOrderNote` import.
- Final integrated tree: **9,151 tests; 9,119 passed, the same 20 baseline failures, 12 existing TODO**. Failure names match the isolated pre-merge-main run; no new failure. Focused API/component/transport merge regressions: **95/95 passed**; shared task/Qolip/Material regressions: **70/70 passed**.
- Both Android/iOS TypeScript checks and production Metro/Hermes exports pass. Lint exits 0 with the same existing Admin hook dependency warning. Both roles' Swift/Kotlin task host tests pass. Native application/hardware acceptance is still outstanding as above.
- No push or branch deletion is performed.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Physical phone/hardware | Native Material/GScale/scanner/printer surfaces | Real Android/iPhone, scale and Bluetooth/Zebra USB/Wi-Fi printer validation. No simulator/device used. Rebuild the development client for the new native supply socket. |
| GoDEX | D13; V2 GoDEX choices | Intentionally excluded, including restored choices/dispatch; no GoDEX parity claim. |
| Shared demo mode | D3 | Deferred shared work; no fake replacement. |
| Pinned V2 widget failures | `qolip_tasks_test.dart`, `material_taminotchi_home_screen_test.dart` | Preserve oracle failure evidence; obsolete widget-key assertions do not define production behavior. |
| Existing Admin test | `tests/adminScaffoldLayoutReader.test.cjs:23` | The same source-frame coherence assertion fails in an isolated export of base main `0a07da54` (16 pass/1 fail). It is outside this role; no Admin source/test was changed. |
| Pinned cross-role tag check | Seven Metalayzer tags | Existing Metalayzer symbols were added after f119. Current V2 check resolves all tags; pinned check cannot resolve those seven unrelated tags. No baseline relabeling or other-role edits. |

## Deviations candidates

- Source manual assignment changes order without eagerly running the QR branch’s candidate reload; preserved.
- Existing inventory-only Material home-route/capability mismatch remains unchanged.
- Older development clients without `openSupplyTasks` use the real React Native WebSocket fallback; protocol ping requires the rebuilt native bridge.

## Test mode pending

Shared demonstration mode remains deferred by D3; reserved-token notice retains its existing behavior.

## Needs from the integrator

No extra code wiring handoff. Local main integration is recorded above. Native client build and physical checks remain; no push was performed.

## Supporting shared edits

- `auth.ts` and `appLock.ts`: optional Material logout cleanup/ownership guard. Callers omitting the new options keep their original behavior.
- Worker material/QR/WIP/overview components and their existing API readers: optional original-owner guards, read-only stage controls and Material unlink/status presentation. Existing Worker defaults are retained and regression-tested.
- `apparatusApi.ts`, `productionMapAuthorizedApparatus`, shared supply-task models/controller and the native production-live module: reuse source canonical validation and the existing transport/cache instead of a parallel client.
- GScale and shared printing views/runtime: opt-in Material presentation, original-account/device policy and device picker. Existing Preparation/Worker defaults remain unchanged.

## Real-phone acceptance

1. Open every Home card and drawer/dock destination; verify Android sizing and iOS native controls, drawer/back, keyboard and safe areas.
2. Exercise task/sequence filters, offline cached rows, live reconnect, detail/image/material/mold/map/history, then receipt and return refresh.
3. Exercise manual/QR and sequence bulk assignment, ambiguity/unlink, repeated scanner input, denied routes and account changes while reads/sheets are open.
4. Test real Wi-Fi scale, Bluetooth and Zebra USB detection, item/order locking, tare/gross/net, save/start/print/stop, archive/reprint and failed/uncertain writes. Verify logout removes only the original account’s lock.
