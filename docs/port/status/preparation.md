# preparation

Status: part 1 of 1 in progress
Stopped at: connect preparation order screen coordination and remaining screen actions, then write the UI contract.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Preparation order detail decoder | `mobile_api_preparation_orders.dart` `preparationOrderDetail`, `productionMapSnapshot.ts` | The shared snapshot decoder has existing open parity work; integrate its fixes for the read-only preparation order sheet. |
| Preparation order live transport | `warehouse_live_client_io.dart` `_connectLive` | Native Dart sends WebSocket protocol pings every 25 seconds. React Native exposes no equivalent here; supply a native transport and verify half-open connection handling. |
| QR label printing | `preparation_production_screen.dart` `_reprintRoll`, `RpsQrReprintSheet` | Connect printer selection and the printer session’s local and driver transports to `reprintPreparationRoll`, then verify on a real printer. |

## Deviations candidates

## Test mode pending

- Material mutations and preparation stock commands reject test mode; implement in the shared test-mode pass.

No V2 HTTP recordings were found for warehouse creation or deletion; source-derived request tests cover both.

## Needs from the integrator

- Instantiate `PreparationOrdersWarmStore` with `productionSnapshotStore`, the active session and shared `AdminSequenceApparatusStore` selection; start/reset it with the app session. The shared apparatus selection store and startup wiring are outside this role’s write scope.
