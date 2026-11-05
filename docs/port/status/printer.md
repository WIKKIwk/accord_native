# printer

Status: printer session in progress
Stopped at: TSPL byte comparison and real-printer validation remain.

GoDEX is archived and outside this session by the user's instruction. The Android USB path supports Zebra; the V2 native GoDEX-specific test method is excluded.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| TSPL parity | `BluetoothPrinterChannel.kt`, `XPrinterBluetoothChannel.swift` | Compare Android and iOS TSPL bytes against V2 for identical label inputs. The platform-native label code is ported, but the byte comparison has not yet run. |
| SDK licence | `ios/vendor/xprinter/README.md`, `android/app/libs/printer-lib-3.5.8.aar` | Confirm redistribution terms for the Xprinter iOS SDK and Android printer SDK; V2 does not include them. |
| Hardware | Bluetooth and USB channels | Verify printing and discovery on real printers and devices. |
| iOS simulator | `ios/vendor/xprinter/README.md` | The vendor library has no arm64 simulator slice; use an iOS device build or obtain a compatible vendor SDK. |
| V2 widget tests | `test/bluetooth_printer_list_test.dart`, `test/qolip_printer_choice_test.dart` | Port their UI behavior during the owning platform screen sessions; they test widgets outside the printer session's scope. |
| Printer ledger | `port_ledger.mjs role printer 1` | The generator does not recognize printer as a role; use `worklist printer` and the source inventory until the integrator adds printer support. |

## Deviations candidates

## Test mode pending

## Needs from the integrator
