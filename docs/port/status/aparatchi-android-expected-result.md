# Aparatchi Android: expected result

Status: layout changed on `main`; real-device verification remains open.

## V2 comparison

| V2 surface | Android implementation | Result |
|---|---|---|
| `_OrderSummaryCard`, `admin_production_map_orders_detail_widgets.dart:1150` | `src/components/WorkerOrderOverview.android.tsx` | Existing title, subtitle, expansion, values and stage navigation remain connected to the shared overview model. |
| `AppInfoRow`, `core/widgets/display/app_info_row.dart:3` | `src/components/WorkerOrderOverview.android.tsx` | Compact rows place a 16 dp icon and label within 104 dp beside the value, with 7 dp vertical padding. Long values can wrap; colors follow the active theme. |

The four row icons and display order match V2: length, weight, shafts and print side. No visible text or data rules
were added. The checked-out V2 sources match the recorded baseline for these two files.

## Verification

- `tests/workerOrderPresentation.test.cjs`: 21/21 passed, including expansion/collapse, all four values and icons,
  compact insets, text wrapping, missing data, theme colors and stage navigation.
- Android TypeScript check: exit 0. Expo lint: exit 0 with the existing unrelated Admin hook warning.
- Android Hermes export: exit 0. Its source map contains the exact current `WorkerOrderOverview.android.tsx`.
- Port ledger check: exit 0; 1240 `@v2` and 115 `@v2-test` tags resolve. Eleven existing dynamic endpoint
  diagnostics remain.
- The page text command for `_OrderSummaryCard` selected the unrelated `_OrderHomashyoPickerSheet`, so its five
  missing strings are not evidence about this card. The card's existing localization keys and row order were compared
  directly with the V2 source; no text exceptions were added.

## Open items

- Check on a real Android phone that the expanded card is compact and readable in light and dark mode, including a
  long shaft description and larger system text. No device or emulator was used for this change.
