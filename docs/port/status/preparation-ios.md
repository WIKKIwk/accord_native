# preparation-ios

Status: in progress
Stopped at: connect the preparation sequence to the shared runtime and finish shared navigation wiring.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Scale entry | `preparation_screen.dart`, `preparation_order_formula_screen.dart` | Actions now navigate to `/ios-gscale` with warehouse or production arguments; that route is not present in this checkout. Its receiving parameter contract and return behaviour require integration with the GScale session. |
| Variant picker search | `preparation_formula_variants_screen.dart` `_reuse` | The scoped catalog picker is connected, but fuzzy/transliteration search requires the shared `searchMatches` port. |
| Roll QR reprint | `preparation_production_screen.dart` `_reprintRoll`, `gscale_mobile_app_widgets_part_02.dart` | QR reprint now supports Bluetooth discovery and manual Wi-Fi server selection through `reprintPreparationRollWithPrinter`. Automatic Wi-Fi server discovery awaits the GScale native discovery module; verify the flow with a real printer. |
| Sequence detail | `admin_production_map_orders_preparation_list.dart`, `admin_production_map_orders_detail_widgets.dart` | The scoped summary, image viewer and order-material-to-variants flow are connected. Native sheet-to-variants back navigation needs real-device verification; optional snapshot-control decoder parity remains open in `preparation.md`. |
| Inventory assignment | `inventory_movements_screen.dart`, `raw_material_order_assignment_section.dart` | The iOS inventory route uses the shared live store, warehouse filter, QR lookup and transfer action. The conditional raw-material order-assignment editor still needs its shared implementation. |
| Navigation | `preparation_navigation.dart` | Shared chat screens hard-code worker routes; connect chat, scale and inventory destinations when role-neutral platform routes are available. Verify native root-replacement behaviour. |

## Deviations candidates

## Test mode pending

## Needs from the integrator

- Add the iOS preparation home target to `src/shared/appRoutes.ts` and connect the platform route from app startup.
- Supply the `/ios-gscale` screen and confirm its parameter encoding. Supply the raw-material order-assignment editor and complete the borrowed order-detail presentation.
- The apparatus store, warm-store startup and `searchMatches` matcher are present in this checkout.

## Drift

- V2 HEAD removes unused home consumption helpers and changes a scale test after baseline `7c87a54e`; the screen work continues against the recorded baseline. Shared consumption logic is owned by the logic session.

## Verification

- `node --test tests/*.test.cjs`: 813 passed. These tests exercise shared logic and do not render the new native screens.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed. Android typecheck reports the 10 errors already recorded in `PORT.md`.
- `npx expo lint`: passed. `port_ledger.mjs check`: passed with the six previously recorded dynamic/other-role endpoint warnings.
- `port_ledger.mjs role preparation`: 15 of 16 iOS surface tags present; the borrowed sequence and all four shared route tags remain open. Tags alone do not close the integration items above.
- V2 role reading estimate: 112k tokens; actual tokens read were not measured. No APIs or tests were added in this iOS screen session.
- No simulator or physical device was used. Check navigation, sheets, stock and formula actions, journal refresh, accessibility and light/dark appearance on a real iPhone.

## Checkpoints

- `ccb8a26` port(preparation/ios): home and warehouse screens
- `a5ae265` port(preparation/ios): formula library and editor
- `5af1a28` port(preparation/ios): formula variants
- `e45d963` port(preparation/ios): production journal
- `f191049` port(preparation/ios): navigation and sequence view
