# preparation-ios

Status: in progress
Stopped at: integrate the missing GScale route and network discovery, reconcile optional order-detail controls, and verify the native flows on hardware.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Scale entry | `preparation_screen.dart`, `preparation_order_formula_screen.dart` | Actions now navigate to `/ios-gscale` with warehouse or production arguments; that route is not present in this checkout. Its receiving parameter contract and return behaviour require integration with the GScale session. |
| QR reprint | `preparation_production_screen.dart` `_reprintRoll`, `inventory_movements_screen_declarations_part_02.dart`, `gscale_mobile_app_widgets_part_02.dart` | Production and inventory QR reprint support Bluetooth discovery and manual Wi-Fi server selection. Automatic Wi-Fi server discovery awaits the GScale native discovery module; verify both flows with a real printer. |
| Sequence detail | `admin_production_map_orders_preparation_list.dart`, `admin_production_map_orders_detail_widgets.dart` | The scoped summary, image viewer and order-material-to-variants flow are connected. Native sheet-to-variants back navigation needs real-device verification; optional snapshot-control decoder parity remains open in `preparation.md`. |
| Navigation | `preparation_navigation.dart` | Inventory is connected and scale links target `/ios-gscale`. Shared chat screens still hard-code worker routes and were outside this task. Verify native root-replacement behaviour. |

## Deviations candidates

## Test mode pending

## Needs from the integrator

- Supply the `/ios-gscale` screen and confirm its parameter encoding. Verify native detail-sheet navigation on a physical iPhone.
- Supply the GScale network-discovery module for automatic printer-server discovery.

## Drift

- V2 HEAD removes unused home consumption helpers and changes a scale test after baseline `7c87a54e`; the screen work continues against the recorded baseline. Shared consumption logic is owned by the logic session.

## Verification

- The iOS variant picker uses the shared scoped, paginated `searchMatches` catalog. The focused search and variant tests, iOS typecheck and Expo lint passed; native picker interaction still needs a phone.
- `node --test tests/*.test.cjs`: 854 passed. Focused printer tests also passed after the final address-normalization adjustment. Native views are not rendered by these tests.
- iOS and default TypeScript checks passed; Android typecheck retains the 10 errors recorded in `PORT.md`.
- `npx expo lint` passed. `port_ledger.mjs check` passed with the seven previously documented dynamic/other-role endpoint warnings. All 16 iOS surface tags are present; the role ledger still has unchecked route and Android entries, so no claim of complete role parity is made.
- V2 role reading estimate: 112k tokens; actual tokens read were not measured. Two source-derived inventory assignment API methods were added; no V2 recording existed for them in this role's fixtures.
- No simulator or physical device was used. Check sequence detail, formula navigation, inventory scanning and transfers, printer selection, scale return, accessibility, and light/dark appearance on a real iPhone.

## Checkpoints

- `ccb8a26` port(preparation/ios): home and warehouse screens
- `a5ae265` port(preparation/ios): formula library and editor
- `5af1a28` port(preparation/ios): formula variants
- `e45d963` port(preparation/ios): production journal
- `f191049` port(preparation/ios): navigation and sequence view
- `bfe60f7` port(preparation/ios): clear scoped rows on account reset
- `9c4c159` port(preparation/ios): sequence and scale navigation
- `26e5183` port(preparation/ios): QR printer selection
- `248fe52` port(preparation/ios): inventory movements
- `6709349` port(preparation/ios): preparation order summary and formulas
- `3bb75b4` port(preparation/ios): inventory order assignments
- `d32ce7e` port(preparation/ios): clear preparation on account reset
- `e40f827` port(preparation/ios): inventory QR reprint
