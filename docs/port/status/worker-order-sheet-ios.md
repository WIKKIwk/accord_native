# Worker order sheet — iOS

Status: scoped visual update implemented; real-device verification pending.

Subsequent material/progress/completion parity work on both platforms is recorded in [aparatchi-order-sheet.md](aparatchi-order-sheet.md), including the now-passing Android typecheck.

V2 references: `admin_production_map_orders_detail_widgets.dart` expected-summary rows and `admin_production_map_orders_start_card.dart` pause/complete actions. Existing V4 `OrderScreen` continues to own action permissions, scanner state, reports and submissions.

- The order identity uses SwiftUI buttons for image preview and dismissal and shows the product name. On iOS 26, dismissal uses the system close role and glass style.
- Order actions use native SwiftUI `glassProminent` / `glass` capsule buttons on iOS 26, with native bordered styles on older iOS. The system controls their height and padding; labels support Dynamic Type. Completion appears above roll removal on iOS; Android retains its horizontal action group.
- The native SwiftUI sheet and embedded RN content share the system grouped background, including the bottom safe area. The fixed-detent viewport is bounded independently of the scroll content height; content-sized account sheets retain their bounded scrolling and fitted height. Close callbacks still wait for native dismissal before opening another sheet.
- Expected output uses separate meter/weight values and padded shaft/print-side details. All production stages remain visible in the scrolling sheet; apparatus stages open the existing WIP history.
- Overview data and history navigation are shared with the existing Android overview. Planned-meter rounding, invalid-value filtering and action callbacks are unchanged.

Verification: 82 focused tests pass, including fitted-sheet sizing, native dismissal ordering and iOS version-specific button styles. Both Expo Go bundles return HTTP 200. iOS typecheck passes; lint has no errors and one existing warning. The earlier Android typecheck reported nine existing errors in `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`.

Open: verify the appearance on a real iPhone in light/dark mode and with larger text, including long product/stage names and image/close/report actions. No device, simulator or emulator was used.
