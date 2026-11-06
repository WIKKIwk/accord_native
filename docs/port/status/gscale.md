# gscale

Status: in progress
Stopped at: verify both platform views and their routes, including remaining shared navigation and device checks.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `modules/accord-gscale` | `SceneDelegate.swift`, `MainActivity.kt`, `network_candidates_io.dart`, `_connectLiveStreamOnce` | Build the native module and verify Bonjour/NSD, UDP discovery, monitor streaming, permissions and local HTTP on physical iOS and Android devices with a real scale/server. The Swift SSE parser was exercised against a local HTTP server; Android native code has not been compiled here. |
| `src/gscale/gscaleBluetoothDevices.ts` | `BluetoothPrinterList._load` | Android reads paired printers and iOS subscribes to discovery; both paths have a focused test and still need physical printer and permission checks. |
| `src/gscale/gscalePhotoSearchRuntime.ts` | `WerkaAiSearchService`, `werkaAiSearchSuggestion` | Camera/gallery selection, image preparation and the inferred query picker are implemented; verify photo permissions, image encoding and the live inference response on physical devices. No direct V2 HTTP recording was found. |
| `src/gscale/gscaleDiscovery.ts` | `gscale_mobile_app_helpers_part_10.dart` | V2 iOS additionally runs a Dart UDP fallback after its native UDP pass. Verify whether a second native pass is needed for equivalent results on physical devices. |
| `src/gscale/gscaleBatchApi.ts` | `mobile_api_gscale_declarations_part_01.dart` | Batch requests and response models have source-derived tests and are connected to operator state. No direct V2 HTTP recording was found for these methods; verify the complete flow against the baseline. |
| `src/gscale/gscaleAdminApi.ts` | `mobile_api_admin_items_MobileApiAdminItems_methods_01.dart`, `mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_01.dart` | The three catalog/order reads have source-derived tests; no direct V2 HTTP recordings were found. Verify the complete flow with the platform pickers. |
| `src/gscale/gscaleControlLogic.ts` | `gscale_mobile_app_helpers_part_07.dart`, `gscale_mobile_app_declarations_part_06.dart` | Quantity/weight gates and receipt-label conversion are connected to operator state; compare remaining actions and states with V2. |
| `src/gscale/gscaleBatchPrint.ts` | `_printActiveRsBatch` | Local preparation, physical printing and confirmation, including one EPC per label, are connected to the operator UI and require real-printer verification. |
| `src/gscale/gscaleBatchState.ts` | `_refreshRsBatchState`, `_applyRsBatchSession` | Stale batch reads, stopping and late ERP error handling are connected; refresh preserves the preparation conflict while it exists. |
| `src/gscale/gscalePreparation.ts` | `gscale_mobile_app_preparation_receipt.dart`, `_submitSimpleReceipt` | Formula preset matching, conflict guards and simple-receipt checks are connected; verify the complete flow on a device. |
| `src/gscale/gscaleDraft.ts` | `OperatorControlDraft`, `_loadControlDraftPreferences` | Draft persistence, restoration, debounce and preset loading are connected; verify account/order transitions in the full UI. |
| `src/gscale/gscaleArchive.ts`, `gscaleArchiveRuntime.ts` | `MobileArchiveSession`, `_reprintArchiveReceipt`, `buildMaterialBatchPrintPlan` | Batch aggregation, QR plans and receipt reprint identity checks are connected to the archive UI and both print transports; verify with a real printer. |
| `src/gscale/gscaleMonitor.ts` | `MonitorSnapshot.fromJson` | JavaScript JSON parsing does not retain whether a scale value was encoded as an integer or a decimal such as `2.0`; preserve that distinction if the exact displayed text must match V2. The snapshot and live stream are connected to the operator view. |
| `src/gscale/GScaleScreen.*.tsx` | `gscale_mode_screen.dart` | Compare remaining shell navigation and all platform states against V2 on real devices. |

## Deviations candidates

- `buildGScaleRpsBatchStartRequest` normalizes the Bluetooth printer value `xp-p323b` to `zebra` while retaining label mode. V4 preserves this V2 behaviour.
- `_printArchiveSession` treats a non-throwing local print response as success without inspecting its `ok` flag. V4 preserves this V2 behaviour.

## Test mode pending

GScale test-mode branches remain for the shared test-mode pass.

## Needs from the integrator

Preparation screens now have scale entry actions; both flattened iOS parameters and Android's wrapped `data` are parsed by the new routes. Shared role routing for GScale-only users and the material supplier's other screens, drawer and dock belong to the integrator.

The updated GScale skill uses its own reading list in place of a role-ledger gate; GScale is not a role.

## Verification at stop

- `node --test tests/*.test.cjs`: 957 passed, zero failed. The focused GScale suite has 94 passing tests; the previous stop recorded 923 total passes, including 80 GScale tests.
- iOS TypeScript and Expo lint passed. Android TypeScript reported the same 10 baseline errors listed in `PORT.md`, with no GScale errors.
- `port_ledger.mjs check` resolved 529 `@v2` and 62 `@v2-test` tags; seven endpoint warnings belong to other domains. The updated skill replaces the nonexistent `role gscale` gate with the GScale reading list.
- The three admin reads and photo inference request have focused source-derived tests; no direct V2 HTTP recordings were found. Route tests cover both flattened and wrapped preparation arguments.
- Drift reports V2 changes after baseline `7c87a54e`; this work continues to use the pinned baseline, which only the integrator may move.
- Expo autolinking found the module on both platforms. Swift UDP and monitor sources type-checked; the Swift monitor parser passed a local HTTP streaming check. Android native code has not been compiled here.
- No simulator, emulator, phone, scale or printer was used. Real-device validation remains open.
- Tokens read were not measured. V2 is pinned to baseline `7c87a54e`.

## Checkpoint commits

- `dadc8e0` port(gscale/1): native discovery, 3 channels
- `950e483` port(gscale/1): server discovery, 10 methods
- `7eadf01` port(gscale/1): catalog warehouse rules, 12 methods
- `bd075cf` port(gscale/1): RPS batch API, 9 methods
- `d47e97d` port(gscale/1): weighing and label rules, 16 methods
- `1374105` port(gscale/1): device and warehouse preferences, 9 methods
- `51dfbd6` port(gscale/1): monitor snapshot rules, 8 methods
- `d8ef17e` port(gscale/1): live scale monitor, 3 methods
- `fd57008` port(gscale/1): batch label execution, 1 method
- `b62480a` port(gscale/1): preparation receipt rules, 5 methods
- `94244d4` port(gscale/1): batch start validation, 1 method
- `713c40c` port(gscale/1): operator draft persistence, 3 methods
- `d6887a6` port(gscale/1): archive QR and reprints, 4 methods
- `db1d18f` port(gscale/1): batch authority state, 3 methods
- `1ce7655` port(gscale/1): route argument encoding, 1 method
- `5f9b4e4` port(gscale/1): device selection state, 5 methods
- `7c785f3` port(gscale/1): control enable rules, 1 method
- `e514a85` port(gscale/1): restore operator drafts, 1 method
- `e1a9bbf` port(gscale/1): order material picker, 2 methods
- `5d56cd4` port(gscale/1): operator state integration, 6 methods
- `248c4e0` port(gscale/1): operator runtime, 2 methods
- `ec924e0` port(gscale/1): order material prefill, 1 method
- `2ef5562` port(gscale/1): archive runtime, 5 methods
- `5acc147` port(gscale/1): order selection, 2 methods
- `16d81b1` port(gscale/1): printer status state, 1 method
- `2fac828` port(gscale/1): record verification and handoff
- `217bd0d` port(gscale/1): add UI contract
- `2e49b62` port(gscale/1): admin catalog and orders, 3 methods
- `264608f` port(gscale/1): connect catalog and order loaders
- `c751e0f` port(gscale/ios): dashboard and device pickers
- `1270f62` port(gscale/android): dashboard and device pickers
- `2da385a` port(gscale/1): photo search in item picker
- `3ab643d` port(gscale/1): platform Bluetooth discovery
- `a0bca5d` port(gscale/1): preserve batch conflict on refresh
