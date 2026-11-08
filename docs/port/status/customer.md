# customer

Status: part 1 of 1 in progress
Stopped at: connect CustomerStore to the Customer API and session lifecycle, then port the Customer screens, navigation and surface audit on both platforms.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Shared dispatch timestamp parsing edges | `app_models_declarations_part_01.dart` `compareCreatedLabelsDesc`; Dart `DateTime.parse` | The comparator now preserves six fractional digits, but extreme date/offset overflows and platform-local daylight-saving transitions remain unverified against Dart. The exported millisecond parser retains its prior behavior. |
| Customer summary integer precision | `app_models_models_part_04.dart` `CustomerHomeSummary.fromJson` | V2 accepts signed 64-bit integer counts. JavaScript cannot represent all of them exactly; the current decoder rejects counts outside its safe-integer range instead of silently rounding. |
| Shared dispatch status trim | `app_models_declarations_part_08.dart` `parseDispatchStatus`; `src/shared/notificationApi.ts` | Customer calls normalize native Dart U+0085 whitespace before using the unchanged shared parser. Other consumers of the shared parser still differ for that edge and need an integrator-owned fix. |
| Large Customer status lists | `json_payload_decoder.dart` `decodeJsonListPayload` | V2 decodes lists of at least 128 KiB in a background isolate. The React Native path currently decodes on the JavaScript thread; assess responsiveness on a real phone with a representative large payload. |
| Customer session wiring | `customer_store.dart`, `app_runtime_reset.dart` | A role context now binds one store and notifications controller to the current session and registers their reset path. Role routes and real-device account-switch verification remain open. |
| In-flight refresh at account reset | `customer_store.dart` `clear`, `refresh` | V2 clears its singleton without explicitly cancelling an already pending refresh. Confirm whether an old response can update shared runtime state after an account switch before declaring that lifecycle fully audited. |
| Timestamp ties | `customer_store.dart` `_mergeHistoryItems`, `customer_delivery_runtime_store.dart` `_sorted` | V2 Dart sorting does not guarantee tie order; JavaScript sorting is stable. Exact visible ordering of records with identical timestamps remains unverified. |
| Role surfaces and routing | `.port/role-customer.md`, `.port/text-customer.md` | Home, status and notifications content now have iOS and Android views, but routes, shells, delivery view, shared NotificationDetailScreen integration, text and surface audits remain open. |
| Shared chat badge and push refresh | `role_dock.dart`, `customer_dock.dart`, `customer_store.dart` | Connect a shared live chat unread total and initialized push delivery; neither is established by this checkpoint. |

## Baseline evidence

- Main baseline alignment `dad5041` was merged into the Customer branch; the role-local V2 snapshot and original V2 checkout were verified clean at `f11910bb2c8c7081ce26770e69811b03fd0739ed` before and after the ledger run. A zero-drift result after pinning is not evidence that historical drift in other roles was ported.

- `lib/src/core/api/customer/mobile_api_customer.dart` is byte-identical at V2 7c87a54 and f11910bb (blob `bef012db96c456b6e880b65207d70ceee213a72b`). The four role-ledger methods are now source-ported. `customerHistory` is not included: a pinned-source search found no call sites and the Customer store merges the three status lists instead.
- `lib/src/features/customer/state/customer_store.dart` is byte-identical at both commits (blob `7b499b8a3d5a59c3d4b60e9bd350658ea9ef900c`); `lib/src/core/notifications/store/customer_delivery_runtime_store.dart` is also byte-identical (blob `5e1357676c76e9e2c988c4286a67209e61126d33`). The existing V4 runtime store is reused.
- `lib/src/features/shared/models/app_models_models_part_04.dart` is byte-identical at both commits (blob `5195b5f226bac05657aeb821d33c32cb7e9fc55f`), including the response-mode mapping.
- The diff for the two `customer_delivery_detail_screen` files adds only an `_applyStateChange` wrapper around `setState` and substitutes that wrapper at four calls. Quantity parsing, dialog enable rules, and the four response actions are unchanged between the commits. The installed Dart VM native string implementation includes U+0085 as whitespace; Customer input trimming covers it explicitly.
- `lib/src/core/api/mobile_api.dart` differs only by removal of an unrelated `dart:math` import; Customer transport helper definitions are otherwise unchanged. `json_payload_decoder.dart`, `mobile_http_client.dart`, `api_transport_policy.dart`, `server_endpoint_store.dart`, `session.dart`, and `saved_account_runtime.dart` are byte-identical across the two pins. The API reuses `authorizedFetch`; existing shared transport and device-verification limitations remain in `PORT.md`.
- The shared record model file is byte-identical across both commits (blob `83b6cfb0f0d1e6929f2d56f9e92d7aa02b17143d`), and the dispatch status parser file is byte-identical (blob `691faac9c83227d17a43a8c835cf08db2c263268`).
- `lib/src/features/shared/models/app_models_declarations_part_01.dart` is byte-identical at both commits (blob `55a4dc08b96b01d1620188785249992e1e78e47f`); the installed Dart SDK documents and implements six-digit DateTime fractions. A source search found no worker or preparation imports/calls to the shared dispatch comparator or its runtime stores.

## Verification

- Customer notification content: `tests/customerNotificationViews.test.cjs` and `tests/customerNotifications.test.cjs` passed 10 tests for loading, retry, empty, unread highlight, mark-seen-before-open and clear confirmation. iOS typecheck and lint passed; Android retained the nine existing worker errors. Views are not routed or device-tested.

- Customer home and status content: `tests/customerHomeViews.test.cjs` and `tests/customerPresentation.test.cjs` passed 6 source-derived tests across both platform implementations. iOS typecheck and Expo lint passed; Android retained the same nine pre-existing worker errors. These views are not routed or device-tested yet.

- `tests/customerPresentation.test.cjs`: 2 source-derived tests passed for status order, quantities, note visibility and notification fallback text. iOS typecheck passed.

- Customer context and session binding: `tests/customerRuntime.test.cjs`, the store lifecycle and notification controller tests passed. iOS typecheck passed. The new provider is not yet mounted in routes.

- Customer notifications/controller checkpoint: 15 focused tests passed for cache, hidden/unread ordering, clear/seen behavior, refresh coalescing, reset write ordering and store lifecycle. The role routes do not yet mount the controller.

- f119 V2 oracle: `test/customer_delivery_runtime_store_test.dart` passed 1 test from a temporary export; no contract fixture was written. Both the original V2 checkout and the isolated snapshot stayed clean at the selected SHA. The role ledger found no Customer HTTP contract tests.
- Customer UI contract is recorded in `docs/port/roles/customer.md`; it lists source screens, state, actions, texts and shared dependencies and is not a parity claim.

- Shared Android bottom bar adds optional `RoleNavigationItem.showBadge`; when absent or false the existing icon, labels, selection and interaction stay unchanged. `node --test tests/customerRoleBottomBar.test.cjs`: 2 passed. Android typecheck has the same nine pre-existing worker errors; no worker or preparation file was edited.

- Customer API checkpoint: `node --test tests/customerApi.test.cjs tests/customerLogic.test.cjs tests/customerStore.test.cjs tests/customerDispatchTimestamp.test.cjs tests/baseNotificationApi.test.cjs tests/baseDispatchRuntimeStores.test.cjs` passed 32 tests. These cover all four source-derived request paths, parameters, bodies, status handling and parsing; no V2 Customer HTTP recording was found. The Supplier parser file remains byte-identical to its checkpoint. iOS typecheck and Expo lint passed; Android retained the same nine pre-existing worker errors.

- Supplier dependency: `src/shared/notificationApi.ts` matches Supplier commit `a947a1a46ff32a8afb0be3e6d25da8a71afa355c` byte-for-byte. Existing notification/runtime tests passed 8/8; 66 source-derived mock outcomes matched the original notification API, including malformed data and non-200 responses. iOS typecheck passed.

- `node --test tests/customerStore.test.cjs`: 7 passed. Tests cover bootstrap, forced refresh, all four requests, non-eager failure timing, ordering, runtime transitions, failure recovery and clear. No direct V2 CustomerStore recording was found.

- `node --test tests/customerDispatchTimestamp.test.cjs tests/baseDispatchRuntimeStores.test.cjs`: 11 passed, including fractional precision, equivalent offsets, negative epochs, equal values, parse failures and the DateTime upper boundary. The existing public millisecond parser still returns the same result for the covered cases.
- `node --test tests/customerLogic.test.cjs`: 5 passed, including native Dart U+0085 trimming for quantity, reason and comment. These are source-derived rule and request-body tests; no V2 Customer HTTP recording was found and no oracle was run.
- iOS typecheck and Expo lint passed after regenerating ignored Expo route types with an offline dev-server start; no simulator or device was used.
- Android typecheck reports the same nine pre-existing errors in `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`, with no Customer errors.

## Deviations candidates

None recorded by this checkpoint.

## Test mode pending

No Customer test-mode branch was identified in the inspected response methods.

## Needs from the integrator

- Integrate Supplier's shared NotificationDetailScreen when its checkpoint is ready. The record parser extraction in this branch is byte-identical to Supplier's checkpoint and will need its identical shared diff reconciled on merge.
