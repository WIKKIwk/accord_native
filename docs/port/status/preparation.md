# preparation

Status: part 1 of 1 in progress
Stopped at: complete the UI text inventory and classify remaining V2 tests; platform screens and integration remain separate sessions.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| UI text inventory | `docs/port/roles/preparation.md`; preparation presentation sources | Complete the dynamic and nested text/localization-key inventory; the contract now includes 151 extracted static and 36 direct interpolated literal keys plus the main behaviours. |
| Remaining V2 logic tests | `.port/role-preparation-tests.md` | Classify and port the remaining applicable logic cases in the 22-file ledger list. Shared scan-bootstrap contract replays already exist in `tests/workerScanBootstrap.test.cjs`; the rest include admin, worker, inventory and Qolip flows whose reachability must be checked before excluding them. |
| V2 baseline widget failures | `test/preparation_warehouse_management_test.dart:59` | Oracle run: 31 passed, 3 failed; rename and both delete widget cases expected two `M3SegmentFilledSurface` nodes in the bottom sheet but found none. These failing assertions are not used as a spec; determine whether the tests or baseline view are stale. |
| Platform routes and screens | `.port/role-preparation-1.md` Routes and Screens | iOS and Android sessions must implement the four routes and all listed views, sheets and dialogs using the UI contract; this logic session cannot write platform views. |
| Preparation order detail decoder | `mobile_api_preparation_orders.dart` `preparationOrderDetail`, `productionMapSnapshot.ts` | The recorded preparation detail successfully decodes through the shared snapshot parser. Its broader optional-branch parity remains an existing shared open item; integrate those fixes for the read-only sheet. |
| Preparation order live transport | `warehouse_live_client_io.dart` `_connectLive` | Native Dart sends WebSocket protocol pings every 25 seconds. React Native exposes no equivalent here; supply a native transport and verify half-open connection handling. |
| QR label printing | `preparation_production_screen.dart` `_reprintRoll`, `RpsQrReprintSheet` | Platform sessions must supply the device-picker UI to `reprintPreparationRollWithPrinter`; USB, Bluetooth and driver transport adapters are connected but require real-printer checks. |

## V2 test triage

- `preparation_test.dart`, `preparation_material_management_test.dart`, `preparation_warehouse_management_test.dart`, `preparation_formula_variants_test.dart`, `preparation_formula_estimates_test.dart`, `preparation_screw_shares_test.dart`, `preparation_production_journal_test.dart`, `preparation_orders_list_test.dart` and `preparation_orders_warm_store_test.dart`: relevant logic and selected request cases have preparation tests. Widget assertions belong to the platform screens; the three failing baseline warehouse widgets are recorded above.
- `order_scan_bootstrap_api_test.dart` has existing shared replays in `tests/workerScanBootstrap.test.cjs` and related base tests; preparation's real sequence uses the read-only order-detail route, not worker scan actions. `admin_raw_material_api_test.dart` order-scoped assignments are covered by `tests/preparationRawMaterials.test.cjs`; its other queue actions and worker/admin mutations are not preparation actions.
- `preparation_warehouse_layout_test.dart` logic cases exercise admin assignment of warehouses to another user; they are not actions in the preparation role. `admin_warehouses_screen_test_cases_resplit_part_01.dart` includes the reprint preparation already covered by `tests/basePrintApi.test.cjs`; stock administration and correction remain in the admin role.
- `qolip_storage_test.dart`, `aparatchi_paddons_test.dart`, `admin_production_map_worker_completed_wip_test_part.dart` and `admin_training_api_test_cases_resplit_part_01.dart` exercise Qolip, worker, or training/test-mode mutations rather than the preparation read-only order list. `admin_production_map_sequence_reorder_test_part.dart` is not reachable through its read-only sequence.
- `admin_sequence_list_widget_test.dart`, `admin_orders_list_widget_test.dart`, `worker_sequence_positions_test.dart` and `worker_network_latency_test.dart` describe other projections/queue readers. Preparation's specialized list uses server-provided positions and its own scoped cache; shared decoder parity remains open above.
- `inventory_movements_test.dart` covers the shared inventory route reachable from preparation, including deferred test-mode mutations; the integrator must audit that shared implementation. The reachability of the remaining `admin_production_map_material_delivery_test_part.dart`, `admin_production_map_worker_activity_test_part.dart`, `admin_production_map_worker_material_width_notice_test_part.dart`, `admin_production_map_worker_queue_ordering_test_part.dart` and `admin_zero_output_waste_test.dart` detail assertions remains open until the borrowed detail sheet is integrated. `admin_production_map_test_screen_test_cases_resplit_part_14.dart` covers deferred test-mode filtering.

## Deviations candidates

- `preparation_production_screen.dart` `_showRoll`: `RpsQrReprintSheet` receives both `details` and `detailsContent`; the sheet renders the recipe content and does not render the supplied roll details. Preserve until the user requests a separate change.
- `preparation_screen.dart` pending retry invokes `preparationSubmit` for the stored kind, while that method accepts only `materials`, `receipts` and `consumptions`; pending reversal or GScale commands cannot be retried from that home action.

## Test mode pending

- Material mutations and preparation stock commands reject test mode; the preparation order live stream closes and the warm store is disabled in test mode. Implement in the shared test-mode pass.

Ledger `check` reports `/v1/mobile/preparation` because `preparationFormulaApi.ts` stores the prefix separately; V2 builds these same formula endpoints dynamically in `mobile_api_preparation.dart`. The other endpoint warnings belong to other sessions. The checker cannot resolve the nullable extension `_lineError`, documented at its V4 definition without an `@v2` tag.

No V2 HTTP recordings were found for warehouse creation or deletion; source-derived request tests cover both. `admin_raw_material_api_test.dart` uses `HttpOverrides`, which the MockClient recorder cannot capture; `tests/preparationRawMaterials.test.cjs` replays its relevant order-only request and assertion from source.

## Needs from the integrator

- Audit/connect the shared inventory-movements route and its existing base stores for preparation access; its UI and shared logic are outside this role’s file fence.
- Connect the four native routes once platform views exist; connect the borrowed read-only admin order detail sheet. The preparation home targets are configured, but those platform routes do not exist in this branch yet.

## Verification

- The ledger estimates 112k V2 tokens for this role; actual tokens read were not measured. The ledger API list moved from 5/26 previously tagged to 26/26 tagged, with additional preparation order and formula methods implemented.
- `node --test tests/*.test.cjs`: 813 passed, 0 failed. There were 3 existing preparation read tests at the start; preparation-specific tests now span 22 files, plus existing shared tests.
- iOS TypeScript: passed. Android TypeScript: the 10 known baseline errors in `WorkerOutputProgress.android.tsx`, `WorkerPaintPalette.android.tsx`, and `WorkerScreen.tsx`; no preparation errors. Expo lint: passed.
- Ledger `check`: passed with six endpoint warnings; the preparation prefix is dynamic as explained above, the other five belong to other roles. `role preparation 1`: all 26 API entries are tagged; platform routes/screens remain unchecked.
- V2 oracle: 31 passed and 3 warehouse widget tests failed at the baseline as detailed above; the order-scoped raw-material test passed separately. No simulator or device was used.

## Checkpoints

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
