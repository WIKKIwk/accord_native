# base

Status: parts 1 and 2 in progress
Stopped at: shared API and base logic comparison

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader | `PushMessagingService.unregisterCurrentToken`, `logout` | Initialize Firebase Messaging on each native platform and register its FCM token reader. Firebase configuration must be supplied by the user. Logout otherwise remains ported. |

| Notifications | `mobile_api_supplier_notifications.dart` | V2 has no recorded HTTP tests for notification detail, comments, or unannounced responses; source-derived request and parsing tests are in `tests/baseNotificationApi.test.cjs`. |

| `adminConfirmRawMaterialStockReprint`, `qolipPrintCodeQr` | `mobile_api_admin_items_MobileApiAdminItems_methods_03.dart`, `mobile_api_qolip_MobileApiQolip_methods_04.dart` | V2 has no recorded HTTP test for these calls; source-derived request and response tests are in `tests/basePrintApi.test.cjs`. |

## Deviations candidates

## Test mode pending

| V4 function | V2 symbol |
|---|---|
| `adminPrepareRawMaterialStockReprint`, `adminConfirmRawMaterialStockReprint` | Their in-memory stock matching, lock checks and confirmation branches. |
| `qolipPrintCodeQr` | Its in-memory qolip lookup and print job branch. |

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/app/android-worker/` | `AppSession.homeRoute` | Add the Android worker Expo Router route. Until then the existing Android worker screen renders at the root; base cannot create route files outside its scope. |
