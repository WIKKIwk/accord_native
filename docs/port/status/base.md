# base

Status: parts 1 and 2 in progress
Stopped at: complete the remaining base logic, localization and V2 test comparisons listed below; then rerun both part gates.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader and sync | `PushMessagingService.unregisterCurrentToken`, `syncCurrentToken`, `FirebaseClientBootstrap` | The rest of logout is ported. Initialize native Firebase Messaging and register an FCM token reader after the user supplies Firebase configuration; connect push sync after account switches. |
| Base reading and tests | `.port/role-base-1.md`, `.port/role-base-2.md`, `.port/role-base-tests.md` | Finish comparison of the untagged declarations and unreplayed contract/logic cases. The role generator includes worker, inventory, preparation and qolip dependencies; compare already-existing implementations rather than copying them. Widget-only assertions belong to the platform contracts. |
| Platform screens and routes | `.port/role-base-1.md`, `.port/role-base-2.md` | Login, profile, PIN setup, welcome, account-switcher and update views/routes remain unchecked on iOS and Android. Their reviewed behavior and text keys are in `docs/port/roles/base.md`. |
| Localization | `core/localization/`, `UrduAwareText` | The generated four-locale catalog covers 408 getters, 24 direct parameterized methods, production/admin maps and recognized switch translations. Urdu literal and template lookup is also ported. Compare remaining conditional/derived methods and connect locale state and RTL to platform views, which still contain hard-coded Uzbek. |
| Application updates | `AppUpdateService`, `NativeAppUpdatePlatform`, `AppUpdateCoordinator` | Manifest and version-policy models are ported; native installer, update service/coordinator and platform dialogs remain to be connected. |
| Account switching | `createRuntimeAccountSwitchController`, `SecurityController` | Connect security unlock, the shared profile-switch PIN store and platform account-switcher views to the runtime controller. |
| Session reauthentication | `MobileApi._performStoredAccountReauthentication` | V4 rejects a refreshed account whose identity changes; V2 accepts the returned identity. Reconcile the existing identity guard for exact parity. |
| Transport | `MobileApi._get`, `_post`, `_put`, `_delete`, `_patch`, `resilientApiRead`, `SecureMobileApiClient` | The ten-second timer covers fetch until headers; V2 buffers the full response within its timeout. Connect the shared resilient GET helper at V2's opt-in call sites and verify redirect and sensitive-header handling. |
| Inventory live transport | `warehouse_live_client_io.dart`, `InventoryViewStore` | JS WebSocket does not expose V2’s 25-second protocol ping; verify native keepalive on both platforms. Platform entry points must configure foreground/background lifecycle. |
| Security lifecycle | `SecurityController`, `src/appLock.ts`, `WorkerSecurity` | Compare and connect the V2 privacy shield, resume lock and biometric flows; V4 currently uses different storage and UI components. |
| Native device behavior | `secure_account_storage`, `uploadAvatar`, `app_update` | Saved-account secure storage and avatar multipart upload have mock/source-derived tests but need native runtime verification; update installation needs a native bridge. |

## Deviations candidates

## Test mode pending

| V4 function | V2 symbol |
|---|---|
| `adminPrepareRawMaterialStockReprint`, `adminConfirmRawMaterialStockReprint` | Their in-memory stock matching, lock checks and confirmation branches. |
| `qolipPrintCodeQr` | Its in-memory qolip lookup and print job branch. |
| `gscaleItemsPage`, `adminWarehouseAssignments` | Their in-memory catalog and warehouse-assignment branches. |

## Test coverage notes

V2 has no recorded HTTP tests for `notificationDetail`, `addNotificationComment`, `supplierRespondUnannounced`, `adminConfirmRawMaterialStockReprint`, `qolipPrintCodeQr`, `gscaleItemsPage`, `adminWarehouseAssignments`, `updateNickname`, or `uploadAvatar`. Focused V4 tests assert their requests and source-derived parsing. `adminPrepareRawMaterialStockReprint` replays the V2 `qolip_tasks_test.dart` recording. Base tests also cover routing, saved-account switching, PIN, refresh, inventory windows, update models and transport.

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/LoginScreen.tsx` | `loginCodeUsesNumericKeyboard`, `loginFailureMessage`, `LoginScreen.submitLogin` | Use the shared prefix rule, localized transport/error messages and V2 login/back behavior in the platform-owned login views. |
| `src/profileNameUpdate.ts`, `src/profileAvatarUpload.ts` | `updateNickname`, `uploadAvatar` | Existing UI helpers impose additional validation and do not call the shared V2 API functions; reconcile them when profile UI is ported. |
| `src/workerControlsApi.ts` | `MobileApiException` | Reconcile the existing worker exception with `src/shared/mobileApiException.ts`, including V2 diagnostic fields and message formatting. |
| `src/workerRawMaterials.ts` | `resilientApiRead` | Route the V2 opt-in raw-material GETs through the shared retry helper, retaining their session guards. |
| `src/profileAvatarUpload.ts` and streamed uploads | `_sendMultipartAuthorized`, `_sendStreamedAuthorized` | Opt streamed/multipart calls out of the shared request timer where V2 has no per-request deadline. |
| `src/app/ios-worker/_layout.tsx` | `SecurityController.clearForLogout` | Clear the separate shared profile-switch PIN along with the app-lock PIN during iOS logout. |
| `src/app/android-worker/` | `AppSession.homeRoute` | Add the Android worker Expo Router route. Until then the existing Android worker screen renders at the root; base cannot create route files outside its scope. |
