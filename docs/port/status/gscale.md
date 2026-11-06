# gscale

Status: in progress
Stopped at: finish saved discovery/device selection and port the operator and receipt flows.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `modules/accord-gscale` | `SceneDelegate.swift`, `MainActivity.kt`, `network_candidates_io.dart` | Build the native module and verify Bonjour/NSD, UDP discovery, permissions and local HTTP on physical iOS and Android devices with a real scale/server. |
| `src/gscale/**` | `gscale_mobile_app*.dart` | Port saved discovery/device selection, the operator dashboard, catalog UI, weighing, printing and receipt behaviour. Discovery probing and catalog warehouse-scope rules are implemented. |
| `src/gscale/gscaleDiscovery.ts` | `gscale_mobile_app_helpers_part_10.dart` | V2 iOS additionally runs a Dart UDP fallback after its native UDP pass. Verify whether a second native pass is needed for equivalent results on physical devices. |
| `src/gscale/gscaleBatchApi.ts` | `mobile_api_gscale_declarations_part_01.dart` | Batch requests and response models have source-derived tests; connect them to the operator flow. No direct V2 HTTP recording was found for these methods. |
| `src/gscale/gscaleControlLogic.ts` | `gscale_mobile_app_helpers_part_07.dart`, `gscale_mobile_app_declarations_part_06.dart` | Quantity/weight gates and receipt-label conversion are ported; connect them to the operator flow and port its remaining actions. |
| `src/app/ios-gscale/**`, `src/app/android-gscale/**` | `gscale_mode_screen.dart` | Implement both route trees, GScaleModeArgs and the platform screens. |

## Deviations candidates

None recorded.

## Test mode pending

GScale test-mode branches remain for the shared test-mode pass.

## Needs from the integrator

Preparation screens currently disable scale entry; connect their entry actions to the new platform routes once the GScale routes and arguments are available. Role routing for GScale-only users also belongs to the shared route owner.

The shared `adminItemsPage` and `adminWarehouses` API methods used by `gscale_catalog.dart` are absent in this checkout. Supply those shared methods so the GScale catalog adapter can use the same API for admin and other eligible roles.
