# printer

Status: printer session in progress
Stopped at: Native channel bridges, Bluetooth payload and USB label renderers remain.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| `modules/accord-printer` | `BluetoothPrinterChannel.kt`, `XPrinterBluetoothChannel.swift`, `UsbPrinterChannel.kt`, `GodexRpsRenderer.kt` | Port Bluetooth, discovery and Android USB channels into the local Expo module, including permissions, cancellation and error/result parity. |
| `src/printing` | `native_bluetooth_printer.dart`, `native_usb_printer.dart`, `print_service.dart`, `printing/` | Port channel wrappers, session cache, transport, print routing and GoDEX renderer; Zebra ZPL streams match five V2 oracle cases, and Bluetooth text, progress layout and Data Matrix rectangles are ported; Data Matrix output matches eight V2 oracle cases. |
| TSPL parity | `BluetoothPrinterChannel.kt`, `XPrinterBluetoothChannel.swift` | Compare Android and iOS TSPL bytes against V2 for identical label inputs. |
| SDK licence | `ios/vendor/xprinter/README.md`, `android/app/libs/printer-lib-3.5.8.aar` | Confirm redistribution terms for the Xprinter iOS SDK and Android printer SDK; V2 does not include them. |
| Hardware | Bluetooth and USB channels | Verify printing and discovery on real printers and devices. |
| V2 widget tests | `test/bluetooth_printer_list_test.dart`, `test/qolip_printer_choice_test.dart` | Port their UI behavior during the owning platform screen sessions; they test widgets outside the printer session's scope. |
| Printer ledger | `port_ledger.mjs role printer 1` | The generator does not recognize printer as a role; use `worklist printer` and the source inventory until the integrator adds printer support. |

## Deviations candidates

## Test mode pending

## Needs from the integrator
