# preparation

Status: part 1 of 1 in progress
Stopped at: port persistent commands, production APIs and screen logic from the V2 baseline.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| QR label printing | `preparation_production_screen.dart` `_reprintRoll`, `RpsQrReprintSheet` | Connect the printer session's Bluetooth and USB channels and verify on a real printer. |

## Deviations candidates

## Test mode pending

- Material mutations reject test mode; implement in the shared test-mode pass.

No V2 HTTP recordings were found for warehouse creation or deletion; source-derived request tests cover both.

## Needs from the integrator
