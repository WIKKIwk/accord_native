# supplier

Status: part 1 of 1 in progress
Stopped at: the baseline pin. Resume with the Supplier store, the shared notification-detail screen, role screens, navigation and audits after the integrator confirms the pin.

## Baseline-independent checkpoint

The live API methods `supplierHistory`, `supplierSummary`, `supplierStatusBreakdown`, `supplierStatusDetails`, `supplierItems` and `createDispatch` have source-derived request and parser tests. Their source, the Supplier store and runtime mutation store, and the relevant shared model declaration files have identical Git blob IDs at `7c87a54e78fa99eb89b7342101f6ec468ecf2e19` and `f11910bb2c8c7081ce26770e69811b03fd0739ed`:

| V2 path | Shared blob ID |
|---|---|
| `lib/src/core/api/supplier/mobile_api_supplier_notifications.dart` | `70ec1345017c8805b3d42fe0c6d3d8703908bc15` |
| `lib/src/features/supplier/state/supplier_store.dart` | `d7faff5e52050a132d4113062bc35e4d6f709bc1` |
| `lib/src/core/notifications/store/supplier_runtime_store.dart` | `58393ca5681cee12f9c1a31743127f9d189d3c8a` |
| `lib/src/features/shared/models/app_models_declarations_part_01.dart` | `55a4dc08b96b01d1620188785249992e1e78e47f` |
| `lib/src/features/shared/models/app_models_declarations_part_05.dart` | `83b6cfb0f0d1e6929f2d56f9e92d7aa02b17143d` |
| `lib/src/features/shared/models/app_models_declarations_part_08.dart` | `691faac9c83227d17a43a8c835cf08db2c263268` |
| `lib/src/features/shared/models/app_models_models_part_04.dart` | `5195b5f226bac05657aeb821d33c32cb7e9fc55f` |

`git diff 7c87a54..f11910bb` also showed no changes in the JSON decoder, `lib/src/core/network/`, `lib/src/core/session/`, `lib/src/core/api/auth/`, `lib/src/core/native_iroh_transport.dart`, `lib/src/core/test_mode/`, `pubspec.yaml` or `pubspec.lock`. The only change in `lib/src/core/api/mobile_api.dart` was removal of an unrelated `dart:math` import; its Supplier transport and authorization helpers were unchanged. Existing `authorizedFetch`, the shared `SupplierItem` and `DispatchRecord` decoders, and `SupplierRuntimeStore` are reused. The two previously private decoders are exposed without changing existing public signatures. Source reads for this checkpoint used the `f11910bb` Git object, not the live V2 tree.

There are no recorded V2 API or logic tests for this role. The six new tests in `tests/supplierApi.test.cjs` derive expectations from the source and are not V2 recordings. No oracle was run.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `supplierItems` | `mobile_api_supplier_notifications.dart:121-137` | Port the test-mode `TestModeDemoData.itemPage` branch in the deferred shared test-mode pass (D3). The current implementation covers live requests only and is deliberately not tagged complete. |
| `supplierSummaryFromJson`, `supplierStatusBreakdownEntryFromJson` | `app_models_models_part_04.dart:288-295,376-386` | JavaScript JSON parsing cannot distinguish an integer literal from `1.0` after parsing, whereas Dart's `as int?` rejects a double. Integers beyond JavaScript's safe range can also lose precision; verify or use a lossless decoder if these values occur. |
| `supplierItemFromJson` | `app_models_declarations_part_01.dart:209-228` | The existing shared parser uses JavaScript `String` for `customer_names` and apparatus-option values. Nested lists/maps and decimal lexical formatting can stringify differently from Dart's `toString`. Resolve without silently changing existing GScale behavior. |
| `createDispatch` and API errors | `mobile_api_supplier_notifications.dart:140-156`, `supplier_qty_screen.dart:84-101` | Non-finite quantities are rejected before sending, as Dart JSON encoding would reject them, but their exact visible exception text has not been verified. Malformed JSON and transport exception wording also needs comparison when the UI is ported. |
| Supplier store and 11 role surfaces | `.port/role-supplier-1.md` | Complete the store, reusable shared notification-detail screen, both platform views, navigation, text gate and surface audit. None has been implemented in this checkpoint. |
| Wire contract verification | `mobile_api_supplier_notifications.dart` | No V2 HTTP recordings were available. After the source baseline is safely pinned, record/replay any obtainable contracts and reconcile the source-derived tests; do not treat these tests as recordings. |

## Deviations candidates

None proposed in this checkpoint.

## Test mode pending

`supplierItems` delegates to V2 demo data in test mode. D3 defers that behavior; no demo data or fake behavior was added.

## Checks

- `node --test tests/supplierApi.test.cjs tests/baseNotificationApi.test.cjs tests/baseCatalogApi.test.cjs tests/baseDispatchRuntimeStores.test.cjs`: 17 passed.
- Full `node --test tests/*.test.cjs`: 1,115 passed, six failed in existing preparation Android tests because Node cannot resolve Expo UI's `jetpack-compose/modifiers/createModifier`; this matches the integrator's pre-existing failure set.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed.
- `npx tsc --noEmit -p tsconfig.android.json`: nine pre-existing errors in `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`; no Supplier errors.
- `npx expo lint`: passed. No simulator, emulator or device was used.

## Needs from the integrator

- Confirm the V2 baseline pin before any further role implementation, shared notification-detail work or oracle runs.
- The parser exports touch `src/shared/catalogApi.ts` and `src/shared/notificationApi.ts`; coordinate concurrent role merges in those shared files.
