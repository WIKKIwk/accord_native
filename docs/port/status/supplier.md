# supplier

Status: part 1 of 1 in progress
Stopped at: connecting the Supplier store and shared detail into role routes, followed by role screens, navigation and audits.

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

There are no recorded V2 API or logic tests for this role. The seven tests in `tests/supplierApi.test.cjs` derive expectations from the source and are not V2 recordings. No API oracle or recording was available.

The reusable detail interface is `NotificationDetailScreenProps` in `src/shared/notification/notificationDetailTypes.ts`: `session`, `receiptId`, `onBack`, `onCustomerDetail(receiptId)`, `onWerkaDetail(record)`, `onForeignReceipt(message)` and optional `footer`. The role route owns the back action, cross-role destinations, its dock, and popping/showing the supplied foreign-receipt snackbar. `NotificationDetailScreen.ios.tsx` and `.android.tsx` expose the same interface; role integration is still pending.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `supplierItems` | `mobile_api_supplier_notifications.dart:121-137` | Port the test-mode `TestModeDemoData.itemPage` branch in the deferred shared test-mode pass (D3). The tagged method currently covers live requests only. |
| `supplierSummaryFromJson`, `supplierStatusBreakdownEntryFromJson` | `app_models_models_part_04.dart:288-295,376-386` | JavaScript JSON parsing cannot distinguish an integer literal from `1.0` after parsing, whereas Dart's `as int?` rejects a double. Integers beyond JavaScript's safe range can also lose precision; verify or use a lossless decoder if these values occur. |
| `supplierItemFromJson` | `app_models_declarations_part_01.dart:209-228` | The existing shared parser uses JavaScript `String` for `customer_names` and apparatus-option values. Nested lists/maps and decimal lexical formatting can stringify differently from Dart's `toString`. Resolve without silently changing existing GScale behavior. |
| `createDispatch` and API errors | `mobile_api_supplier_notifications.dart:140-156`, `supplier_qty_screen.dart:84-101` | Non-finite quantities are rejected before sending, as Dart JSON encoding would reject them, but their exact visible exception text has not been verified. Malformed JSON and transport exception wording also needs comparison when the UI is ported. |
| Supplier store and role surfaces | `supplier_store.dart`, `.port/role-supplier-1.md` | `SupplierStore`, create and notification controllers, create-flow, home, recent and status views exist, but need session lifecycle and route wiring. Complete notification views, navigation, text gate and surface audit. Shared detail views are also not yet connected to role routes. |
| Shared notification detail on iOS | `notification_detail_screen__NotificationDetailScreenState_methods_01.dart:35-112` | V2 confirmation dialogs can be dismissed by tapping outside. The reused native iOS `WorkerAlert` dismissal behavior has not been established on a real phone; verify and replace or adapt the dialog if needed. |
| Wire contract verification | `mobile_api_supplier_notifications.dart` | No V2 HTTP recordings were available. After the source baseline is safely pinned, record/replay any obtainable contracts and reconcile the source-derived tests; do not treat these tests as recordings. |

## Deviations candidates

None proposed in this checkpoint.

## Test mode pending

`supplierItems` delegates to V2 demo data in test mode. D3 defers that behavior; no demo data or fake behavior was added.

## Checks

- An isolated, clean snapshot at `f11910bb2c8c7081ce26770e69811b03fd0739ed` was used for the role/text ledger and V2 oracle. `test/supplier_confirm_screen_test.dart` passed its single widget test; Flutter warned the second tap could not hit the disabled button. Neither the source checkout nor snapshot was changed. There are no Supplier contract tests to record.
- `node --test tests/supplierNotificationDetail.test.cjs tests/baseNotificationApi.test.cjs`: 12 passed. Source-derived tests cover shared detail routing, permission rules, unread marking, comment and acknowledgment actions, Supplier response mutations and stale reads. The platform-file checks are structural, not device interaction tests; none are V2 recordings.
- `node --test tests/supplierStore.test.cjs tests/baseDispatchRuntimeStores.test.cjs tests/supplierApi.test.cjs`: 17 passed. These source-derived tests cover summary fallback, runtime deltas, cached/forced loads, single-flight behavior, error retention and Dart-trimmed detail keys.
- `node --test tests/supplierScreenModel.test.cjs tests/supplierStore.test.cjs tests/supplierApi.test.cjs`: 16 passed. A temporary f119 Flutter oracle printed Dart parse results for quantity edge cases; the Node tests assert those observations. The temporary oracle case only printed values and was not a pre-existing V2 test.
- `node --test tests/supplierCreateController.test.cjs tests/supplierScreenModel.test.cjs tests/supplierApi.test.cjs`: 15 passed. The repeated-submission rule follows the f119 V2 widget test, including staying busy until the success page returns; picker tests cover errors, local filtering and stale requests.
- `node --test tests/supplierCreateViews.test.cjs tests/supplierCreateController.test.cjs tests/supplierScreenModel.test.cjs tests/supplierApi.test.cjs`: 16 passed. Create-flow views reuse the existing native list, row, header and notice components. The platform source-structure check is not a device interaction test; route transitions and native input behavior remain unverified.
- `node --test tests/supplierOverviewViews.test.cjs tests/supplierScreenModel.test.cjs tests/supplierStore.test.cjs`: 10 passed. The overview views use existing native list/row/header components. The platform source-structure check does not replace device interaction testing.
- `node --test tests/supplierNotificationsController.test.cjs tests/baseNotificationStores.test.cjs tests/supplierStore.test.cjs`: 12 passed. The controller reuses the shared hidden/unread stores and covers unread-first ordering, retention, clear-all and mark-seen-before-open.
- Supplier whitespace follow-up: Dart VM `String.trim`'s documented Unicode whitespace set plus BOM, including U+0085, is used only to decide whether a query exists; a nonempty query is sent unchanged. Source: the installed Dart SDK's `lib/core/string.dart` and `lib/_internal/vm/lib/string_patch.dart`. Focused regression tests cover all listed whitespace code points, mixed whitespace, preserved nonempty query text and non-whitespace near neighbors.
- `node --test tests/supplierApi.test.cjs tests/baseNotificationApi.test.cjs tests/baseCatalogApi.test.cjs tests/baseDispatchRuntimeStores.test.cjs`: 18 passed after the whitespace follow-up.
- Full `node --test tests/*.test.cjs`: 1,115 passed, six failed in existing preparation Android tests because Node cannot resolve Expo UI's `jetpack-compose/modifiers/createModifier`; this matches the integrator's pre-existing failure set. This full run preceded the whitespace follow-up.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed.
- `npx tsc --noEmit -p tsconfig.android.json`: nine pre-existing errors in `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`; no Supplier errors in the detail-view check.
- `npx expo lint`: passed after the detail-view check. No simulator, emulator or device was used.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `NotificationDetailScreen`, `notification_detail_screen.dart` and its parts | `src/shared/notification/NotificationDetailScreen.*.tsx` | partial | partial | Both views and source-derived rule tests exist, but role routing, foreign-receipt snackbar handoff, real-phone interaction and native confirmation dismissal still need verification. API exception wording is an open item above. |
| Picker, quantity, confirmation and success, `supplier_*_screen.dart` | `src/supplier/SupplierCreateScreens.*.tsx` | partial | partial | Both native views and controllers exist. Route wiring, repeated-navigation behavior and real-phone input/keyboard interactions remain to verify. |
| Home, recent, breakdown, category and status detail, `supplier_*_screen.dart` | `src/supplier/SupplierOverviewScreens.*.tsx` | partial | partial | Both native views exist with source-derived filtering and status rules. Session/route wiring, lifecycle refresh and on-phone rendering remain to verify. |

## Needs from the integrator

- Supplier's Android unread badge will reuse the optional `RoleNavigationItem.showBadge` extension committed in Customer branch `a001d4e`; integrate that shared change before the Supplier dock is finalized.
- The Supplier dock also inherits V2 `RoleDock`'s shared Chat destination and unread dot. The Chat unread hook/read bridge in Chat branch `bdf4fc6` is pending integrator review and integration; do not substitute a fixed count.
- The parser exports touch `src/shared/catalogApi.ts` and `src/shared/notificationApi.ts`; coordinate concurrent role merges in those shared files.
