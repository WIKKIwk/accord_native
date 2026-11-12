# Aparatchi QR scanner sheets

The user requested native sheets on both platforms in place of the full-screen scanner page. Work is on `main`.

## Surface comparison

| V2 surface | V4 implementation | Result |
|---|---|---|
| `admin_production_map_orders_screen_state.dart:1499`, worker FAB scanner | `WorkerScreen.tsx`, `WorkerQrScanner.tsx` | The scanner overlays the mounted queue. Closing preserves its selected apparatus, search and rows. No scanner route or full-screen modal is opened. |
| `admin_progress_qr_scan_screen_models_part_01.dart:35`, camera frame and torch | `WorkerQrScannerPreview.tsx`, native `WorkerQrScannerView` files | QR/DataMatrix camera, square frame, torch, status and manual alternative. iOS uses a SwiftUI sheet and native buttons; Android uses a Material sheet and controls. Scrollable content bounds the layout on small screens; theme colors replace forced light mode. |
| Scan-only result and manual entry | `useWorkerQrScanner.ts`, `WorkerQrScannerDialogs.tsx` | The existing normalization and scoped lookup APIs remain. An order opens once the sheet finishes dismissing. Manual confirmation retains the iOS modal dismissal handshake. Cancellation, account/window loss and backgrounding discard obsolete work. |

The title, prompt, lookup, retry and manual labels use the existing V2 production translations. Flash accessibility
labels reuse the recorded translations. The change introduces no dependency or backend write.

## Verification

- 115 focused normalization, scanner lifecycle/view, queue retention, scoped lookup and order-switch tests pass.
- iOS and Android platform TypeScript checks pass. Expo lint has zero errors and its existing unrelated Admin hook warning.
- Both Hermes exports pass; source maps contain the current scanner and queue files.
- The connected Android Expo Go loaded the updated modules and mounted the native scanner from the FAB. The app was
  in the background, and the camera correctly remained inactive. Foreground appearance, live camera detection and iOS
  device presentation were not verified. No simulator, production order command or print operation was used.
