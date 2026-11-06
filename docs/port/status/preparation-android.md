# preparation-android

Status: in progress
Stopped at: integrate the shared sequence/detail, scale, printer and other role destinations; complete device verification and remaining UI parity.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Home and warehouse | `preparation_screen.dart`, `preparation_screen_forms.dart` | Connect scale receipt, inventory movements, sequence, chat and profile destinations. The shared destination implementations are not available to this screen session. Restore the full drawer and dock destinations when they exist. |
| Inventory | `inventory_movements_screen.dart` | Android now has scoped warehouse, asset and transfer windows, QR lookup, asset details and transfer requests. The raw-material order-assignment editor and full V2 detail presentation remain open. |
| Sequence | `_PreparationOrdersListState`, `AdminProductionMapOrdersScreen` | The Android route now connects the warm store, apparatus selection, scoped detail loading and the order-material picker to variants. The shared worker overview covers only part of the borrowed admin read-only detail; compare the remaining admin detail sections and calculation-template-derived values before claiming full parity. |
| Formula variants | `preparation_formula_variants_screen.dart` `_reuse` | Add searchable reuse with the shared V2 `searchMatches` implementation once the integrator supplies it. |
| Scale destination | `gscale_mode_screen.dart` `GScaleModeArgs` | Home, warehouse, material and formula actions now push `/android-gscale` with serialized arguments; the GScale session must supply that route and consume its `data` parameter. The formula opening guard remains active until return. |
| Formula shares | `_FormulaSharesSheet` | The share editor currently uses a native alert dialog so saving can block dismissal. Move it to the native sheet host once that host can also block hardware back while saving. |
| Roll QR | `RpsQrReprintSheet`, `preparation_production_screen.dart` `_reprintRoll` | Reprint is connected to the USB and paired-Bluetooth picker and transport. The V2 picker also discovers nearby Bluetooth and Wi-Fi devices; that picker and physical-printer verification remain open. |
| Platform parity | `docs/port/roles/preparation.md` | Compare all implemented screen states, localization, input behavior, navigation and accessibility against the V2 contract on a real Android device. No simulator or device was used. |
| V2 drift | `preparation_screen.dart`, `preparation_screen_forms.dart`; baseline `7c87a54e` | Drift reports removal of the old consumption editor in V2 HEAD. Shared logic remains owned by the preparation/integrator session; this screen session follows the pinned baseline. |

## Deviations candidates

None added.

## Test mode pending

The preparation logic session owns the deferred test-mode branches.

## Needs from the integrator

- Add `/android-preparation` to the shared role home-target table and connect the native route tree.
- Complete the borrowed read-only admin order detail sections and calculation-template-derived values.
- Supply shared `searchMatches`, the scale receipt and inventory-movement routes, the Android chat destination, a role-appropriate profile destination, and printer selection/transport.
- Review the existing shared controllers' account-scope invalidation and complete the contract's dynamic localization inventory.

## Verification

- The role ledger estimates 112k V2 tokens; actual tokens read were not measured. Shared API methods were reused; no API methods or test files were added in this session.
- Full existing suite: 813 passed. Preparation-focused suite: 74 passed. Android Expo export succeeded. iOS TypeScript and Expo lint passed. Android TypeScript reported the same 10 pre-existing worker errors recorded in `PORT.md`.
- Ledger check passed with the six previously recorded dynamic/other-role endpoint warnings. Android tags cover 14 of 16 listed surfaces; the QR reprint and sequence screen remain open, and the tagged screens still have the gaps above.
- No simulator or device was used. On a real Android phone, check light/dark mode, hardware back, short-list refresh, save and error states, account switching, and the connected printer/scale flows after integration.

## Checkpoints

- `4d6a009` port(preparation/android): formula library and editor
- `293f872` port(preparation/android): production journal
- `a798ead` port(preparation/android): home and warehouse screens
- `999797f` port(preparation/android): formula variants
- `a03d395` port(preparation/android): sequence list view
