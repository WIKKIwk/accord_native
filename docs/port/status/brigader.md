# Brigader

Status: all 25 requested route compositions implemented and statically source-audited; software checks and integration evidence below. Physical acceptance belongs to the user; camera/text-tool limitations are explicit.
Current scope: the 25 remaining routes requested on 2026-11-17. Earlier checkpoint sections below are historical, not a current missing-route inventory.
Branch: `port/brigader`, isolated worktree `accord_mobile_v4-brigader`, based on main `b6aee7b9`.
Source: baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`; Brigader core is unchanged at current V2 `052655a4`.
Scope: Brigader only; the ledger combines Sales Manager with this id, but Sales Manager is outside this request.

## Checkpoint: saved calculation contracts and state

Added the three missing shared APIs `calculateOrderTemplates`, `upsertCalculateOrderTemplate`,
`deleteCalculateOrderTemplate`, reusing the existing opened-order template representation.
The shared serializer preserves optional fields, effective legacy layers, Dart text/date handling and UTC microseconds.
`CalculateOrderTemplateStore` preserves source scope/generation, archive singleflight, first-code/id dedupe,
mutation replay over a late archive, reset and disposal. The optional request guard reuses existing authorizedFetch.

Validation: 14 focused source-derived tests passed. These are not recorded V2 HTTP fixtures.
Source references: `core/api/calculate/mobile_api_calculate_models_part_01.dart`,
`features/admin/state/calculate_order_store.dart`, `core/api/calculate/mobile_api_calculate_declarations_part_03.dart`.

## Historical open items before the remaining-routes implementation

| Where | V2 reference | Required result |
|---|---|---|
| Complete Brigader scope | `AppRouter.canOpenRoute`, `test/brigader_role_test.dart` | All 47 allowed routes, 17 source Home actions (or four summary shortcuts), 16 drawer entries, four dock entries and five Create actions must have real compositions. The existing Admin dependency is partial; do not mark this complete by counting tags or hiding unavailable entries. |
| Shared Admin source presentation | `AdminDock`, `showAdminCreateHubSheet`, `AdminUsersScreen`, shared root/sheet callers | Users and its original owned child compositions are now connected in the follow-up below. The complete default Create flow and the remaining source-root feature compositions still require their actual pages; no placeholders are exposed. |
| Work Map | `AdminProductionMapOrdersScreen` and its details/Closed/Move controls | Existing reused view remains partial; full action/detail/closed-history/drag and source surface audit remain required. |
| Saved calculations UI | `AdminCalculateOrdersScreen`, `AdminCalculateScreen` | APIs, serializer and scoped template store are implemented; saved-list/editor/calculator native screens and their nested product/customer/catalog flows still require the real shared Admin composition. |
| Camera parity | V2 ReliableMobileScanner / Inventory QR | Existing shared Expo camera does not reproduce source restricted detection window, tap-to-focus and auto-zoom. Do not claim hardware parity. |
| Source text gate | `.port/text-brigader.md` | Gate includes transitive Admin files and Sales Manager. Audit each real Brigader surface; no blanket acceptance rows are added. |
| Physical native acceptance | Android/iOS shell, dialogs, keyboard, native live, PIN, camera/printer paths | Real phones/development binaries are required; no device or simulator used. |
| Required native development client | `AccordAdminLayout.readInsets`, `AccordProductionLive.openInventory`, `AccordNativeClock` | Rebuild before using this branch. Expo Go/older binaries do not contain these methods. In particular the reused Admin frame waits for genuine native inset metrics, so an older binary can show a header with hidden Home content. No synthetic geometry was added. |

## Historical baseline surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| AdminHomeScreen | `src/brigader/BrigaderHomeRoute.*.tsx`, reused `AdminHomeScreen.*` | partial | partial | Source title/store/summary/return refresh reused; unavailable Admin actions remain missing. |
| AdminNavigationDrawer | shared `AdminDrawer`, Brigader namespace | partial | partial | Actual Brigader stack and source planner; missing Admin destinations not claimed as ported. |
| AdminDock | native Brigader tabs / BrigaderBottomBar | partial | partial | Home, Users and Activity are connected; the genuine Create adapter currently exposes implemented user creation only. Four Create destinations remain open. |
| Profile, Settings, PIN and logout | `BrigaderProfileRoute.*`, guarded existing Profile/Settings/Security | code checked | code checked | Native screens reused; original account guard now reaches delayed PIN/hash/remove/biometric storage; source logout before-clear hook clears app PIN and switch PIN. Physical input/sheets still untested. |
| Activity | shared AdminActivityRouteCore | reused | reused | Original hidden-notification store, load/clear confirmation and source return lifecycle; fallback now returns to actual Brigader Home. |
| Factory Locations | shared AdminFactoryLocationsRoute | reused | reused | Native editor/picker/controller and source guards; no separate API or fake grant. Device surface audit remains open. |
| Item Groups | shared AdminItemGroupsRoute | reused | reused | Native tree/list/pickers/forms and source guard; device surface audit remains open. |
| Additional Settings | shared AdminAdditionalSettingsRoute | reused | reused | Brigader management branch retained; forbidden ERP Settings and Roles stay closed. |
| Queue Policies | shared AdminQueuePoliciesRoute | reused | reused | Existing complete source read/write composition under original Brigader witness. |
| Inactive Users | shared AdminInactiveSuppliersRoute | reused | reused | Source route allowlist and original role owner; direct native route exists, surrounding Users root still incomplete. |
| Inventory Movements | BrigaderInventoryRoute.*, brigaderInventorySession | code + protocol tests | code + protocol tests | Existing native worker controls/store reused with Brigader admin-component behavior, guarded snapshot/lookup/relocate/batch/transfer and dedicated existing-module live endpoint. V2 transfer-detail actions are intentionally absent: actual source caller passes actionsFor: (_) => const []. Camera/device differences remain open. |

## Shared supporting changes

- Admin context accepts a genuine Brigader owner; default Admin admission remains unchanged. Parameterized session bootstrap,
  drawer active-stack namespace, top-notice predicate, Android Work Map footer and actual-home fallback are the minimal shared adapters.
- Profile/Settings and Security accept optional original-session guards, preserving existing unguarded caller defaults.
  PIN writes/deletes recheck after asynchronous identity hashing, app PIN hashing and biometric authentication.
- Existing Inventory APIs accept optional guards; default request shape/behavior stays unchanged. Worker Inventory content was
  extracted for reuse, and the existing native production-live module gained only the dedicated Inventory endpoint.
- A provider cleanup bug found in independent review was fixed. A deferred final-detach lease keeps React's child layout/passive
  replay from permanently retiring the real Notice Messenger; original account/scope loss remains irreversible.

## Validation evidence

- Independent V2 oracle: `v2_oracle.sh test/brigader_role_test.dart`, all 5 tests passed in a temporary baseline export.
- Instrumented same source test recorded 3 requests at the pinned baseline. V4 replays roles → system-user creation → code
  regeneration and verifies `brigader` identity and the exact recorded `93` code, without customer/assignment substitution.
- Focused Brigader tests passed, including permissions, route namespaces, original-session invalidation, native adapters,
  calculation templates, PIN/logout races and real Notice Messenger effect replay. Final gate counts are recorded below.
- Actual Swift Foundation and Kotlin/OkHttp socket sources compiled and ran Inventory host policy fixtures. This is not a full
  Expo app binary, physical network/phone, or printer/camera test.
- Baseline comparison uses a temporary clean export of main `b6aee7b9`, not the user's dirty checkout. With JDK17 and installed Xcode,
  that baseline full Node suite has 9303 tests: 9272 passed, 19 failed, 12 TODO. The 19 failures are 17 AdminWarehouseMainRead
  loader cases and two baseInventoryView runtime/store loader failures; they predate this branch. Existing TODOs remain TODOs.
- Both platform TypeScript checks passed. Expo lint passed with zero errors and the inherited
  `AdminClosedHistoryOwner.tsx:36` dependency warning. Full final suite/text counts follow after the stable snapshot gates.

## Final software gates

| Gate | Actual result |
|---|---|
| V2 Brigader oracle | 5/5 passed, clean temporary export of `f11910bb` |
| Focused branch + affected Inventory/Profile regressions | 87/87 passed |
| Full Node suite, stable source snapshot | 9358 total: 9327 passed, 19 failed, 12 TODO. Compared by failing test title with clean baseline `b6aee7b9`: zero new failures; the same 19 existing loader failures remain. |
| iOS TypeScript | passed |
| Android TypeScript | passed |
| Expo lint | passed; zero errors, one inherited Admin warning |
| Android Metro export | passed, isolated `.expo/brigader-export-android` |
| iOS Metro export | passed, isolated `.expo/brigader-export-ios` |
| Ledger check | passed: 1847 tags / 121 test tags resolve; 18 existing literal-endpoint warnings remain, no new endpoint warning |
| Role ledger | generated, still incomplete: combined Sales Manager/Brigader transitively includes shared Admin work and uncovered native surfaces |
| Text gate | failed: iOS 33 missing / 275 extra; Android 33 missing / 278 extra; zero ambiguous tags. Zero acceptance rows added. These transitive scope findings require a real surface audit, not blanket exceptions. |
| Native Inventory host checks | real Swift Foundation and Kotlin/OkHttp socket source compile/run passed; full Expo bridge/app binary not built |
| Device / emulator / simulator | none used |
| Main checkout | unchanged by this work; existing user edits retained |

Source-mode Inventory now removes the extra generic close footer and uses source transient bottom feedback on both platforms.
Android reuses the existing worker search, pager, list, filter, cards, selection bar and native action menu;
iOS reuses native Inventory content with comfortably sized primary controls.

Checkpoint `9138cc2a` contains calculation-template APIs/state. The following workspace checkpoint contains native routing,
the shared original-session/Profile/Inventory adapters, source fixture replay, all affected tests, and this complete coverage record.

## Deviations candidates

None introduced as product decisions. Missing shared dependencies are incomplete work, not accepted deviations.

## Test mode pending

Shared V2 test mode remains deferred under project D3. A legacy `test-mode-token` cannot enter a live Brigader workspace.

## Source coverage and test limits

The role ledger estimates 65k source tokens; this is not a measurement of tokens read.
V2 is read-only. No production backend calls, simulator or physical device used.
Main and the user's existing uncommitted work are untouched.

## Historical baseline route coverage

All 47 source Brigader routes are accounted for below. A native route existing does not certify every inherited surface.

| V2 route | iOS / Android native composition | State |
|---|---|---|
| `/brigader-home` | `/<platform>-brigader` | partial source surface |
| `/admin-home` | `/<platform>-brigader` | partial source surface |
| `/admin-factory-map` | Shared Admin/operational source composition required | open |
| `/admin-calculate-orders` | Shared Admin/operational source composition required | open |
| `/admin-calculate` | Shared Admin/operational source composition required | open |
| `/admin-production-map-test` | Shared Admin/operational source composition required | open |
| `/admin-production-map-orders` | `/<platform>-brigader/work-map` | partial source surface |
| `/admin-suppliers` | Shared Admin/operational source composition required | open |
| `/admin-activity` | `/<platform>-brigader/activity` | composed; device acceptance pending |
| `/admin-item-bulk-move` | Shared Admin/operational source composition required | open |
| `/admin-opening-wip` | Shared Admin/operational source composition required | open |
| `/admin-wip-batches` | Shared Admin/operational source composition required | open |
| `/admin-notifications` | Shared Admin/operational source composition required | open |
| `/admin-apparatus-settings` | Shared Admin/operational source composition required | open |
| `/admin-apparatus-groups` | Shared Admin/operational source composition required | open |
| `/admin-additional-settings` | `/<platform>-brigader/additional-settings` | composed; device acceptance pending |
| `/admin-warehouses` | Shared Admin/operational source composition required | open |
| `/admin-factory-locations` | `/<platform>-brigader/factory-locations` | composed; device acceptance pending |
| `/admin-raw-material-settings` | Shared Admin/operational source composition required | open |
| `/admin-raw-material-rules` | Shared Admin/operational source composition required | open |
| `/admin-raw-material-assignments` | Shared Admin/operational source composition required | open |
| `/admin-calculate-materials` | Shared Admin/operational source composition required | open |
| `/admin-worker-settings` | Shared Admin/operational source composition required | open |
| `/admin-item-group-create` | `/<platform>-brigader/item-groups` | composed; device acceptance pending |
| `/admin-create-hub` | Shared Admin/operational source composition required | open |
| `/admin-user-create` | Shared Admin/operational source composition required | open |
| `/admin-supplier-create` | Shared Admin/operational source composition required | open |
| `/admin-customer-create` | Shared Admin/operational source composition required | open |
| `/admin-customer-detail` | Shared Admin/operational source composition required | open |
| `/admin-worker-detail` | Shared Admin/operational source composition required | open |
| `/admin-worker-profile-detail` | Shared Admin/operational source composition required | open |
| `/admin-inactive-suppliers` | `/<platform>-brigader/inactive-suppliers` | composed; device acceptance pending |
| `/admin-item-create` | Shared Admin/operational source composition required | open |
| `/admin-item-detail` | Shared Admin/operational source composition required | open |
| `/admin-supplier-detail` | Shared Admin/operational source composition required | open |
| `/admin-supplier-items-view` | Shared Admin/operational source composition required | open |
| `/admin-supplier-items-add` | Shared Admin/operational source composition required | open |
| `/admin-werka` | Shared Admin/operational source composition required | open |
| `/admin-queue-policies` | `/<platform>-brigader/queue-policies` | composed; device acceptance pending |
| `/admin-apparatus-create` | Shared Admin/operational source composition required | open |
| `/admin-progress-qr-scan` | Shared Admin/operational source composition required | open |
| `/apparatus-queue` | Shared Admin/operational source composition required | open |
| `/apparatus-work-instructions` | Shared Admin/operational source composition required | open |
| `/apparatus-daily-work` | Shared Admin/operational source composition required | open |
| `/apparatus-paddons` | Shared Admin/operational source composition required | open |
| `/apparatus-paddon-detail` | Shared Admin/operational source composition required | open |
| `/inventory-movements` | `/<platform>-brigader/inventory` | composed; device acceptance pending |

## Main integration — 2026-11-17

Merged `port/brigader` (`f3f12b7a`, including `9138cc2a`) onto main `e9df4810` at the user's explicit request.
The single AdminShellContext conflict retains main's Admin admission comment and the Brigader context export.
Both Admin and Brigader native home mappings and their separate admission checks remain intact.
146 focused integration/regression tests passed; both platform TypeScript checks and Expo lint passed
(the existing AdminClosedHistoryOwner dependency warning remains).
The user's three unstaged tracked files and 125 untracked build files were backed up outside the repository
and verified byte-for-byte before committing. They remain outside the merge commit.
This integration does not mark the unfinished Brigader source routes or text/device audits complete.

## Follow-up: real Brigader connections

- The shared private route owner now accepts an explicit original-role predicate and workspace path, preserving its Admin defaults.
  Brigader supplies `brigaderMayEnter` and its own native stack. IDs remain opaque; original customer/supplier/worker arguments,
  nested item pickers and awaited changed results stay in the existing guarded registry.
- Connected native Users, customer/material-supplier detail and assignments, supplier detail/items view/items add,
  worker detail/activity profile, Werka detail and guarded Profile/Settings/PIN. No Admin identity or capability is fabricated.
- Connected the existing general user-creation controller/screens (including role choice, Brigader restrictions and issued codes),
  plus the two distinct V2 supplier/customer party forms. Those forms retain name/phone order, trimmed input, disabled saving,
  cache invalidation and source return behavior; no new validation or error surface was invented.
- Connected the fully composed shared Admin warehouse screen with scope `admin` for the real Brigader. Existing item-roll,
  reserved-order, raw-stock QR and settings flows are reused.
- Connected profile chat actions to the actual chat runtime/cache, guarded direct-message API, header metadata and native thread.
  Self-chat stays absent. Opening remains busy until the original profile regains focus; failures use the existing source notice.
- iOS now uses one native stack for genuine parent/child returns, with the existing SwiftUI dock on shared pages.
  Android retains the Material dock and existing worker components. Both expose the actual Users and creation connections.
- The root Hub is genuine. Only the currently implemented user-creation action is exposed by the source-derived creation action
  adapter. Item creation, progress QR, saved calculations and calculator actions remain absent until their actual Admin pages exist;
  this remains a source parity gap, not a completed five-action Create flow.
- FAB obstruction now follows actual mounted named/private profile routes, including a profile covered by another native route.

### Historical remaining software routes (25 of 47)

`adminFactoryMap`, `adminCalculateOrders`, `adminCalculate`, `adminProductionMapTest`, `adminItemBulkMove`,
`adminOpeningWip`, `adminWipBatches`, `adminNotifications`, `adminApparatusSettings`, `adminApparatusGroups`,
`adminRawMaterialSettings`, `adminRawMaterialRules`, `adminRawMaterialAssignments`, `adminCalculateMaterials`,
`adminWorkerSettings`, `adminCreateHub` (full five-action flow), `adminItemCreate`, `adminItemDetail`,
`adminApparatusCreate`, `adminProgressQrScan`, `apparatusQueue`, `apparatusWorkInstructions`,
`apparatusDailyWork`, `apparatusPaddons`, `apparatusPaddonDetail`.

15 source routes have direct native destinations; seven additional source routes are reachable with their required original
arguments through the real private registry. This is 22/47 routing coverage, not a claim of complete feature/surface parity.
Earlier Work Map and camera differences remain open. No missing route was mapped to an unrelated page or a placeholder.

### Follow-up verification

The focused original-role/private-navigation/dock/composition regressions cover 72 cases. The initial run passed 69,
two old profile fixtures lacked their now-required profile metadata and one new asynchronous test omitted the registry
read that settles a retired argument. After correcting those fixtures, all 33 cases in the affected two files passed;
the other 39 had already passed. Both platform TypeScript checks pass. The final lint result follows in the completion record.
No device, simulator or emulator was used; manual device acceptance is left to the user as requested.

Final follow-up lint: zero errors, one pre-existing warning at `AdminClosedHistoryOwner.tsx:36`; no new warning.

## Connection checkpoint merged into main

- Implementation checkpoint: `b9e21c87` (`port/brigader/wiring: connect Users, creation, warehouses and chat`).
- Main merge: `4990334f`, no conflicts.
- The three existing tracked user edits remained unstaged. All 128 existing dirty/untracked files retained their exact SHA-256
  contents across the merge. Snapshot/patch backup: `.codex-merge-backups/brigader-connections.dihvm35o` in the parent workspace.
- Post-merge iOS and Android TypeScript pass. Post-merge lint has zero errors and the same pre-existing dependency warning.
- 145 relevant regression cases passed across original-role navigation, native composition, creation transport/state and shared Chat.
- This merge completes the connections listed above; it does not complete the 25 absent source feature routes or full 1:1 Brigader parity.

## Remaining-routes checkpoint: products

Connected the original Item Create/Bulk Move and Item Detail native implementations on both platforms. Original
DTOs and return values stay in a scoped private registry; a child result is delivered only after its actual native
route unmounts. Customer creation retains the source customer-only User Create flow. The real native dialog/sheet
attachment and detach acknowledgements guard decision commands. No Admin identity or permission is substituted.

Added the actual per-route Source Scaffold/ScaffoldMessenger integration using the existing native layout observer,
real viewport/dock markers, platform palette and accessibility settings. Accepted notices survive route changes.
These adapters are shared supporting changes to `AdminFixedSnackBar*` and `useAdminTopNoticeScaffold`.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Item Create / bulk move: AppRouter item-create/bulk-move branches; admin_item_create_screen and dialogs | BrigaderItemCreate + existing AdminItemCreateScreen | source controls and result flow compared | source controls and result flow compared | Native platform controls; device acceptance pending |
| Item detail edit/delete/group/customer/actions: admin_item_detail_screen, admin_item_detail_editors | BrigaderItemDetailPresentations + AdminItemDetail native leaves | dismissal/result lifecycle compared | native attach/detach lifecycle compared | Native platform controls; device acceptance pending |

Verification: both platform TypeScript checks pass; Expo lint has zero errors and the one inherited
AdminClosedHistoryOwner warning. No unit or device tests were run in this request, as requested by the user.
The remaining 22 software routes are still in progress; this checkpoint is not completion of Brigader parity.

## Remaining-routes checkpoint: notifications and apparatus

- Connected Notifications with the original completion decisions, single-flight reads, live/read version fence,
  foreground lifecycle, first-event timeout, authorization-stop rule and jittered reconnect/HTTP fallback.
- Connected Apparatus Settings, Groups and Create. Preserved the hub/back behavior, warm cache, active/sort filtering,
  focused-create dialog, master editor, custom group dialogs, deletion confirmation, canonical groups and original
  apparatus-detail navigation. Detail includes material-assignment permission, training, capacity, queue and placement.
- Added the missing canonical apparatus creation/patch/training requests using the existing validated drafts and actual
  native microsecond clock. Placement keeps Source's read-back/revision-conflict algorithm.
- Capacity retains all profile, downtime and scheduling fields, requirement parsing, alternatives, dates, validation,
  source idempotency keys, reloads and notices. The existing Queue Policy native implementation is reused as a panel.
- The map object picker uses the unchanged V2 offline renderer and identical runtime GLB, bundled for a real WebView.
  This is also the foundation for the still-pending full Factory Map page. WebView requires a rebuilt development binary.
- Corrected the shared fixed-notice reader adapter so a native pair publication does not recreate its own watch.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| admin_notifications_screen and its two parts | BrigaderNotifications, brigaderNotificationController | states/decisions compared | states/decisions compared | Native controls; device acceptance pending |
| admin_apparatus_settings_screen and its four parts | BrigaderApparatusScreen, brigaderApparatusController | module/editor/group paths compared | module/editor/group paths compared | Native controls; device acceptance pending |
| admin_apparatus_detail_screen; capacity panel and parts | BrigaderApparatusDetail, BrigaderCapacityPanel | fields, command bodies, native close compared | fields, command bodies, native close compared | Native controls; device acceptance pending |
| admin_factory_map_viewer object picker; factory_map_bindings | BrigaderFactoryMapObjectPicker, AdminFactoryMapViewer, factoryMapBindings | actual asset/picking path ported | actual asset/picking path ported | WebView carrier replaces Flutter plugin; device acceptance pending |

Both platform TypeScript checks pass. Expo lint: zero errors and one inherited AdminClosedHistoryOwner warning.
No unit or device tests were run. Seven of this request's 25 routes are now composed; 18 remain in progress.
The complete role and its text/surface audit are not yet marked done.

## Remaining-routes checkpoint: apparatus operational pages

Connected the five Source operational routes: apparatus queue (including original initial QR handoff), work instructions,
daily work, paddons and paddon detail. Existing native worker screens/controllers are reused with the actual Brigader
profile, original assignments and capability checks. The Source apparatus dock uses Home/Profile and its three original
actions. The non-operator paddon list keeps Source's all-apparatus read, create/detail return, delete action sheet +
confirmation and refresh flow; transfers use the non-operator all-pallet read. A validated scan seed is single-use and
original-session scoped. Paddon detail retains existing scanner, WIP, selection, printing, transfer and back guards.

Supporting shared edits: WorkerScreen's optional route-selection/initial-QR inputs; WorkerPaddon runtime admission of
the real authorized Brigader; detail seed handoff; transfer's Source administrative branch; long-press support on the
new shared Brigader row. Existing worker defaults remain the same.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| AppRouter apparatusQueue workerMode branch | BrigaderApparatusPages + WorkerScreen | original session/read flow composed | original session/read flow composed | Existing native worker views reused; device acceptance pending |
| AparatchiWorkInstructionsScreen / AparatchiDailyWorkScreen | WorkerWorkInstructions / DailyWorkScreen + Brigader apparatus dock | existing native screens composed | existing native screens composed | Native controls; device acceptance pending |
| AparatchiPaddonsScreen non-operator branch | BrigaderPaddons / brigaderPaddonListModel | list/create/delete/returns compared | list/create/delete/returns compared | Native controls; device acceptance pending |
| AparatchiPaddonDetailScreen / transfer / scope | WorkerPaddonDetail / WorkerPaddonTransfer / WorkerPaddonDetailSeed | source role/seed/transfer branches composed | source role/seed/transfer branches composed | Existing native worker views reused; device acceptance pending |

Both platform TypeScript checks pass; Expo lint has zero errors and the one inherited warning. No unit or device tests
were run. Twelve of the requested 25 routes are composed; the other 13 are still in progress.

## Remaining-routes checkpoint: WIP and Opening WIP

Connected WIP Batches and both Opening WIP tabs. WIP keeps the source waiting-only verification, canonical-location
filter, second filtered request, grouping, labels and quantity formatting. Opening WIP retains eligible-order and
physical-successor rules, roll validation, exact fingerprint/idempotency key, duplicate confirmation, original printer
selection, create/read-back validation and partial-print retry without recreating batches. List/detail/reprint/delete
flows retain the source sheet/dialog kinds, fields, lock checks, FIFO notices and two-attempt transport-only deletion.

The legacy HTTP helper now records actual caught transport/timeout facts without replacing thrown values; the new
delete request uses those facts rather than guessing from exception names. The existing project printer selector's
Bluetooth preference remains in effect; no GoDEX implementation or hardware testing was added.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| admin_wip_batches_screen and parts | BrigaderWipBatches / brigaderWipModel | source read/filter/card flow compared | source read/filter/card flow compared | Native controls; device acceptance pending |
| admin_production_map_orders_opening_wip: wizard/duplicate/order picker | BrigaderOpeningWip / brigaderOpeningWipModel / BrigaderOpeningWipPicker | fields, validation, print retry and dismissal compared | fields, validation, print retry and dismissal compared | Existing printer preference; device acceptance pending |
| same source: WIP list/details/reprint/delete | BrigaderOpeningWipSurfaces / openingWipDeleteApi | source state/requests/close order compared | source state/requests/close order compared | Native controls; device acceptance pending |

Both platform TypeScript checks pass. Expo lint: zero errors and the inherited AdminClosedHistoryOwner warning.
No unit or device tests were run. Fourteen of the requested 25 routes are composed; eleven remain in progress.

## Remaining-routes checkpoint: workers and calculation materials

Connected full non-Rezka Worker Settings: two retained tabs, worker create/name/level dialogs and picker, canonical
apparatus assignment, server deletion check with blocked/dependency confirmation, group creation, schedule/time
pickers, unique worker selection, edit cancellation, previous-identity updates and version-triggered reloads.

Connected calculation materials: active/inactive list, actual drag handle for the reorderable active prefix, exact
editor defaults and field validation, variants/coefficient construction, sheet-result-before-save ordering, optimistic
insert/deactivation ordering, authoritative reload, sequence rollback and FIFO snack messages. Native form headers,
segmented expandable cards and fields are reused by both platforms. No Material role identity was substituted.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| admin_worker_settings_screen and all eight parts | BrigaderWorkerSettingsContent, brigaderWorkerSettingsModel, workerSettingsApi, BrigaderWorkerSurfaces | flows/requests/controls compared | flows/requests/controls compared | Native controls; device acceptance pending |
| admin_calculate_materials_screen and both parts; m3_sequence_list | BrigaderCalculateMaterialsContent, brigaderCalculateMaterialsModel, calculateMaterialCommands, BrigaderSequenceList | fields/state/drag path ported | fields/state/drag path ported | Gesture/native control carrier; device acceptance pending |

Both platform TypeScript checks pass; Expo lint has zero errors and the inherited AdminClosedHistoryOwner warning.
No unit or device tests were run. Sixteen of the requested 25 routes are composed; nine remain in progress.

## Remaining-routes checkpoint: raw-material settings, rules and assignments

Connected all three named routes to Source's same three-tab settings composition, retaining the assignments default
and original initial-barcode argument. Rules retain canonical identity/hash/revision validation, tooling preservation,
idempotent material-policy commit/read-back, alternatives, requirement sets, normalization and mandatory toggle.
The assignment panel reuses the existing real role-neutral model/parsers and request functions through an explicit
original Brigader binding. Its apparatus filter stays disabled for Brigader as in Source. List/QR tabs, candidate
details, ambiguity choice, diagnostic races, assignment details, unlink confirmation and notices are composed natively.

Added a full-screen real CameraView dialog with native window dismissal acknowledgement, QR/DataMatrix capture,
viewport admission and Source manual entry. Camera readiness comes only from onCameraReady. Camera stop waits for
the actual pausePreview acknowledgement and committed camera removal. Source plugin lens/auto-zoom/tap-focus behavior
remains part of the final scanner adapter audit; device acceptance is pending, not inferred from TypeScript.

Supporting Material edits accept an explicit real owner, disable only the Brigader apparatus filter and retain Source's
lookup-after-diagnostic commit; defaults preserve existing Material screens. Shared reads now await all parallel results
with Dart Future.wait semantics. No fake Material identity, permissions or hardware callback is used.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| admin_raw_material_rules_screen and parts | BrigaderRawSettingsContent / brigaderRawRulesModel / rawMaterialRulesApi / BrigaderRawGroupDialog | defaults, rules, requirements and surfaces compared | defaults, rules, requirements and surfaces compared | Native controls; device acceptance pending |
| admin_raw_material_assignment_screen and all parts | BrigaderRawAssignments / useBrigaderRawAssignments / existing Material model and presentation helpers | real Brigader branch and closes composed | real Brigader branch and closes composed | Native controls; device acceptance pending |
| RawMaterialScanDialog | BrigaderRawScanDialog / BrigaderCameraViewport / brigaderCameraSession | native camera/manual/dismiss composed | native camera/manual/dismiss composed | Scanner-plugin focus/zoom audit pending |

Both platform TypeScript checks pass. Expo lint has zero errors and the inherited AdminClosedHistoryOwner warning.
No unit or device tests were run. Nineteen of the requested 25 routes are composed; six remain in progress.


## QR report checkpoint — 2026-11-17

Composed adminProgressQrScan for the actual Brigader session on both platforms. Original source lookup fallback,
manual native dialog close acknowledgement, scan-only return, inline read-only paddon, roll lineage/passport,
opening-WIP, material/order/ordered-queue sections, corrections, resources, technical fold and Source PDF writer
are wired. Camera readiness/stop use actual native events. Background resumption preserves actual camera intent.
Both platform TypeScript checks and focused lint pass; no device or unit tests were run.
Twenty of the requested 25 routes are composed. Full platform/text/scanner audit remains before final integration.


## Factory-map checkpoint — 2026-11-17

Composed the offline original GLB/Three.js factory-map route. Live queue status retains canonical interaction
consistency, visible queue ordering, retired epochs/revision fencing, 15-second polling and 30-second freshness.
Physical stock uses complete paginated inventory, real warehouse events, catalog/group ancestry and one physical
row per roll. In-flight pagination is invalidated by warehouse updates; partial counts are never published.
Revision-checked attach/unlink, native close completion, actual camera focus callback plus Source fallback,
resizable sheets, filters, current-order expansion, material/WIP rows and nested read-only order sections are wired.
Both platform TypeScript and focused lint pass; user owns device tests. Twenty-one of 25 routes are composed.
Final role-wide text/platform audit remains open along with the four remaining calculation/create routes.


## Calculation archive and create hub compositions — 2026-11-17

Composed both platform archive rows/search/delete/cover preview and the complete six Source create-hub rows
(including normal Source permission denial for ERP settings). The five allowed hub destinations reuse existing
Brigader pages. Templates share one original-account store across archive and editor; no controller or profile
is fabricated. Original template DTOs are handed to the private editor route.

Both platform TypeScript and focused lint pass. The calculator and graph editor are the remaining two page
compositions; their actual navigation support must be registered only after those pages exist. Archive opening
and hub calculation entry therefore remain dependent work, not finished user flows. No unit/device tests ran.

## Calculation and graph checkpoint — 2026-11-17

All 25 requested route compositions now exist on Android and iOS. This checkpoint is implementation progress;
role-wide text, surface and integration auditing continues before completion. No unit/device/emulator tests were run.

Calculator: full and compact forms, customer/product/material pickers, actual item-create return, primary-customer
selection, existing-template recreation, catalog combos/revisions, per-account cache invalidation, multi-product
ordering and dimensions, layers with real native micron focus, numeric input formatters, JPEG upload, fresh-result
proof, remembered print side, original saved-map recovery, retry-stable order IDs, manual/automatic order opening,
opened-order concurrency snapshots/restrictions and source error dialog. All writes use original Brigader authority.

Graph: source initial/order flow, canonical apparatus catalog, technology/width/color compatibility, laminator
constraints after Rezka grouping, alternative-group insertion and assignment handling, native node controls,
pan/zoom/node drag/overlap resolution, directed and condition connections, locked nodes/incoming edges,
station/apparatus pickers, node/formula editors with cursor-aware variable insertion, Rezka merge/split sheets,
canonical/frame validation, atomic map+template/order save and genuine saved-template navigation result on system back.
The source default test canvas is retained only on its actual direct map route, not used as API fixture data.

Actual direct and private-flow compositions are wired for Calculate, saved calculations, material catalog and map editor.
The five default Create actions now use the genuine existing shared owner. Supporting shared edits are optional
picker autofocus/header action and menu placement/column props, a public existing opened-order error parser and optional
combo-read guard; existing callers keep their defaults. Neither role spoofing nor fabricated native acknowledgments are used.

Static checks at this checkpoint: both platform TypeScript checks passed before the final visual refinements; focused
lint passed after correcting the actual imports. Final checks will be recorded with the completed surface audit.
The role text script currently reports its inherited broad-scope diagnostics (33 missing, 323/328 additional), so it is
not being reported as a passing text gate. Its generated scope contains only 48 V2 strings and two Create surfaces;
the newly composed route surfaces require the explicit source comparison as well.

Audit refinements in this checkpoint: source worker deactivation tooltip and opening-WIP report heading, 48px inner raw-material tabs, captured original worker-group identity across save, barrier-versus-system-back dismissal, and Android factory machine reads after the genuine native sheet entrance animation. No device tests were run.


## Surface audit — all 25 requested routes, 2026-11-17

These are Source-code comparisons of states, fields, order, validation, request contracts, selection and dismissal/results.
They are not device/pixel acceptance. Android uses actual Compose controls; iOS uses actual SwiftUI/native controls.
Paths in the Source column are under `lib/src/features/`; V4 domain paths are under `src/brigader/` unless qualified.
Earlier checkpoint counts and open-route tables describe their earlier snapshots.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| adminFactoryMap: admin/presentation/admin_factory_map_screen*, machine/attach/read-only order sheets | BrigaderFactoryMap*, brigaderFactoryMapModel, BrigaderFactoryOrderDetail, useBrigaderFactoryDetailReaders | code compared | code compared | Native controls; real WebView GLB renderer. Device WebGL acceptance pending |
| adminCalculateOrders: admin/presentation/admin_calculate_orders_screen*, query/delete/edit/image | BrigaderCalculateOrders*, brigaderCalculateOrdersModel | code compared | code compared | Native list/header/image viewer |
| adminCalculate: admin/presentation/admin_calculate_screen*, full/compact, pickers, combos, confirmation/error | BrigaderCalculateContent, BrigaderCalculateDialogs, brigaderCalculateModel/Draft | code compared | code compared | Native fields/actions, Android 64px fields/60px primary; iOS comfortable native sizing |
| adminProductionMapTest: admin/presentation/admin_production_map_test_screen*, node/formula/group/save | BrigaderProductionMap*, BrigaderProductionCanvas, brigaderProductionMapModel, productionMap* | code compared | code compared | Native node controls over SVG grid/edges; inline ghost appearance follows native input; cursor insertion/submit rules preserved |
| adminItemBulkMove: AppRouter branch and admin/presentation/admin_item_create_screen* | BrigaderItemCreate bulk + real AdminItemCreateScreen | code compared | code compared | Existing native shared screen; source bulk argument retained |
| adminOpeningWip: admin/presentation/admin_production_map_orders_opening_wip.dart, wizard/list/detail/duplicate/delete/print | BrigaderOpeningWip*, brigaderOpeningWipModel, openingWipPrintState | code compared | code compared | Supported real printer transports; GoDEX excluded by D13 |
| adminWipBatches: admin/presentation/admin_wip_batches_screen*, apparatus/stock filters | BrigaderWipBatches*, brigaderWipModel | code compared | code compared | Native filter/card controls |
| adminNotifications: admin/presentation/admin_notifications_screen*, decisions/live | BrigaderNotifications*, brigaderNotificationsModel | code compared | code compared | Native rows/dialogs and genuine foreground/live owner |
| adminApparatusSettings: admin/presentation/admin_apparatus_settings_screen*, edits, queue policies, capacity/schedule/reservation | BrigaderApparatusScreen*, BrigaderApparatusSurfaces, brigaderApparatusController | code compared | code compared | Native fields/pickers/dialogs; per-original-account warm cache |
| adminApparatusGroups: AppRouter branch; same apparatus source, group CRUD | BrigaderApparatusScreen*/controller group branch | code compared | code compared | Native group controls |
| adminRawMaterialSettings: admin/presentation/admin_raw_material_rules_screen* settings wrapper | BrigaderRawSettings*, BrigaderRawRules*, brigaderRawRulesModel | code compared | code compared | Source initial tab and nested default preserved; Android inner tabs 48px |
| adminRawMaterialRules: same source rule/tooling editors and revisions | BrigaderRawSettings*/RawRules*, brigaderRawRulesModel | code compared | code compared | Native selectors/fields; actual material/tooling models |
| adminRawMaterialAssignments: admin/presentation/admin_raw_material_assignment_screen*, candidates/link/unlink/scan/manual | BrigaderRawAssignments*, BrigaderRawScanDialog, existing Material assignment owner | code compared | code compared | Real restricted detection window; native focus-point/auto-zoom limitation below |
| adminCalculateMaterials: admin/presentation/admin_calculate_materials_screen*, variants/edit/delete/reorder | BrigaderCalculateMaterials*, brigaderCalculateMaterialsModel, BrigaderSequenceList | code compared | code compared | Actual native controls and real gesture/autoscroll viewport |
| adminWorkerSettings: admin/presentation/admin_worker_settings_screen*, worker/group/level/deactivate | BrigaderWorkerSettings*, BrigaderWorkerSurfaces, brigaderWorkerSettingsModel | code compared | code compared | Native tabs/forms; source tooltip and original group identity captured across save |
| adminCreateHub: admin/presentation/admin_create_hub_screen* and widgets/admin_create_hub_sheet* | BrigaderCreateHub*, BrigaderPrimaryAction, AdminCreateHubProvider | code compared | code compared | Six page rows, five default Create actions; genuine shared native close owner |
| adminItemCreate: admin/presentation/admin_item_create_screen*, customer/product pickers and creation return | BrigaderItemCreate*, BrigaderCustomerCreateFlow, shared AdminItemCreateScreen | code compared | code compared | Native shared pickers; original customer-only creation args |
| adminItemDetail: admin/presentation/admin_item_detail_screen*, edit/group/customer/delete/actions | BrigaderItemDetail*, BrigaderItemDetailPresentations | code compared | code compared | Real native sheet/dialog removal before original result |
| adminApparatusCreate: AppRouter branch, apparatus source creation form | BrigaderApparatusScreen* creation branch/controller | code compared | code compared | Native form and canonical guarded mutation |
| adminProgressQrScan: admin/presentation/admin_progress_qr*, all report/manual/scan-only/PDF surfaces | BrigaderProgressQr*, brigaderProgressQrModel, admin/adminProgressQrPassport/Pdf | code compared | code compared | Actual Expo camera/native controls; torch hardware availability is device dependent |
| apparatusQueue: AppRouter workerMode branch; admin queue worker source | BrigaderApparatusPages*, WorkerScreen/controllers, BrigaderApparatusPrimary | code compared | code compared | Existing worker native UI; real queue scan callback and default three actions |
| apparatusWorkInstructions: aparatchi/presentation/aparatchi_work_instructions_screen.dart | BrigaderApparatusPages*, WorkerWorkInstructions, useBrigaderApparatusDrawer | code compared | code compared | Real source four-destination drawer and original assignments |
| apparatusDailyWork: aparatchi/presentation/aparatchi_daily_work_screen* | BrigaderApparatusPages*, DailyWorkScreen/controllers | code compared | code compared | Existing date/WIP/native controls; source apparatus drawer/dock |
| apparatusPaddons: aparatchi/presentation/aparatchi_paddons_screen*, all-apparatus/create/delete/transfer | BrigaderPaddons*, brigaderPaddonListModel | code compared | code compared | Actual non-operator Source branch and native dialogs/menu |
| apparatusPaddonDetail: aparatchi/presentation/aparatchi_paddon_detail_screen*, QR/review/discard/select/edit/print | WorkerPaddonDetail, BrigaderPaddonPrimary, BrigaderApparatusDock | code compared | code compared | Controller supplies real actions and enable rules to shared menu; guarded navigation and native header |

### Last source-audit corrections

- Scoped the apparatus warm cache to the original account; added optional original-request guards to actual apparatus option/collection APIs.
- Factory read-only order detail now reads the Source scoped queue snapshot with a 5s timeout and waits before assignment/mold loads.
  It does not issue hidden worker-only bootstrap/WIP/material-requirement requests for a non-worker read-only sheet.
- Source sync errors use a genuine measured bottom overlay inside the detail sheet, sharing the global latest-notice owner,
  5s lifetime and 220ms entrance/reverse motion. No fabricated banner DTO, geometry or native acknowledgement is used.
- Opening WIP local print errors preserve actual printer-status text; unexpected errors use the Source fallback.
  Quantities follow Dart decimal/exponent syntax rather than JavaScript hexadecimal acceptance.
- Formula submit inserts a completion only when Source's actual cursor/token ghost is nonempty.
- Scanner normal/noDuplicates policies follow the actual vendored Android/iOS implementations. Raw scan requires full corner
  containment and normal 250ms delivery; progress scanner retains noDuplicates behavior. Startup uses two real attempts,
  8s start / 4s release timeouts and actual native ready/unmount signals. A cancelled start does not become a camera failure.
- Focused apparatus pages replace the contents of the one real shell drawer. No nested drawer or competing edge gesture was added.
  Queue scan uses the original WorkerScreen callback; the real global paddon action remains available without fabricated assignments.
- Paddon detail preserves its real action, review, selection, scanner, print and back controller while using the genuine shared menu.

### Current verification record

No unit/device/emulator/simulator tests were run in this request, as explicitly requested by the user.
Android and iOS TypeScript passed; focused lint passed with no errors or warnings. `git diff --check` passed.
All 41 direct namespace entries (including profile and the two Home aliases) resolve on both platforms; the 25 requested
source route entries are present. The seven existing private detail compositions retain their original argument registry.

The ordinary role text script did not pass: 33 missing / 325 additional on iOS, 33 missing / 330 additional on Android;
0 ambiguous tags, 611/617 global-only diagnostics. It reaches only 48 V2 strings and two Create surfaces while selecting
915/930 native files. No blanket exceptions or false passing verdicts were added. A separate TypeScript AST audit
found 17 direct visible literal occurrences and 821 static localization/text calls in the 317 changed/new source files;
every one occurs in V2. Dynamic text/flow comparisons are covered by the source surface audit above; AST matches alone
are not a behavior proof. See `docs/port/text/brigader-audit.md`.

### Remaining limitations, distinguished from missing requested routes

All 25 requested route compositions are connected. Device tests belong to the user. Expo Camera does not expose V2's
native focus-point / Android MLKit auto-zoom or a torch-availability query: those hardware details are not simulated
or represented as verified. Existing native controls provide their usual focusing behavior, and Source scan containment,
detection, error/retry, permission and manual-entry rules are implemented. GoDEX remains excluded by project D13.
The pre-existing shared Work Map surface differences are outside these 25 routes and have not been relabeled complete.
The broad text-script diagnostics remain a tooling/audit limitation, not a passing gate.
A development client containing react-native-webview and the existing local native modules is required for physical acceptance.


## Remaining-routes integration — 2026-11-17

Implementation and final audit checkpoint `7b3ecfa4` was fast-forwarded into `main` from `2f69ad22` without conflicts.
All 25 requested route compositions and their actual private child flows are now in the main checkout.
The user's three tracked edits remain unstaged; all 128 pre-existing dirty/untracked files retain their exact SHA-256
contents and modes. Both unstaged and staged Git patches are identical to the pre-merge snapshot.
Backup: parent `.codex-merge-backups/brigader-remaining-routes.9a4u00wu` (manifest, original files and patches).

Post-integration checks in the actual main checkout:

| Check | Actual result |
|---|---|
| Android TypeScript | passed, exit 0 |
| iOS TypeScript | passed, exit 0 |
| Focused Brigader + changed shared UI/API lint | passed, zero errors/warnings |
| Entire changed-source lint | exit 0; only 12 ignored-file warnings for copied Source factory renderer assets |
| git diff --check | passed |
| User work preservation | 128/128 content/mode hashes; original unstaged/staged patches unchanged |
| Native dependencies | react-native-webview 14.0.1 and esbuild 0.28.2 installed from the merged lock; no lock change |
| Visible literal AST inventory | all 17 direct occurrences found in V2 |
| Static localization/text-call inventory | all 821 calls found in V2; dynamic text separately covered by source surface comparison |
| Legacy role text gate | still nonzero: 33 missing on each platform; 325/330 added, 611/617 global-only; zero blanket exceptions |
| Unit/device/emulator/simulator tests | not run; user explicitly owns testing |

No push, reset, rebase, V2 write or modification of the user's files was performed.
The native camera and inherited Work Map limitations above remain explicit; they are not certified as 1:1 physical behavior.
