# gscale

Status: in progress
Stopped at: connect discovery and saved device selection, then port the operator and receipt flows.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `modules/accord-gscale` | `SceneDelegate.swift`, `MainActivity.kt`, `network_candidates_io.dart`, `_connectLiveStreamOnce` | Build the native module and verify Bonjour/NSD, UDP discovery, monitor streaming, permissions and local HTTP on physical iOS and Android devices with a real scale/server. The Swift SSE parser was exercised against a local HTTP server; Android native code has not been compiled here. |
| `src/gscale/**` | `gscale_mobile_app*.dart` | Connect saved discovery/device selection and port the operator dashboard, catalog UI, weighing, printing and receipt behaviour. Discovery probing and catalog warehouse-scope rules are implemented. |
| `src/gscale/gscaleDiscovery.ts` | `gscale_mobile_app_helpers_part_10.dart` | V2 iOS additionally runs a Dart UDP fallback after its native UDP pass. Verify whether a second native pass is needed for equivalent results on physical devices. |
| `src/gscale/gscaleBatchApi.ts` | `mobile_api_gscale_declarations_part_01.dart` | Batch requests and response models have source-derived tests; connect them to the operator flow. No direct V2 HTTP recording was found for these methods. |
| `src/gscale/gscaleControlLogic.ts` | `gscale_mobile_app_helpers_part_07.dart`, `gscale_mobile_app_declarations_part_06.dart` | Quantity/weight gates and receipt-label conversion are ported; connect them to the operator flow and port its remaining actions. |
| `src/gscale/gscaleBatchPrint.ts` | `_printActiveRsBatch` | Local preparation, physical printing and confirmation, including one EPC per label, are implemented and need operator UI wiring and real-printer verification. |
| `src/gscale/gscaleBatchStart.ts` | `_startRsBatchFromSelection` | Order, warehouse, dimensions and apparatus are checked before batch start; wire the dependencies to the operator state and platform picker. |
| `src/gscale/gscaleBatchState.ts` | `_refreshRsBatchState`, `_applyRsBatchSession` | Stale batch reads, stopping and late ERP error handling are implemented; wire the store to the operator state and preserve the preparation conflict message when explicitly refreshing. |
| `src/gscale/gscalePreparation.ts` | `gscale_mobile_app_preparation_receipt.dart`, `_submitSimpleReceipt` | Formula preset matching, conflict guards and simple-receipt checks are implemented; connect them to the operator state and preparation entry. |
| `src/gscale/gscaleDraft.ts` | `OperatorControlDraft` | Draft persistence is implemented; wire it to operator state, including V2's debounce and preparation fresh-form reset. |
| `src/gscale/gscaleDeviceState.ts` | `ServerPickerPage`, `_GScaleMobileAppState` | Device restoration, discovery and manual server validation are implemented; wire the store to both platform pickers and native printer lists. |
| `src/gscale/gscaleControlViewModel.ts` | `_buildControlSection` | Control visibility and action-enable rules are extracted; connect them to platform controls and remaining operator state. |
| `src/gscale/gscaleArchive.ts` | `MobileArchiveSession`, `_reprintArchiveReceipt`, `buildMaterialBatchPrintPlan` | Batch aggregation, QR plans and receipt reprint identity checks are implemented; connect archive loading, UI and both print transports, then verify with a real printer. |
| `src/gscale/gscaleMonitor.ts` | `MonitorSnapshot.fromJson` | JavaScript JSON parsing does not retain whether a scale value was encoded as an integer or a decimal such as `2.0`; preserve that distinction if the exact displayed text must match V2. Connect the snapshot and live stream to the operator view. |
| `src/app/ios-gscale/**`, `src/app/android-gscale/**` | `gscale_mode_screen.dart` | Implement both route trees and platform screens using `serializeGScaleModeArgs` / `parseGScaleModeArgs`. |

## Deviations candidates

- `buildGScaleRpsBatchStartRequest` normalizes the Bluetooth printer value `xp-p323b` to `zebra` while retaining label mode. V4 preserves this V2 behaviour.

## Test mode pending

GScale test-mode branches remain for the shared test-mode pass.

## Needs from the integrator

Preparation screens currently disable scale entry; connect their entry actions to the new platform routes once the GScale routes and arguments are available. Role routing for GScale-only users also belongs to the shared route owner.

The shared `adminItemsPage` and `adminWarehouses` API methods used by `gscale_catalog.dart` are absent in this checkout. Supply those shared methods so the GScale catalog adapter can use the same API for admin and other eligible roles.

The role ledger does not recognize `gscale`, so `port_ledger.mjs role gscale 1` cannot generate a reading list or satisfy the role gate. Add GScale session support to the ledger.
