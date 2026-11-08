# customer

Status: part 1 of 1 in progress
Stopped at: complete the shared timestamp ordering fix and Customer store checkpoint, then port the Customer APIs, screens, navigation and surface audit after the V2 baseline is pinned.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Shared dispatch timestamp ordering | `app_models_declarations_part_01.dart` `compareCreatedLabelsDesc` | V2 compares up to six fractional digits; the current shared comparator truncates to milliseconds. A focused shared fix is in progress before CustomerStore is committed. |
| Customer APIs and records | `mobile_api_customer.dart`, `app_models_declarations_part_05.dart` | Port the requests and parsers; reuse Supplier's forthcoming shared `dispatchRecordFromJson` rather than creating another parser. |
| Role surfaces and routing | `.port/role-customer.md`, `.port/text-customer.md` | Port Customer home, notifications, status and delivery detail on iOS and Android; connect Supplier's shared NotificationDetailScreen, existing profile and chat, and complete the text and surface audits. |
| Shared chat badge and push refresh | `role_dock.dart`, `customer_dock.dart`, `customer_store.dart` | Connect a shared live chat unread total and initialized push delivery; neither is established by this checkpoint. |
| Unicode trim edge | `customer_delivery_detail_screen__CustomerDeliveryDetailScreenState_methods_01.dart` `_parseQty`, `_showReturnDialog`; Dart `String.trim` documentation | Dart documents U+0085 trimming as system-dependent while JavaScript trim differs for that character. Verify behavior on the supported phones; ordinary whitespace and NBSP follow the existing repository conversion guidance. |
| Wider V2 pin | `docs/port/V2_BASELINE` | The repository baseline still points to 7c87a54; the integrator must resolve the complete drift before the rest of this role is implemented. |

## Baseline evidence

- `lib/src/core/api/customer/mobile_api_customer.dart` is byte-identical at V2 7c87a54 and f11910bb (blob `bef012db96c456b6e880b65207d70ceee213a72b`).
- `lib/src/features/shared/models/app_models_models_part_04.dart` is byte-identical at both commits (blob `5195b5f226bac05657aeb821d33c32cb7e9fc55f`), including the response-mode mapping.
- The diff for the two `customer_delivery_detail_screen` files adds only an `_applyStateChange` wrapper around `setState` and substitutes that wrapper at four calls. Quantity parsing, dialog enable rules, and the four response actions are unchanged between the commits.
- `lib/src/core/api/mobile_api.dart` differs only by removal of an unrelated `dart:math` import; the Customer transport helper definitions are otherwise unchanged. This checkpoint does not yet implement a Customer HTTP operation.

## Verification

- `node --test tests/customerLogic.test.cjs`: 4 passed. These are source-derived rule and request-body tests; no V2 Customer HTTP recording was found and no oracle was run.
- iOS typecheck and Expo lint passed after regenerating ignored Expo route types with an offline dev-server start; no simulator or device was used.
- Android typecheck reports the same nine pre-existing errors in `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`, with no Customer errors.

## Deviations candidates

None recorded by this checkpoint.

## Test mode pending

No Customer test-mode branch was identified in the inspected response methods.

## Needs from the integrator

- Resolve and pin the wider V2 drift before the remaining Customer work.
- Integrate the Supplier-owned shared NotificationDetailScreen and record parser once its checkpoint is ready.
