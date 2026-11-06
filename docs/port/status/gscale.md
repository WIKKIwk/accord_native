# gscale

Status: in progress
Stopped at: connect discovery results to the GScale model and port the operator and receipt flows.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `modules/accord-gscale` | `SceneDelegate.swift`, `MainActivity.kt`, `network_candidates_io.dart` | Build the native module and verify Bonjour/NSD, UDP discovery, permissions and local HTTP on physical iOS and Android devices with a real scale/server. |
| `src/gscale/**` | `gscale_mobile_app*.dart` | Port discovery probing, the operator dashboard, catalog, weighing, printing and receipt behaviour. |
| `src/app/ios-gscale/**`, `src/app/android-gscale/**` | `gscale_mode_screen.dart` | Implement both route trees, GScaleModeArgs and the platform screens. |

## Deviations candidates

None recorded.

## Test mode pending

GScale test-mode branches remain for the shared test-mode pass.

## Needs from the integrator

Preparation screens currently disable scale entry; connect their entry actions to the new platform routes once the GScale routes and arguments are available. Role routing for GScale-only users also belongs to the shared route owner.
