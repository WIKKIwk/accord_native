# customer

Status: part 1 of 1 in progress
Stopped at: connect CustomerStore to the Customer API and session lifecycle, then port the screens, navigation and surface audit after the V2 baseline is pinned.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Shared dispatch timestamp parsing edges | `app_models_declarations_part_01.dart` `compareCreatedLabelsDesc`; Dart `DateTime.parse` | The comparator now preserves six fractional digits, but extreme date/offset overflows and platform-local daylight-saving transitions remain unverified against Dart. The exported millisecond parser retains its prior behavior. |
| Customer APIs and records | `mobile_api_customer.dart`, `app_models_declarations_part_05.dart` | Port the requests and parsers; reuse Supplier's shared `dispatchRecordFromJson` checkpoint rather than creating another parser. |
| Customer store wiring | `customer_store.dart`, `app_runtime_reset.dart` | The source-derived store class is implemented but not yet connected to a real session, APIs or account reset. Verify that the application uses one store and clears its state on account change. |
| Timestamp ties | `customer_store.dart` `_mergeHistoryItems`, `customer_delivery_runtime_store.dart` `_sorted` | V2 Dart sorting does not guarantee tie order; JavaScript sorting is stable. Exact visible ordering of records with identical timestamps remains unverified. |
| Role surfaces and routing | `.port/role-customer.md`, `.port/text-customer.md` | Port Customer home, notifications, status and delivery detail on iOS and Android; connect Supplier's shared NotificationDetailScreen, existing profile and chat, and complete the text and surface audits. |
| Shared chat badge and push refresh | `role_dock.dart`, `customer_dock.dart`, `customer_store.dart` | Connect a shared live chat unread total and initialized push delivery; neither is established by this checkpoint. |
| Wider V2 pin | `docs/port/V2_BASELINE` | The repository baseline still points to 7c87a54; the integrator must resolve the complete drift before the rest of this role is implemented. |

## Baseline evidence

- `lib/src/core/api/customer/mobile_api_customer.dart` is byte-identical at V2 7c87a54 and f11910bb (blob `bef012db96c456b6e880b65207d70ceee213a72b`).
- `lib/src/features/customer/state/customer_store.dart` is byte-identical at both commits (blob `7b499b8a3d5a59c3d4b60e9bd350658ea9ef900c`); `lib/src/core/notifications/store/customer_delivery_runtime_store.dart` is also byte-identical (blob `5e1357676c76e9e2c988c4286a67209e61126d33`). The existing V4 runtime store is reused.
- `lib/src/features/shared/models/app_models_models_part_04.dart` is byte-identical at both commits (blob `5195b5f226bac05657aeb821d33c32cb7e9fc55f`), including the response-mode mapping.
- The diff for the two `customer_delivery_detail_screen` files adds only an `_applyStateChange` wrapper around `setState` and substitutes that wrapper at four calls. Quantity parsing, dialog enable rules, and the four response actions are unchanged between the commits. The installed Dart VM native string implementation includes U+0085 as whitespace; Customer input trimming covers it explicitly.
- `lib/src/core/api/mobile_api.dart` differs only by removal of an unrelated `dart:math` import; the Customer transport helper definitions are otherwise unchanged. This checkpoint does not yet implement a Customer HTTP operation.
- `lib/src/features/shared/models/app_models_declarations_part_01.dart` is byte-identical at both commits (blob `55a4dc08b96b01d1620188785249992e1e78e47f`); the installed Dart SDK documents and implements six-digit DateTime fractions. A source search found no worker or preparation imports/calls to the shared dispatch comparator or its runtime stores.

## Verification

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

- Resolve and pin the wider V2 drift before the remaining Customer work.
- Integrate the Supplier-owned shared NotificationDetailScreen and record parser once its checkpoint is ready.
