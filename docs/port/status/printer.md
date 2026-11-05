# printer

Status: printer session in progress
Stopped at: iOS TSPL runtime comparison and real-printer validation remain.

GoDEX is archived and outside this session by the user's instruction. The Android USB path supports Zebra; the V2 native GoDEX-specific test method is excluded.

Verification: 638 Node tests pass; default and iOS type checks and Expo lint pass. Android type checking reports the 10 known baseline errors in worker screens. The Android module compiles, its native TSPL test passes, and the generated app manifest merges successfully using a temporary SDK 36 configuration. The iOS module builds for a generic iOS device. No printer or simulator was used.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| TSPL parity | `BluetoothPrinterChannel.kt`, `XPrinterBluetoothChannel.swift` | Android output matches V2 byte for byte for 11 label inputs, with native SDK fixtures checked by `testDebugUnitTest`. iOS command-generation source is identical to V2, but its SDK output still needs a runtime byte comparison. |
| SDK licence | `ios/vendor/xprinter/README.md`, `android/app/libs/printer-lib-3.5.8.aar` | Confirm redistribution terms for the Xprinter iOS SDK and Android printer SDK; V2 does not include them. |
| Hardware | Bluetooth and USB channels | Verify printing and discovery on real printers and devices. |
| iOS simulator | `ios/vendor/xprinter/README.md` | The vendor library has no arm64 simulator slice; use an iOS device build or obtain a compatible vendor SDK. |
| V2 widget tests | `test/bluetooth_printer_list_test.dart`, `test/qolip_printer_choice_test.dart` | Port their UI behavior during the owning platform screen sessions; they test widgets outside the printer session's scope. |
| Printer ledger | `port_ledger.mjs role printer 1` | The generator does not recognize printer as a role; use `worklist printer` and the source inventory until the integrator adds printer support. |

## Deviations candidates

## Test mode pending

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `port_ledger.mjs` | Printer session | Add printer session support to the role generator if a generated per-line role gate is required. |
