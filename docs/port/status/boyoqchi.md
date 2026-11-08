# boyoqchi

Status: part 1 of 1 in progress
Stopped at: Both platform screens, role routes, form, Photos save and reused drawer/profile/chat are wired. Finish text and surface audit, resolve what can be fixed without changing protected roles, and run final gates.

## Baseline comparison evidence

Source Git objects `7c87a54e` and `f11910bb` were compared without modifying V2. These blobs are identical in both:

- `lib/src/core/api/boyoqchi/mobile_api_boyoqchi.dart`: `481c9ddafad44cd9b308a5e358db5b0a930ffbae`.
- `lib/src/features/boyoqchi/models/returned_paint_models.dart`: `836f887335ccae17d7e2bc5e834e4f8601aeefd2`.
- `lib/src/features/boyoqchi/presentation/widgets/returned_paint_sheet_helpers_part_01.dart`: `b26c659cd5e7d7315bcb4c0a4c38f452b62abe2e`.
- `lib/src/features/boyoqchi/presentation/widgets/returned_paint_sheet_helpers_part_02.dart`: `89fdd7e9b26737ad078e79a19e08d0b038ddccc7`.
- `lib/src/features/boyoqchi/state/returned_paint_draft_store.dart`: `c7a5397a30521743b6d604aa643bdc79b443fe59`.
- `lib/src/features/shared/models/app_models_declarations_part_01.dart`: `55a4dc08b96b01d1620188785249992e1e78e47f`.
- `lib/src/core/api/admin/mobile_api_admin_production_queue_runtime_declarations_part_01.dart`: `89a7324db79c3de0606c6595c3421db8e1d8ef24`.
- `lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_03.dart`: `ef12106f5b2fb2a798157c0bb11a3150962ee6ac` and its error helper `mobile_api_admin_production_map_helpers_part_02.dart`: `a051b1196f5d3928624361307f23ae0ba3a62add`.
- `lib/src/core/network/mobile_http_client.dart`: `c23ccb115f1e84b57812f7e261934a96241cf38d` and `api_transport_policy.dart`: `1e3c1ca364d1143142a359e88306578f34d09e63`.

`mobile_api.dart` changed only by removing an unused `dart:math` import. The two changed Boyoqchi widget files add `_applyStateChange` as a direct wrapper around `setState` and replace calls with that wrapper; constants, calculations and validation in scope are unchanged. Source-derived model and rule tests cover the V2 returned-paint model and draft tests. There is no V2 recorded HTTP contract for the role.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Numeric JSON | `ReturnedPaintItemInput.fromJson`, `ReturnedPaintCalculation.fromJson` | JS JSON parsing cannot recover whether a numeric token was `1` or `1.0` or represent every large integer. The current backend serializes these decimal fields as strings; compare legacy numeric payloads before parity is claimed. Integer-like map keys may also have a different iteration order. |
| Returned-paint draft persistence | `ReturnedPaintDraftStore` | Full image metadata, legacy migration, serialized writes and actor/request scope have focused tests using the new role-owned file adapter. Verify actual Expo filesystem behavior on iOS and Android phones. Worker draft behavior is unchanged. |
| Boyoqchi APIs | `.port/role-boyoqchi.md` | Image upload, delete and download live paths are implemented with focused source-derived tests but remain unchecked pending the training error and cross-origin items below. The unrestricted `returnedPaintImageHeaders` helper is not exposed. |
| Training image errors | `uploadTrainingReturnedPaintImage`, `deleteTrainingReturnedPaintImage`, `_adminProductionMapException` | The existing shared production-map error helper is incomplete relative to V2. Resolve its full mapping before marking the training-image paths and callers complete; do not change the protected worker file in this role. |
| Image origin | `returnedPaintImageUrl`, `downloadReturnedPaintImage` | V2 attaches bearer headers even to absolute external URLs; the existing native transport restricts authenticated requests to the server origin. Do not weaken credential protection; confirm required cross-origin behavior. |
| Palette | `returned_paint_sheet.dart:175-231`, `returned_paint_sheet__ReturnedPaintSheetState_methods_01.dart:85-120` | The reused Worker palette does not expose filled/partial indicators; its iOS fallback omits the three category headings, and its tab control does not support V2's horizontal swipe. Do not modify the protected Worker component as part of this role. |
| Request cards | `boyoqchi_home_screen_widgets_part_01.dart:161-180`, `boyoqchi_astatka_screen.dart:209-228` | The reused `WorkerExpansion` does not expose V2's two-line title limit or animated expansion arrow. Check long titles and expansion on a phone; changing the protected component is outside this role. |
| Sheet dismissal | `returned_paint_sheet.dart:240`, `src/components/WorkerOrderSheet.android.tsx` | A hardware-back handler and non-dismissible sheet option are set during saving, but the shared Android sheet always sets native `shouldDismissOnBackPress`; verify and resolve on a phone without changing Worker behavior. |
| iOS photo save | `returned_paint_sheet_helpers_part_01.dart:279-300`; `app.json` | Integrator commit `c678e86` adds the V2 photo-add purpose string. The save action requests write-only access through SDK 58; a fresh development binary and real-phone permission test are required. |
| iOS chat dock | `chat_role_dock.dart`, `boyoqchi_dock.dart` | Existing shared Chat screens are reused. The iOS Chat list is outside the native tab navigator and currently lacks the Home/Astatka/Profile dock that V2 shows there. |
| Native surface verification | `BoyoqchiHomeScreen`, `BoyoqchiAstatkaScreen`, `ReturnedPaintSheet` | Both Expo platform bundles compile, but no real phone was used. Verify navigation, gestures, images, local draft persistence, saving and accessibility in light/dark modes. |
| Text gate | `port_ledger.mjs` `scopeFiles` | After 26 evidence-backed exceptions, iOS reports two missing V2 strings (deferred test-mode error and the iOS palette heading) and 47 unrelated V4 strings; Android reports one missing test-mode error and 57 unrelated V4 strings. Unqualified `_refresh` and `_orderLabel` tags incorrectly bring GScale and Preparation folders into the scan. Fix scope without modifying protected roles; do not treat the gate as passed. |

## Deviations candidates

- None accepted in this checkpoint.

## Test mode pending

- The V2 returned-paint API has test-mode branches; test mode remains deferred to the shared final pass.

## Needs from the integrator

- Reconcile protected Worker `OrderScreen.tsx` returned-image/draft differences separately.

## Checkpoint verification

- `v2_oracle.sh test/returned_paint_models_test.dart test/returned_paint_draft_store_test.dart test/boyoqchi_astatka_screen_test.dart` against isolated `f11910bb`: 10 passed. The oracle uses a temporary export, not a device.
- `node --test tests/boyoqchi*.test.cjs`: 33 passed, 0 failed. Cases are source-derived; no V2 HTTP fixture exists for these requests. Request tests include the existing same-origin authenticated transport; filesystem and Photos permission tests use mocks, not a device or real permission grant.
- Earlier `node --test tests/*.test.cjs`: 1,142 passed, 6 failed. The six known Preparation Android tests fail because Node cannot resolve Expo UI's `jetpack-compose/modifiers/createModifier` ESM import; no Boyoqchi test failed. Repeat after the shared Chat merge.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed after Expo regenerated ignored `.expo/types/router.d.ts` using an offline local Metro session. No simulator or device was started.
- `npx tsc --noEmit -p tsconfig.android.json`: 9 existing errors, all in protected `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`; no new Boyoqchi errors.
- `npx expo lint`: passed.
- `CI=1 EXPO_OFFLINE=1 npx expo export --platform ios` and `--platform android`: both bundled successfully. Bundling does not verify runtime behavior.
- `node .agents/skills/accord-port/scripts/port_ledger.mjs check`: passed with 8 repository-wide endpoint warnings outside this checkpoint.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `BoyoqchiHomeScreen`, `boyoqchi_home_screen_widgets_part_01.dart` | `BoyoqchiScreen.*`, `BoyoqchiRequestContent.tsx` | partial | partial | Loading, empty, refresh, expansion, grouped data and catalog fallback are implemented; no phone run. |
| `BoyoqchiAstatkaScreen`, `boyoqchi_astatka_screen.dart` | `BoyoqchiScreen.*`, `BoyoqchiRequestContent.tsx`, `BoyoqchiImage.tsx` | partial | partial | Waiting/calculation/image flows are implemented; iOS photo-add config and phone verification remain. |
| `ReturnedPaintSheet`, `returned_paint_sheet.dart` | `BoyoqchiForm.*`, `BoyoqchiFormContent.tsx` | partial | partial | Reused palette lacks indicators and tab swipe; iOS also lacks category headings. Saving/back guard needs phone validation. |
| Named field `AlertDialog`, `returned_paint_sheet__ReturnedPaintSheetState_methods_01.dart:154-235` | `BoyoqchiFormContent.tsx` | partial | partial | Dialog, values, duplicate rule, cancel/add and order are implemented; presentation and keyboard need phone verification. |
| Image-preview dialog and download snackbars, `returned_paint_sheet_helpers_part_01.dart:236-354` | `BoyoqchiImage.tsx`, `returnedPaintPhoto.ts` | partial | partial | Fullscreen preview, zoom and save with success/error messages exist; foreign-auth URLs stay restricted, and gesture, permission and gallery behavior need a phone. |
| Image-source picker, `returned_paint_sheet__ReturnedPaintSheetState_methods_01.dart:240` | Not shown on Boyoqchi sheet | n/a | n/a | V2 opens it only when `allowImageEditing` is true; Astatka constructs the sheet with the default false (`boyoqchi_astatka_screen.dart:89-98`). |
| `PopScope`, `returned_paint_sheet.dart:240` | `BoyoqchiFormContent.tsx`, `useReturnedPaintForm.tsx` | partial | partial | Swipe/outside dismissal is disabled while saving; Android hardware-back handling of the shared sheet needs phone validation. |
| `BoyoqchiNavigationDrawer`, `boyoqchi_navigation_drawer.dart` | `BoyoqchiDrawer.tsx` | partial | partial | Uses the existing role drawer, shared logout prompt and exact destinations; replacement behavior needs a phone. |
| `BoyoqchiDock`, `boyoqchi_dock.dart`; `ChatRoleDock`, `chat_role_dock.dart` | NativeTabs, `BoyoqchiDock.android.tsx`, role chat routes | partial | partial | Home/Astatka/Profile destinations are present. The iOS Chat list lacks this dock; Android chat list reuses the role dock. |
