# Scanned WIP history sheet layout

Status: requested layout fix implemented on main; appearance not yet checked on a phone

Scope: the sheet opened by the QR/history icon in the worker order header, on iOS and Android.

## Changes

- Place the header above the content instead of inside a full-height, vertically centered SwiftUI stack.
- Use measured content height for loading, empty and error states. A populated history retains its bounded, scrollable sheet.
- Give the content consistent horizontal padding and the QR launcher / reload / close actions native icon controls with 48-point iOS / 48-dp Android targets and accessibility labels.
- Follow-up hit-area fix: the SwiftUI button label itself contains the fixed 48 × 48 frame and rectangular content shape. An external frame around an intrinsic symbol is no longer relied on for interaction. The shared label also resists horizontal compression.
- Android uses native Compose `Icon` drawables inside these three native buttons; the icon no longer creates a separate React Native touch island inside the Compose button. The QR launcher reserves a non-shrinking 48-dp host.
- Separate accepted-WIP records into readable rows/cards, preserving the existing fields and exact localized text.
- Preserve current-session guards, explicit reload, native iOS dismissal, return confirmation and the write-time dismissal/action lock. Long press is offered only on returnable records, as in V2.

V2 reference: `admin_production_map_orders_scanned_wip.dart:195–333`. Requested design deviation: V2 gives even an empty history 76% screen height; the user explicitly requested fixing the excessive empty space and unclear layout. The server-backed history still represents accepted WIP, independently of a QR selected before Start.

## Validation

- `node --test tests/workerOrderPresentation.test.cjs tests/workerScannedWips.test.cjs tests/scannedWipApi.test.cjs`: 37 pass, including the native label hit-area assertion for QR, reload and close.
- `tsc --noEmit -p tsconfig.ios.json` / `tsconfig.android.json`: pass.
- `npm run lint`: 0 errors, 1 pre-existing warning in `AdminClosedHistoryOwner.tsx`.
- Both full Metro development bundles compile with the updated native history controls and QR drawable.
- `git diff --check`: pass.
- The connected Android was in the background with `hot=false` and the previous bundle. No runtime reload or backend mutation was performed to force a visual check. iOS appearance is also not device-verified; no simulator/emulator was used.
- The follow-up fix was not physically tap-tested: Metro sees both phones, but ADB has no attached device.
