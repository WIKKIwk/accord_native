# preparation

Status: part 1 of 1 in progress
Stopped at: complete the UI text inventory and classify remaining V2 tests; platform screens and integration remain separate sessions.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Formula reuse search | `search_normalizer.dart` `searchMatches`, `preparation_formula_variants_screen.dart` `_reuse` | Port/reuse the shared transliteration and fuzzy search matcher for the catalog picker. |
| UI text inventory | `docs/port/roles/preparation.md`; preparation presentation sources | Complete a per-screen inventory of every literal/dynamic text and its localization key; the current contract lists principal texts and behaviour. |
| Remaining V2 logic tests | `.port/role-preparation-tests.md` | Classify and port the remaining applicable logic/contract cases. The ledger includes shared admin/worker test files; verify reachability before excluding any. `order_scan_bootstrap_api_test.dart` has not been replayed. |
| Platform routes and screens | `.port/role-preparation-1.md` Routes and Screens | iOS and Android sessions must implement the four routes and all listed views, sheets and dialogs using the UI contract; this logic session cannot write platform views. |
| Preparation order detail decoder | `mobile_api_preparation_orders.dart` `preparationOrderDetail`, `productionMapSnapshot.ts` | The shared snapshot decoder has existing open parity work; integrate its fixes for the read-only preparation order sheet. |
| Preparation order live transport | `warehouse_live_client_io.dart` `_connectLive` | Native Dart sends WebSocket protocol pings every 25 seconds. React Native exposes no equivalent here; supply a native transport and verify half-open connection handling. |
| QR label printing | `preparation_production_screen.dart` `_reprintRoll`, `RpsQrReprintSheet` | Connect printer selection and the printer session’s local and driver transports to `reprintPreparationRoll`, then verify on a real printer. |

## Deviations candidates

- `preparation_production_screen.dart` `_showRoll`: `RpsQrReprintSheet` receives both `details` and `detailsContent`; the sheet renders the recipe content and does not render the supplied roll details. Preserve until the user requests a separate change.
- `preparation_screen.dart` pending retry invokes `preparationSubmit` for the stored kind, while that method accepts only `materials`, `receipts` and `consumptions`; pending reversal or GScale commands cannot be retried from that home action.

## Test mode pending

- Material mutations and preparation stock commands reject test mode; the preparation order live stream closes and the warm store is disabled in test mode. Implement in the shared test-mode pass.

Ledger `check` reports `/v1/mobile/preparation` because `preparationFormulaApi.ts` stores the prefix separately; V2 builds these same formula endpoints dynamically in `mobile_api_preparation.dart`. The other endpoint warnings belong to other sessions. The checker cannot resolve the nullable extension `_lineError`, documented at its V4 definition without an `@v2` tag.

No V2 HTTP recordings were found for warehouse creation or deletion; source-derived request tests cover both.

## Needs from the integrator

- Add the preparation role home target and connect the four native routes once platform views exist; connect the borrowed read-only admin order detail sheet.
- Provide the shared `searchMatches` matcher and `AdminSequenceApparatusStore` selection logic for the preparation picker and order list.
- Instantiate `PreparationOrdersWarmStore` with `productionSnapshotStore`, the active session and shared `AdminSequenceApparatusStore` selection; start/reset it with the app session. The shared apparatus selection store and startup wiring are outside this role’s write scope.
