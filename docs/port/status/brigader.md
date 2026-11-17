# Brigader

Status: partial — native workspace and the available shared flows are implemented; full Brigader parity is not complete.
Stopped at: the native Users/detail/creation/warehouse/chat connections are now composed. The 25 remaining shared Admin source routes listed below still need their actual feature implementations; full Brigader parity is not complete.
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

## Open items

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

## Surface audit

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

## Route coverage

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

### Remaining software routes (25 of 47)

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
