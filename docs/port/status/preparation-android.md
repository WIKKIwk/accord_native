# preparation-android

Status: in progress
Stopped at: wire the preparation profile entry and complete device verification.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Home and warehouse | `preparation_screen.dart`, `preparation_screen_forms.dart` | Sequence, inventory and scale actions are connected. Chat and profile destinations remain for their owning sessions. |
| Roll QR | `RpsQrReprintSheet`, `preparation_production_screen.dart` `_reprintRoll` | Reprint supports paired Bluetooth, USB (Zebra only, D13), discovered Wi-Fi servers and manual Wi-Fi selection. Physical-printer verification remains open. |
| Platform parity | `docs/port/roles/preparation.md` | Compare all implemented screen states, localization, input behavior, navigation and accessibility against the V2 contract on a real Android device. No simulator or device was used. |
| V2 drift | `preparation_screen.dart`, `preparation_screen_forms.dart`; baseline `7c87a54e` | Drift reports removal of the old consumption editor in V2 HEAD. Shared logic remains owned by the preparation/integrator session; this screen session follows the pinned baseline. |

## Deviations candidates

None added.

## Test mode pending

The preparation logic session owns the deferred test-mode branches.

## Needs from the integrator

- Supply the Android chat destination and a role-appropriate profile destination.
- Complete the contract's dynamic localization inventory.

## Verification

- The role ledger estimates 112k V2 tokens; actual tokens read were not measured. Inventory assignment candidate and link requests, order metrics and their tests were added to the existing shared logic.
- Full suite: 852 passed. Android Expo export, iOS TypeScript and Expo lint passed. Android TypeScript still reports the same 10 worker errors recorded in `PORT.md`.
- Ledger check passed with seven previously recorded dynamic/other-role endpoint warnings. All 16 listed Android surfaces are tagged, with the gaps above still open.
- No simulator or device was used. On a real Android phone, check light/dark mode, hardware back, short-list refresh, save and error states, account switching, and printer and scale flows after integration.

## Checkpoints

- `4d6a009` port(preparation/android): formula library and editor
- `293f872` port(preparation/android): production journal
- `a798ead` port(preparation/android): home and warehouse screens
- `999797f` port(preparation/android): formula variants
- `a03d395` port(preparation/android): sequence list view
- `341e8d0` port(preparation/android): connect scale actions
- `03088ad` port(preparation/android): sequence and scoped detail
- `e8afe19` port(preparation/android): roll reprint picker
- `e7f62a8` port(preparation/android): inventory movements
- `05f01ef` port(preparation/android): clear account scoped state
- `bb53af1` port(preparation/android): manual wifi printer selection
- `597da25` port(preparation/android): inventory order assignment
- `b408f92` port(preparation/android): order detail summary
