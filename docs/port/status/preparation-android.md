# preparation-android

Status: in progress
Stopped at: integrate the shared sequence/detail, scale, printer and other role destinations; complete device verification and remaining UI parity.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Home and warehouse | `preparation_screen.dart`, `preparation_screen_forms.dart` | Connect scale receipt, inventory movements, sequence, chat and profile destinations. The shared destination implementations are not available to this screen session. Restore the full drawer and dock destinations when they exist. |
| Sequence | `_PreparationOrdersListState`, `AdminProductionMapOrdersScreen` | The native list component accepts an injected `PreparationOrdersState`, apparatus selector and read-only detail opener. Shared apparatus selection, warm-store startup and the borrowed detail view are not available yet, so the component has no route and the home action is omitted. Wire the real store, detail host, order material picker and variants route. |
| Formula variants | `preparation_formula_variants_screen.dart` `_reuse` | Add searchable reuse with the shared V2 `searchMatches` implementation once the integrator supplies it. |
| Formula editor | `preparation_order_formula_screen.dart` `_startProduction` | Connect the scale receipt route and retain the opening guard until that route returns. |
| Formula shares | `_FormulaSharesSheet` | The share editor currently uses a native alert dialog so saving can block dismissal. Move it to the native sheet host once that host can also block hardware back while saving. |
| Roll QR | `RpsQrReprintSheet`, `preparation_production_screen.dart` `_reprintRoll` | The QR and captured recipe preview are present; printer selection and transport are not connected, so reprint is omitted. Integrate `reprintPreparationRoll` and verify with a physical printer. |
| Platform parity | `docs/port/roles/preparation.md` | Compare all implemented screen states, localization, input behavior, navigation and accessibility against the V2 contract on a real Android device. No simulator or device was used. |
| V2 drift | `preparation_screen.dart`, `preparation_screen_forms.dart`; baseline `7c87a54e` | Drift reports removal of the old consumption editor in V2 HEAD. Shared logic remains owned by the preparation/integrator session; this screen session follows the pinned baseline. |

## Deviations candidates

None added.

## Test mode pending

The preparation logic session owns the deferred test-mode branches.

## Needs from the integrator

- Add `/android-preparation` to the shared role home-target table and connect the native route tree.
- Supply `AdminSequenceApparatusStore`, start `PreparationOrdersWarmStore` with the active session, and provide the read-only order detail host and its preparation formula action.
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
