# base

Status: parts 1 and 2 in progress
Stopped at: compare the remaining generated base readings and V2 test cases, resolve the listed integration gaps, and rerun both part gates.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader and sync | `PushMessagingService.unregisterCurrentToken`, `syncCurrentToken`, `FirebaseClientBootstrap` | The rest of logout is ported. Initialize native Firebase Messaging and register an FCM token reader after the user supplies Firebase configuration; connect push sync after account switches. |
| Base reading and tests | `.port/role-base-1.md`, `.port/role-base-2.md`, `.port/role-base-tests.md` | Finish comparison of the untagged declarations and unreplayed contract/logic cases. The role generator includes worker, inventory, preparation and qolip dependencies; compare already-existing implementations rather than copying them. Widget-only assertions belong to the platform contracts. |
| Platform screens and routes | `.port/role-base-1.md`, `.port/role-base-2.md` | Login, profile, PIN setup, welcome, account-switcher and update views/routes remain unchecked on iOS and Android. Their reviewed behavior and text keys are in `docs/port/roles/base.md`. |
| Localization | `core/localization/`, `UrduAwareText` | The generated four-locale catalog covers 408 getters, 24 direct parameterized methods, conditional/derived methods, production/admin maps and recognized switch translations. Urdu literal and template lookup is also ported. Verify remaining extension coverage and connect locale state and RTL to platform views, which still contain hard-coded Uzbek. |
| Theme integration | `ThemeController` | Base entry, login and profile hosts apply the persisted mode and variant. Role-owned hosts still need to adopt the shared palette in their own sessions. |
| Dispatch state integration | `CustomerDeliveryRuntimeStore`, `SupplierRuntimeStore`, `WerkaRuntimeStore` | The transient summary/list stores and session reset are ported; connect the customer, supplier and Werka screens and their API models in the respective role sessions. |
| Qolip catalog integration | `QolipCatalogStore` | Connect role-owned screens and mutation responses to the shared session-scoped catalog runtime. Test-mode catalog rebuilding is deferred per D3. |
| Production snapshots | `ProductionSnapshotStore`, `FileProductionSnapshotBackend`, `WebProductionSnapshotBackend` | Bounded snapshot logic and native/web backends are ported, with startup reset registration. Connect role-owned consumers and verify storage and crash recovery on devices; Expo's write API does not expose V2's explicit file flush. |
| Production revisions | `ProductionDataRevision` | Connect accepted production live revisions and detail readers to the shared notifier in the worker and admin role sessions. |
| Worker queue warming | `WorkerQueueWarmStore`, `src/workerLive.ts`, `src/WorkerScreen.tsx` | The existing worker page owns its socket and baseline. Its warm handoff, reconnect and repair-budget behavior must be compared and integrated in the worker-owned files; do not introduce a second live subscription. |
| Application updates | `AppUpdateService`, `NativeAppUpdatePlatform`, `AppUpdateCoordinator`, `AppUpdateRuntime` | Settings now open the shared manual check and presenter when native application metadata is available. The Expo Application module and Android installer/download/file adapters remain to be integrated; automatic checking waits for those adapters. |
| Account switching | `createRuntimeAccountSwitchController`, `SecurityController` | Connect security unlock, the shared profile-switch PIN store and platform account-switcher views to the runtime controller. |
| Transport | `MobileApi._get`, `_post`, `_put`, `_delete`, `_patch`, `resilientApiRead`, `SecureMobileApiClient` | Connect the shared resilient GET helper at V2's opt-in call sites. Full-response deadlines, manual redirects and cross-origin header stripping have mocked tests; verify native behavior on both platforms. |
| Inventory live transport | `warehouse_live_client_io.dart`, `InventoryViewStore` | JS WebSocket does not expose V2’s 25-second protocol ping; verify native keepalive on both platforms. Platform entry points must configure foreground/background lifecycle. |
| Security lifecycle | `SecurityController`, `src/appLock.ts`, `WorkerSecurity` | Compare and connect the V2 privacy shield, resume lock and biometric flows; V4 currently uses different storage and UI components. |
| Native device behavior | `secure_account_storage`, `uploadAvatar`, `app_update` | Saved-account secure storage and avatar multipart upload have mock/source-derived tests but need native runtime verification; update installation needs a native bridge. |

## Deviations candidates

## Test mode pending

| V4 function | V2 symbol |
|---|---|
| `adminPrepareRawMaterialStockReprint`, `adminConfirmRawMaterialStockReprint` | Their in-memory stock matching, lock checks and confirmation branches. |
| `qolipPrintCodeQr` | Its in-memory qolip lookup and print job branch. |
| `gscaleItemsPage`, `adminWarehouseAssignments` | Their in-memory catalog and warehouse-assignment branches. |

## Test coverage notes

V2 has no recorded HTTP tests for `notificationDetail`, `addNotificationComment`, `supplierRespondUnannounced`, `adminConfirmRawMaterialStockReprint`, `qolipPrintCodeQr`, `gscaleItemsPage`, `adminWarehouseAssignments`, `updateNickname`, or `uploadAvatar`. Focused V4 tests assert their requests and source-derived parsing. `adminPrepareRawMaterialStockReprint` replays the V2 `qolip_tasks_test.dart` recording. Base tests also cover routing, saved-account switching, PIN, refresh, inventory windows, update models and transport.

The theme controller tests are source-derived; V2 has no direct tests for its persistence or listener behavior.

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/workerControlsApi.ts` | `MobileApiException` | Reconcile the existing worker exception with `src/shared/mobileApiException.ts`, including V2 diagnostic fields and message formatting. |
| `src/workerRawMaterials.ts` | `resilientApiRead` | Route the V2 opt-in raw-material GETs through the shared retry helper, retaining their session guards. |
| `src/workerQueueLimit.ts` | `WorkerQueueLimitStore` | Compare the existing queue limit store's storage/account identity with V2 and tag the matching rules; this file belongs to the worker role. |
| Other role-owned streamed uploads | `_sendMultipartAuthorized`, `_sendStreamedAuthorized` | Opt the remaining role-owned streamed/multipart calls out of the shared request timer where V2 has no per-request deadline. Profile avatar upload now uses the shared untimed multipart request. |
| `src/app/ios-worker/_layout.tsx` | `SecurityController.clearForLogout` | Clear the separate shared profile-switch PIN along with the app-lock PIN during iOS logout. |
| `src/app/android-worker/` | `AppSession.homeRoute` | Add the Android worker Expo Router route. Until then the existing Android worker screen renders at the root; base cannot create route files outside its scope. |

## Session verification and handoff

- Role `base`, parts 1 and 2 remain in progress. The role generator estimates reading lists of 178k and 48k tokens, with about 133k and 47k still untagged; these are estimates, not a measurement of tokens actually read. Regenerate with `port_ledger.mjs role base 1` and `role base 2` for the declaration-level lists.
- The generated public API checklist changed from 29/32 tagged to 31/32. Of nine initially open shared APIs, eight were ported; the remaining `logout` item is the Firebase token reader listed above. A tag identifies a V2 file or symbol; it does not prove all cases in that file were reviewed.
- There were no `tests/base*.test.cjs` files at the starting commit; there are now 30. The full suite contains 710 passing tests. The previous total was not measured. All 20 generated contract fixtures already existed at the recorded baseline; not every test case has been compared or replayed.
- Gates: full Node tests, iOS TypeScript, default TypeScript, Expo lint, ledger check, and both role-ledger commands passed. Android TypeScript reports the 10 pre-existing errors documented in `docs/port/PORT.md` in `WorkerOutputProgress.android.tsx`, `WorkerPaintPalette.android.tsx`, and `WorkerScreen.tsx`; no other Android errors were reported. The ledger still warns about the five endpoints already documented in `PORT.md`.
- No simulator or physical device was used. Firebase push, native update installation and both platforms' transport/lifecycle behavior still need device verification.

### Generated contract and logic tests still needing case-by-case comparison

The generator includes dependencies owned by other roles; confirm their reachability and existing coverage before changing them. Test-mode branches are deferred per D3. Widget-only assertions belong to platform sessions.

- [ ] test/worker_list_api_test.dart (14 logic, 0 widget, 5733 tok)
- [ ] test/worker_queue_window_api_test.dart (4 logic, 0 widget, 1621 tok)
- [ ] test/order_scan_bootstrap_api_test.dart (21 logic, 1 widget, 6664 tok)
- [ ] test/preparation_formula_catalog_test.dart (0 logic, 5 widget, 3557 tok)
- [ ] test/preparation_formula_estimates_test.dart (1 logic, 2 widget, 1335 tok)
- [ ] test/preparation_formula_orders_test.dart (0 logic, 9 widget, 7360 tok)
- [ ] test/preparation_formula_reuse_test.dart (0 logic, 4 widget, 2316 tok)
- [ ] test/preparation_formula_start_test.dart (0 logic, 3 widget, 1775 tok)
- [ ] test/preparation_formula_variant_actions_test.dart (0 logic, 6 widget, 2463 tok)
- [ ] test/preparation_formula_variants_test.dart (1 logic, 3 widget, 2632 tok)
- [ ] test/preparation_screw_shares_test.dart (1 logic, 2 widget, 2696 tok)
- [ ] test/production_persistent_snapshot_api_test.dart (4 logic, 0 widget, 1102 tok)
- [ ] test/qolip_catalog_test.dart (1 logic, 7 widget, 4812 tok)
- [ ] test/qolip_product_transfer_test.dart (2 logic, 3 widget, 4252 tok)
- [ ] test/qolip_products_cache_test.dart (9 logic, 1 widget, 2681 tok)
- [ ] test/worker_network_latency_test.dart (5 logic, 1 widget, 2416 tok)
- [ ] test/worker_paddon_apparatus_tabs_test.dart (0 logic, 1 widget, 2094 tok)
- [ ] test/admin_raw_material_api_test.dart (48 logic, 0 widget, 28445 tok)
- [ ] test/admin_canonical_apparatus_contract_test.dart (20 logic, 0 widget, 4138 tok)
- [ ] test/admin_production_map_paged_socket_test.dart (13 logic, 0 widget, 3464 tok)
- [ ] test/test_mode_demo_data_test.dart (9 logic, 0 widget, 1211 tok)
- [ ] test/admin_apparatus_master_data_test_cases_resplit_part_01.dart (7 logic, 3 widget, 3395 tok)
- [ ] test/admin_production_map_p0_stress_test_cases_resplit_part_01.dart (7 logic, 1 widget, 3173 tok)
- [ ] test/inventory_movements_test.dart (6 logic, 13 widget, 11591 tok)
- [ ] test/qolip_cell_qr_flow_test.dart (6 logic, 1 widget, 4567 tok)
- [ ] test/qolip_products_selection_test.dart (6 logic, 4 widget, 4510 tok)
- [ ] test/admin_production_map_queue_snapshot_test_cases_resplit_part_02.dart (5 logic, 0 widget, 4581 tok)
- [ ] test/admin_production_map_test_screen_test_cases_resplit_part_01.dart (5 logic, 0 widget, 3066 tok)
- [ ] test/admin_raw_material_rules_screen_test_cases_resplit_part_01.dart (5 logic, 4 widget, 3424 tok)
- [ ] test/admin_training_api_test_cases_resplit_part_01.dart (4 logic, 0 widget, 2426 tok)
- [ ] test/mobile_api_auth_profile_test.dart (4 logic, 0 widget, 3211 tok)
- [ ] test/qolip_alternative_sets_test.dart (4 logic, 1 widget, 1737 tok)
- [ ] test/worker_sequence_positions_test.dart (3 logic, 4 widget, 4175 tok)
- [ ] test/admin_production_map_sequence_reorder_test_part.dart (2 logic, 1 widget, 3263 tok)
- [ ] test/admin_training_api_test_cases_resplit_part_02.dart (2 logic, 0 widget, 2883 tok)
- [ ] test/admin_production_map_material_delivery_test_part.dart (1 logic, 2 widget, 4070 tok)
- [ ] test/admin_production_map_print_method_tests.dart (1 logic, 2 widget, 1640 tok)
- [ ] test/admin_production_map_test_screen_test_cases_resplit_part_14.dart (1 logic, 2 widget, 2301 tok)
- [ ] test/admin_production_map_worker_activity_test_part.dart (1 logic, 2 widget, 4997 tok)
- [ ] test/admin_production_map_worker_queue_ordering_test_part.dart (1 logic, 2 widget, 5810 tok)
- [ ] test/qolip_legacy_location_test.dart (1 logic, 0 widget, 455 tok)

### Checkpoint commits

```
9593e4b port(base/1): role routing, 2 methods
aeac61a port(base/1): shared notifications, 3 methods
da93fc7 port(base/1): shared print preparation, 3 methods
e7279b9 port(base/1): shared catalog and warehouses, 2 methods
a6547df port(base/1): profile mutations, 2 methods
d507f59 port(base/2): entry bootstrap and login rules, 2 methods
b422ef5 port(base/1): saved account switching, 1 method
eab800e port(base/1): account switching runtime, 1 method
4414fcb port(base/1): profile switch PIN, 3 methods
9cddf1a port(base/1): update manifest models, 5 methods
05a7292 port(base/1): authorized transport and refresh, 2 methods
fbfbbd2 port(base/1): resilient API reads, 1 method
e7233b7 port(base/1): inventory view queries, 1 method
3a0182a port(base/1): shared inventory windows, 2 methods
06f6ec6 port(base/1): clarify catalog endpoint literals
6d5fdb1 port(base/2): document base UI contract
82c5dae port(base/1): generate localization catalog
beb5259 port(base/1): shared API errors, 1 method
3ebac50 port(base/1): Urdu UI text, 1 method
86c337c port(base/1): notification state stores, 3 methods
ee231f6 port(base/1): reset state on access role changes
873585b port(base/1): update service, 3 methods
e152005 port(base/1): authorized redirect policy, 1 method
5b84b4a port(base/1): update coordinator, 1 method
e5eb4b1 port(base/1): normalize paddon route URIs
9aa13cb port(base/1): update release watcher, 2 methods
3b4540e port(base/1): refresh changed account identity, 1 method
778415d port(base/1): buffer responses within timeout, 1 method
56ca0c7 port(base/1): theme preferences, 1 method
3a24c9d port(base/2): login failure messages, 1 method
8ece529 port(base/1): load base preferences at startup, 1 method
83fdba4 port(base/1): dispatch runtime stores, 3 methods
fd8163a port(base/1): avoid redundant credential writes, 1 method
dee1e5d port(base/1): scope update checks to server, 1 method
bc22aa3 port(base/1): shared qolip catalog store, 2 methods
7e7a925 port(base/1): production snapshot cache, 2 methods
7f8e839 port(base/1): production revision notifier, 1 method
ae8ea11 port(base/1): conditional localization methods, 14 methods
45fe9f6 port(base/1): web snapshot backend, 1 method
```
