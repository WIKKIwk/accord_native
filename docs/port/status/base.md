# base

Status: parts 1 and 2 in progress
Stopped at: shared API and base logic comparison

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader | `PushMessagingService.unregisterCurrentToken`, `logout` | Initialize Firebase Messaging on each native platform and register its FCM token reader. Firebase configuration must be supplied by the user. Logout otherwise remains ported. |

| Notifications | `mobile_api_supplier_notifications.dart` | V2 has no recorded HTTP tests for notification detail, comments, or unannounced responses; source-derived request and parsing tests are in `tests/baseNotificationApi.test.cjs`. |

| `adminConfirmRawMaterialStockReprint`, `qolipPrintCodeQr` | `mobile_api_admin_items_MobileApiAdminItems_methods_03.dart`, `mobile_api_qolip_MobileApiQolip_methods_04.dart` | V2 has no recorded HTTP test for these calls; source-derived request and response tests are in `tests/basePrintApi.test.cjs`. |

| `gscaleItemsPage`, `adminWarehouseAssignments` | `mobile_api_gscale_declarations_part_01.dart`, `mobile_api_admin_items_MobileApiAdminItems_methods_03.dart` | V2 has no recorded HTTP test for these calls; source-derived request, parsing and account-scoped sorting tests are in `tests/baseCatalogApi.test.cjs`. |

| `updateNickname`, `uploadAvatar` | `mobile_api_auth_profile.dart` | No V2 HTTP recording exists; source-derived tests cover nickname, multipart bytes, response status and session update. Device upload still needs a native runtime check. |

| Account switching runtime | `createRuntimeAccountSwitchController`, `SecurityController.saveSwitchPinForCurrentUser` | Connect Firebase push synchronization, security unlock, the shared separate profile-switch PIN store and the platform account-switcher views to the account controller. |

| Application updates | `AppUpdateService`, `NativeAppUpdatePlatform`, `AppUpdateCoordinator` | Manifest and version-policy models are ported; the native installer channel, update service/coordinator and platform dialogs are not yet connected. |

| Transport response bodies | `MobileApi._get`, `_post`, `_put`, `_delete`, `_patch` | The shared ten-second timer covers fetch until response headers; V2 buffers the full response within its timeout. Complete response-body deadlines; `resilientApiRead` is available but its V2 opt-in callers still need to use it. |

| Reauthentication identity | `MobileApi._performStoredAccountReauthentication` | V4 rejects a refreshed account whose identity changes; V2 accepts the returned account. Reconcile this existing guard for exact parity. |

## Deviations candidates

## Test mode pending

| V4 function | V2 symbol |
|---|---|
| `adminPrepareRawMaterialStockReprint`, `adminConfirmRawMaterialStockReprint` | Their in-memory stock matching, lock checks and confirmation branches. |
| `qolipPrintCodeQr` | Its in-memory qolip lookup and print job branch. |
| `gscaleItemsPage`, `adminWarehouseAssignments` | Their in-memory catalog and warehouse-assignment branches. |

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/LoginScreen.tsx` | `loginCodeUsesNumericKeyboard`, `loginFailureMessage`, `LoginScreen.submitLogin` | Use the shared prefix rule for the keyboard, port localized transport/error messages and match V2 login/back behavior in the platform-owned login views. |
| `src/profileNameUpdate.ts`, `src/profileAvatarUpload.ts` | `updateNickname`, `uploadAvatar` | Existing profile UI helpers impose additional validation and do not call the shared V2 API functions; reconcile those helpers and their platform screens when profile UI is ported. |
| `src/workerRawMaterials.ts` | `resilientApiRead` | Route the V2 opt-in raw-material GETs through the shared retry helper, retaining the caller session guards. |
| `src/profileAvatarUpload.ts` and streamed uploads | `_sendMultipartAuthorized`, `_sendStreamedAuthorized` | Opt streamed/multipart calls out of the default request timer where V2 has no per-request deadline. |
| `src/app/ios-worker/_layout.tsx` | `SecurityController.clearForLogout` | Clear the separate shared profile-switch PIN along with the app-lock PIN during iOS logout. |
| `src/app/android-worker/` | `AppSession.homeRoute` | Add the Android worker Expo Router route. Until then the existing Android worker screen renders at the root; base cannot create route files outside its scope. |
