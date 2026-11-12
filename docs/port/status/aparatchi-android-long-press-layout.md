# Aparatchi Android: long-press menu layout

Status: code and focused checks complete on `main`; real-phone layout verification remains open.

## Surface audit

| V2 surface | V4 implementation | Comparison |
|---|---|---|
| `_BosmaWorkerFinishSheet`, `_LaminatsiyaWorkerFinishSheet` and `_LaminatsiyaWorkerHandoffSheet`, `admin_production_map_orders_module_pages.dart` | `WorkerScreen.tsx`, `WorkerOrderSheet.android.tsx`, `WorkerLongPressActions.tsx` | V2 wraps the menu content. Android now requests a content-height sheet capped at 86% of the available screen and scrolls taller menus. Existing action text, order, callbacks, and dismissal remain unchanged. |
| Android worker drawer logout button | `WorkerLongPressActions.tsx`, `WorkerSheetButton.tsx` | Menu action buttons use the same 56 dp height; iOS continues using its existing native button sizing. |

## Verification

- Focused long-press, menu, queue, and presentation tests: 104 passed.
- Android and iOS TypeScript checks: passed. Expo lint: passed with one existing unrelated Admin hook warning.
- Android Expo export: passed in the shared working tree.

## Open item

Check the menu height, scrolling, action buttons, dismissal, light/dark theme and larger system text on a real Android phone. No device or emulator was used.
