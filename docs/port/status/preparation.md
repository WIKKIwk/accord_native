# preparation

Status: part 1 of 1, parity audit in progress
Stopped at: complete the remaining V2 text and surface comparisons on both platforms, reconcile optional order-detail controls, and verify printers and native WebSocket pings.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Role-wide surface and text audit | `.port/role-preparation.md`, `.port/text-preparation.md` | The text gate reports missing or extra strings on both platforms. Compare the remaining screens, sheets, messages and back guards with V2; the ledger tags alone do not establish parity. |
| Material management on iOS and Android | `preparation_materials_screen.dart`, `_PreparationInputDialog` | Material actions, confirmation, warehouse selection and feedback were aligned with the V2 source; verify native dismissal, input and notice behavior on both phones. |
| Warehouse management on iOS and Android | `preparation_screen_forms.dart`, `preparation_warehouse_management.dart` | Creation, parent defaults, managed warehouse actions, receipt picker, input validation and feedback were compared with V2. Verify filter long-press, dropdown, picker paging, dismissal and mutation feedback on both phones; the FAB requires further comparison. |
| Material detail on iOS and Android | `preparation_screen_forms.dart` `PreparationMaterialDetailScreen` | Warehouse-scoped receipt and consumption rows, material code, actions and fixed warehouse navigation were compared. Verify the scale return and native presentation on phones. |
| Preparation home on iOS and Android | `preparation_screen.dart`, `_pick` | Home cards, pending labels, action order, receipt picker and feedback were compared with V2. The current action menus still differ from V2's floating action menu, and picker/dialog transitions need phone verification. |
| Formula sets and catalog on iOS and Android | `preparation_formula_orders_screen.dart`, `preparation_formula_catalog_screen.dart` | List text, set-detail rows, shared warning and rename/delete/share actions were compared. Verify long-press, sheet and dialog transitions on phones. |
| Production journal on iOS and Android | `preparation_production_screen.dart`, `preparation_production_models.dart` | Order, batch and roll rows, filters, paging placement, captured recipe text and malformed nested responses were compared. Verify timer, focus, native interaction and roll reprinting on phones. |
| Preparation history on iOS and Android | `preparation_screen_forms.dart` `PreparationHistoryScreen` | Receipt, reversal and consumption rows and the reversal flow were compared with V2. Verify long-press, sheet/dialog dismissal and notices on both phones. |
| Formula variants on iOS and Android | `preparation_formula_variants_screen.dart` | Variant edit now requests the formula editor, deletion uses V2's confirmation, and creation/rename use a dialog. Verify gestures, modal transitions, reuse picker and navigation on both phones. The FAB and remaining screen details still need a complete surface comparison. |
| Formula shares on iOS and Android | `preparation_formula_shares_sheet.dart` | Values, text, error mapping and the save/dismiss guards were compared with V2. Verify native keyboard, swipe, back and outside-tap behavior during a save on both phones. |
| Formula editor on iOS and Android | `preparation_order_formula_screen.dart` | Headings, estimates, formula rows, totals, save/delete feedback and the searchable seriyo bottom sheet were aligned. Verify the picker's native paging, search ranking and dismissal on phones; the FAB and remaining navigation need comparison. |
| Platform routes and screens | `.port/role-preparation-1.md` Routes and Screens | iOS and Android preparation routes, sequence, inventory and the GScale destination exist; remaining parity gaps are in `preparation-ios.md`, `preparation-android.md` and `gscale.md`. |
| Preparation order detail decoder and sheet | `mobile_api_preparation_orders.dart` `preparationOrderDetail`, `admin_production_map_orders_preparation_list.dart` `_showDetail`, `productionMapSnapshot.ts` | The recorded preparation detail decodes through the shared snapshot parser, but optional queue-control parity is not complete. |
| Preparation order live transport | `warehouse_live_client_io.dart` `_connectLive` | Native Dart sends WebSocket protocol pings every 25 seconds. React Native exposes no equivalent here; supply a native transport and verify half-open connection handling. |
| QR label printing | `preparation_production_screen.dart` `_reprintRoll`, `RpsQrReprintSheet` | Both platforms offer Bluetooth, discovered and manual Wi-Fi with the V2 probe; Android also offers USB (Zebra only, D13). Discovery and printing need a native build and real-printer checks. |

## V2 test triage

- `preparation_test.dart`, `preparation_material_management_test.dart`, `preparation_warehouse_management_test.dart`, `preparation_formula_variants_test.dart`, `preparation_formula_estimates_test.dart`, `preparation_screw_shares_test.dart`, `preparation_production_journal_test.dart`, `preparation_orders_list_test.dart` and `preparation_orders_warm_store_test.dart`: relevant logic and selected request cases have preparation tests. Widget assertions belong to the platform screens; the three failing baseline warehouse widgets are explained below.
- `order_scan_bootstrap_api_test.dart` has existing shared replays in `tests/workerScanBootstrap.test.cjs` and related base tests; preparation's real sequence uses the read-only order-detail route, not worker scan actions. `admin_raw_material_api_test.dart` order-scoped assignments are covered by `tests/preparationRawMaterials.test.cjs`; its other queue actions and worker/admin mutations are not preparation actions.
- `preparation_warehouse_layout_test.dart` logic cases exercise admin assignment of warehouses to another user; they are not actions in the preparation role. `admin_warehouses_screen_test_cases_resplit_part_01.dart` includes the reprint preparation already covered by `tests/basePrintApi.test.cjs`; stock administration and correction remain in the admin role.
- `qolip_storage_test.dart`, `aparatchi_paddons_test.dart`, `admin_production_map_worker_completed_wip_test_part.dart` and `admin_training_api_test_cases_resplit_part_01.dart` exercise Qolip, worker, or training/test-mode mutations rather than the preparation read-only order list. `admin_production_map_sequence_reorder_test_part.dart` is not reachable through its read-only sequence.
- `admin_sequence_list_widget_test.dart`, `admin_orders_list_widget_test.dart`, `worker_sequence_positions_test.dart` and `worker_network_latency_test.dart` describe other projections/queue readers. Preparation's specialized list uses server-provided positions and its own scoped cache; shared decoder parity remains open above.
- `inventory_movements_test.dart` runs all six logic cases in test mode with a material-worker account; test-mode state and its transitions are deferred by D3. Preparation's real transfer request and validation are source-tested in `tests/preparationInventoryTransfers.test.cjs`; shared inventory reads and live windows have base tests. Native inventory widgets remain platform work.
- `admin_production_map_worker_activity_test_part.dart`, `admin_production_map_worker_material_width_notice_test_part.dart`, and `admin_production_map_worker_queue_ordering_test_part.dart` exercise worker activity, worker start/scan, and worker queue ordering. Preparation invokes the borrowed detail sheet without an apparatus, `workerMode` or `canManageQueue`; those worker actions are not available. Its snapshot still passes queue controls to the shared detail and their optional decoder parity remains open above. `admin_production_map_material_delivery_test_part.dart` tests a shared event model plus worker intake; the latter is not a preparation action, while any displayed shared history belongs with the borrowed detail. `admin_zero_output_waste_test.dart` tests the admin closed-log sheet, which this preparation entry does not open. `admin_production_map_test_screen_test_cases_resplit_part_14.dart` covers deferred test-mode filtering.
- The three failing baseline `preparation_warehouse_management_test.dart` cases use `find.byType(BottomSheet)` in `openActions`; V2's `showSpringBottomSheet` pushes `SpringSheetRoute`, not Flutter's `BottomSheet`. The action sheet itself contains the two expected `M3SegmentFilledSurface` nodes. The stale ancestry assertion is not a behavioural spec; existing action tests remain unchanged.

## Deviations candidates

- `preparation_production_screen.dart` `_showRoll`: `RpsQrReprintSheet` receives both `details` and `detailsContent`; the sheet renders the recipe content and does not render the supplied roll details. Preserve until the user requests a separate change.
- `preparation_screen.dart` pending retry invokes `preparationSubmit` for the stored kind, while that method accepts only `materials`, `receipts` and `consumptions`; pending reversal or GScale commands cannot be retried from that home action.

## Test mode pending

- Material mutations and preparation stock commands reject test mode; the preparation order live stream closes and the warm store is disabled in test mode. Inventory test-mode transfer and relocation transitions are also deferred. Implement in the shared test-mode pass.

Ledger `check` reports `/v1/mobile/preparation` because `preparationFormulaApi.ts` stores the prefix separately; V2 builds these same formula endpoints dynamically in `mobile_api_preparation.dart`. It also reports `/v1/mobile/admin/inventory/transfers/{}/{}` because V2 builds the action URL from adjacent string fragments and interpolated encoded ID and action in `mobile_api_inventory_movements_MobileApiInventoryMovements_methods_03.dart`. The other five endpoint warnings belong to other sessions. The checker cannot resolve the nullable extension `_lineError`, documented at its V4 definition without an `@v2` tag.

No V2 HTTP recordings were found for warehouse creation/deletion or inventory transfer mutations; source-derived request tests cover these. `admin_raw_material_api_test.dart` uses `HttpOverrides`, which the MockClient recorder cannot capture; `tests/preparationRawMaterials.test.cjs` replays its relevant order-only request and assertion from source.

Post-baseline drift removes unused legacy home recipe helpers from `preparation_screen.dart` and `preparation_screen_forms.dart`; no active call site in those files invokes `_pickOrder`, `_addRecipeMaterial` or `_saveRecipe`. The committed baseline is still the specification; baseline movement remains the integrator's decision.

## Needs from the integrator

- Both platforms now connect inventory, sequence and scoped order detail. Optional queue-control decoder parity remains open above. The candidate-order and assignment requests have source-derived tests; V2 did not record them in this role's fixtures.

## Verification

- History checkpoint: 7 focused history/material/logic tests passed. Native history gestures and dialog transitions have not been run on a device.
- Material checkpoint: 3 focused tests passed, iOS TypeScript passed and Expo lint passed. Android TypeScript still reports the 10 existing worker errors listed in `PORT.md`; none is in the preparation files.
- Preparation iOS wiring: 854 tests passed; iOS and default TypeScript checks and Expo lint passed. Android retains the 10 known baseline TypeScript errors. Real device and printer checks remain open.
- The ledger estimates 112k V2 tokens for this role; actual tokens read were not measured. The prior logic session tagged 26/26 listed APIs; this wiring turn additionally implemented the two inventory transfer mutation methods and added preparation-scoped access to the existing inventory store.
- `node --test tests/*.test.cjs`: 826 passed, 0 failed, up from 813 before wiring. The 13 added tests cover search, apparatus preferences, startup, targets, printer adapters and inventory transfer/access. An existing variant test loader gained mocks for the new dependencies; no existing assertion was changed.
- iOS TypeScript: passed. Android TypeScript: the 10 known baseline errors in `WorkerOutputProgress.android.tsx`, `WorkerPaintPalette.android.tsx`, and `WorkerScreen.tsx`; no preparation errors. Expo lint: passed.
- Ledger `check`: passed with seven endpoint warnings; the two preparation-related dynamic paths are explained above, the other five belong to other roles. `role preparation 1`: all 26 API entries are tagged; platform routes/screens remain unchecked.
- V2 oracle: 31 passed and 3 warehouse widget tests failed at the baseline as detailed above; the order-scoped raw-material test passed separately. No simulator or device was used.

## Checkpoints

- This session: aligned production journal rows, filters, pagination and nested model errors on both platforms.
- This session: aligned warehouse-scoped material detail and receipt/consumption rows on both platforms.
- This session: aligned formula-set detail rows and shared formula actions on both platforms.
- This session: aligned formula-set and catalog list text and rename actions on both platforms.
- This session: aligned home actions, pending labels, receipt picking and command feedback on both platforms.
- This session: aligned warehouse receipt picking, quantity input and command feedback on both platforms.
- This session: aligned warehouse creation, managed warehouse actions and feedback on both platforms.
- This session: replaced the seriyo menu/dialog with searchable, paged bottom sheets on both platforms.
- This session: aligned formula headings, estimates, editor fields, share entry and save/delete feedback on both platforms.
- This session: aligned the formula-share sheet and separated it from formula details on both platforms.
- This session: aligned variant action sheets, edit entry, naming, list text and deletion feedback on both platforms.
- This session: aligned history rows, long-press actions and receipt reversal on both platforms.
- This session: aligned material action and warehouse-assignment flows on both platforms, including scoped mutation completion and V2 confirmation text.
- `f191451` port(preparation/1): record contracts, 0 methods
- `9a4ff48` port(preparation/1): formula models and precision, 0 methods
- `051788d` port(preparation/1): formula API, 14 methods
- `d2b92f5` port(preparation/1): material and warehouse API, 7 methods
- `6fa98c1` port(preparation/1): persistent stock commands, 4 methods
- `75cb619` port(preparation/1): production journal, 3 methods
- `3159792` port(preparation/1): preparation screen rules, 0 methods
- `e5331ed` port(preparation/1): production journal state, 0 methods
- `2de4266` port(preparation/1): preparation home state, 0 methods
- `ce6485f` port(preparation/1): formula editor state, 0 methods
- `3b91e62` port(preparation/1): reprint coordination, 0 methods
- `8120208` port(preparation/1): warehouse history rules, 0 methods
- `eb5f2f0` port(preparation/1): scoped order list, 2 methods
- `929397e` port(preparation/1): order live stream, 1 method
- `25d38a0` port(preparation/1): order warm store, 0 methods
- `33079c9` port(preparation/1): order list coordination, 0 methods
- `bf0cf3c` port(preparation/1): material list state, 0 methods
- `39b78c5` port(preparation/1): production journal adapters, 0 methods
- `c2fd94d` port(preparation/1): draft UI contract, 0 methods
- `28cee49` port(preparation/1): formula library state, 0 methods
- `23ea4f3` port(preparation/1): variant screen state, 0 methods
- `ba192c9` port(preparation/1): formula set detail state, 0 methods
- `90000dc` port(preparation/1): route and estimate cases, 0 methods
- `e078575` port(preparation/1): material authorization and UI texts, 0 methods
- `26c2535` port(preparation/1): scoped assignment test, 0 methods
- `7ffb62b` port(preparation/1): exact query encoding, 0 methods
- `31b5fe3` port(preparation/1): detail decoder and test triage, 0 methods
- `7f6dc2c` port(preparation/1): record verification, 0 methods
- `137e1b9` port(preparation/1): formula refresh recovery, 0 methods
- `ca6ad4a` port(preparation/wire): formula reuse search, 2 methods
- `356a5b7` port(preparation/wire): apparatus selection, 4 methods
- `bf7eedc` port(preparation/wire): warm runtime and home targets, 0 methods
- `7cfa238` port(preparation/wire): printer transports, 3 methods
- `aa9a856` port(preparation/wire): inventory access and transfers, 2 methods
- `add7709` port(preparation/wire): text inventory and test triage, 0 methods

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `PreparationMaterialsScreen`, `preparation_materials_screen.dart` | `PreparationMaterials.ios.tsx`, `PreparationMaterials.android.tsx` | qisman | qisman | Action and assignment flows were compared with V2. The separate trailing action icon and native gesture/dismissal behavior still need comparison on a device. |
| `PreparationWarehouseScreen`, `_warehouseActions` | `PreparationWarehouse.ios.tsx`, `PreparationStock.android.tsx` | qisman | qisman | Creation, managed actions, receipt picker and feedback were compared. The FAB and native interactions still need verification. |
| `PreparationMaterialDetailScreen` | `PreparationWarehouse.ios.tsx`, `PreparationStock.android.tsx` | qisman | qisman | Warehouse-scoped summary, receipt/consumption rows and actions were compared. Scale return and native presentation need verification. |
| `PreparationScreen`, `_pick` | `PreparationHome.ios.tsx`, `PreparationHome.android.tsx` | qisman | qisman | Home action contents, pending labels, receipt picker and feedback were compared. The floating menu and native interaction remain open. |
| `PreparationFormulaOrdersScreen`, `PreparationFormulaCatalogScreen`, `_PreparationFormulaSetDetails` | `PreparationLibrary.ios.tsx`, `PreparationFormulaLibrary.android.tsx` | qisman | qisman | List and detail rows, rename, share and deletion were compared. Native interactions remain unverified. |
| `PreparationProductionScreen`, `PreparationProductionOrderScreen`, `PreparationProductionBatchScreen` | `PreparationProductionScreens.ios.tsx`, `PreparationProduction.android.tsx` | qisman | qisman | Filters, rows, recipe and paging were compared. Native lifecycle and printer checks remain open. |
| `PreparationHistoryScreen`, `preparation_screen_forms.dart` | `PreparationHistory.ios.tsx`, `PreparationStock.android.tsx` | qisman | qisman | Row content and reversal steps were compared with V2. Native long-press, dialog transitions and notice presentation still need device verification. |
| `PreparationFormulaVariantsScreen`, `_VariantNameDialog` | `PreparationVariants.ios.tsx`, `PreparationVariants.android.tsx` | qisman | qisman | Action ordering, edit, naming and delete were compared. The FAB, reuse-picker details and native interaction still need the complete comparison. |
| `_FormulaSharesSheet`, `preparation_formula_shares_sheet.dart` | `PreparationSharesDialog.ios.tsx`, `PreparationFormulaEditor.android.tsx` | qisman | qisman | Labels, totals and save rules were compared. Native dismissal and keyboard behavior remain unverified. |
| `PreparationOrderFormulaScreen`, `preparation_order_formula_screen.dart` | `PreparationFormula.ios.tsx`, `PreparationFormulaEditor.android.tsx` | qisman | qisman | Formula content, save/delete feedback and the seriyo picker were compared; picker interaction, FAB and remaining navigation still need parity work. |
