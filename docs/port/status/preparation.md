# preparation

Status: part 1 of 1 in progress
Stopped at: port the preparation order live stream and warm store, remaining screen actions and UI contract.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Preparation order detail decoder | `mobile_api_preparation_orders.dart` `preparationOrderDetail`, `productionMapSnapshot.ts` | The shared snapshot decoder has existing open parity work; integrate its fixes for the read-only preparation order sheet. |
| QR label printing | `preparation_production_screen.dart` `_reprintRoll`, `RpsQrReprintSheet` | Connect printer selection and the printer session’s local and driver transports to `reprintPreparationRoll`, then verify on a real printer. |

## Deviations candidates

## Test mode pending

- Material mutations and preparation stock commands reject test mode; implement in the shared test-mode pass.

No V2 HTTP recordings were found for warehouse creation or deletion; source-derived request tests cover both.

## Needs from the integrator
