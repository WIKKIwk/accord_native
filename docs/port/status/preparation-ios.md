# preparation-ios

Status: in progress
Stopped at: the separate GScale route and shared order-detail decoder, the shared manual-server default-port handling, and physical-device verification.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Scale entry | `preparation_screen.dart`, `preparation_order_formula_screen.dart` | Actions open `/ios-gscale`, which now parses their arguments. Check the entry and its return on a real iPhone. |
| QR reprint | `preparation_production_screen.dart` `_reprintRoll`, `inventory_movements_screen_declarations_part_02.dart`, `gscale_mobile_app_widgets_part_02.dart` | The picker offers Bluetooth and automatic Wi-Fi discovery using the existing native discovery runtime; manual Wi-Fi entry probes the server before selection. Both production and inventory flows require a real-device and printer check. |
| Sequence detail | `admin_production_map_orders_preparation_list.dart`, `admin_production_map_orders_detail_widgets.dart` | The scoped summary, image viewer and order-material-to-variants flow are connected. Native sheet-to-variants back navigation needs real-device verification; optional snapshot-control decoder parity remains open in `preparation.md`. |
| Navigation | `preparation_navigation.dart` | Inventory is connected and scale links target `/ios-gscale`. Shared chat screens still hard-code worker routes and were outside this task. Verify native root-replacement behaviour. |

## Deviations candidates

## Test mode pending

## Needs from the integrator

- Reconcile the optional order-detail snapshot controls in the shared decoder, as recorded in `preparation.md`.

## Drift

- V2 HEAD removes unused home consumption helpers and changes a scale test after baseline `7c87a54e`; the screen work continues against the recorded baseline. Shared consumption logic is owned by the logic session.

## Verification

- The iOS variant picker uses the shared scoped, paginated `searchMatches` catalog. Focused JavaScript picker checks covered stale results, pagination, selection, discovery and cancellation; native picker interaction still needs a phone.
- `node --test tests/*.test.cjs`: 942 passed. Native views are not rendered by these tests.
- iOS and default TypeScript checks passed. The previous Android typecheck recorded 10 baseline errors in `PORT.md`; it was not rerun in this turn.
- `npx expo lint` passed. `port_ledger.mjs check` passed with the seven previously documented dynamic/other-role endpoint warnings. All 16 iOS and Android surface tags are present; the role ledger still has unchecked shared route entries, so no claim of complete role parity is made.
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
- `b8eab25` port(preparation/ios): searchable variant picker
- `03795fa` port(preparation/ios): keep rapid picker searches current
