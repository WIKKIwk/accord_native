# Aparatchi Android: daily-work order cards

Status: the list renders on a connected Android phone; visual review across themes and text sizes remains open.

## Surface audit

| V2 source | V4 Android | Comparison |
|---|---|---|
| `_DailyWorkOrderGroupCardState`, `aparatchi_daily_work_screen_models_part_03.dart` | `DailyWorkScreen.android.tsx` | Outlined order group, order ID and title, count badge, expand/collapse and separately keyed WIP cards. The selected-day groups still come from the shared daily-work model. |
| `_DailyWorkWipCardState`, `_DailyWorkCompactDetails`, `_DailyWorkMetricsGrid`, `aparatchi_daily_work_screen_models_part_04.dart` | `DailyWorkScreen.android.tsx` | Number badge, product title, status chip and two compact QR/length values; expanded QR and optional metrics, times, locations and note remain in V2 order. Values can wrap for readability. |
| `_DailyWorkStatusChip`, `_DailyWorkInfoRow`, `aparatchi_daily_work_screen_models_part_06.dart` | `DailyWorkScreen.android.tsx` | Material status colors and aligned labels/values follow the active palette. Expand, edit and QR long press keep their existing callbacks. |

Compose `combinedClickable` supplies the long-press haptic, so the Android card suppresses the separate JS haptic;
iOS and other callers keep their existing feedback. Android's default is documented in the
[combinedClickable reference](https://developer.android.com/reference/kotlin/androidx/compose/foundation/combinedClickable.modifier).

## Runtime correction

The running Metro graph initially retained the older fallback screen after the Android-specific file was added. Once the
import was refreshed, the new screen failed because its local `Symbol` component shadowed the global `Symbol` used by
the React Compiler's memo cache. The icon component was renamed and the actual React Compiler output is now exercised
by a regression test. The active Metro graph resolves `WorkerDailyPage` to the Android-specific screen.

## Verification

- Focused daily-work, QR, corrections and queue tests: 83 passed, including the React Compiler regression.
- Android and iOS TypeScript checks: passed. Expo lint: passed with one existing unrelated Admin hook warning.
- Android Expo export: passed; the source map resolves the new Android daily-work screen.
- Ledger check passed with 1243 resolved V2 tags and 115 test tags; the eleven existing dynamic-endpoint diagnostics remain.
- A connected Android phone rendered an order and WIP card without LogBox; the WIP expanded, collapsed and reopened
  through its actual interaction callback. The native screen's visual appearance was not captured for review.
- The ledger page lookup does not recognize the private V2 group widget. Its UI and text were checked directly against
  the source; no whole-role audit or text-gate completion is claimed.

## Open item

Check light/dark themes, multiple WIPs, expanded long QR and notes, edit, and QR long press on a real Android phone.
No emulator was used.
