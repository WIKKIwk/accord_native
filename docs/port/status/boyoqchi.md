# boyoqchi

Status: part 1 of 1 in progress
Stopped at: Both platform screens, role routes, form, Photos save and reused drawer/profile/chat are wired. The requested local work and gates have been run; independent review and the open items below remain.

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
| Numeric display | `boyoqchi_home_screen_helpers_part_02.dart:102-110` | JavaScript `toFixed` and Dart `toStringAsFixed`, and their rendering of very large integer values, need a cross-runtime comparison at rounding boundaries before exact formatting parity is claimed. |
| Returned-paint draft persistence | `returned_paint_draft_store.dart:191-214`; Expo FileSystem 58.0.13 `ios/FileSystemPath.swift` and Android `fsops/CopyMoveStrategy.kt` | Both SDK platforms can delete the destination before an overwrite move. Before replacement, the role adapter copies the last primary to a private scope-specific backup; when the primary is absent it reads that backup, and a successful clear removes backup before primary and temp. Mock tests cover the delete-then-fail window, restart, repeated writes and clear. This is not a full crash-atomicity guarantee: existing-but-corrupt or partially created primaries are not detected, copy durability after power loss is unproven, and the first clear after a rejected queued write propagates that failure as V2 does and must be retried. Verify on both phones. Worker draft behavior is unchanged. |
| Boyoqchi APIs | `.port/role-boyoqchi.md` | Image upload, delete and download live paths are implemented with focused source-derived tests but remain unchecked pending the training error and cross-origin items below. The unrestricted `returnedPaintImageHeaders` helper is not exposed. |
| Training image errors | `uploadTrainingReturnedPaintImage`, `deleteTrainingReturnedPaintImage`, `_adminProductionMapException` | The existing shared production-map error helper is incomplete relative to V2. Resolve its full mapping before marking the training-image paths and callers complete; do not change the protected worker file in this role. |
| Image origin | `returnedPaintImageUrl`, `downloadReturnedPaintImage` | V2 attaches bearer headers even to absolute external URLs; the existing native transport restricts authenticated requests to the server origin. Do not weaken credential protection; confirm required cross-origin behavior. |
| Palette | `returned_paint_sheet.dart:175-231`, `returned_paint_sheet__ReturnedPaintSheetState_methods_01.dart:85-120` | The reused Worker palette does not expose filled/partial indicators; its iOS fallback omits the three category headings, and its tab control does not support V2's horizontal swipe. Do not modify the protected Worker component as part of this role. |
| Request cards | `boyoqchi_home_screen_widgets_part_01.dart:161-180`, `boyoqchi_astatka_screen.dart:209-228` | The reused `WorkerExpansion` does not expose V2's two-line title limit or animated expansion arrow. Check long titles and expansion on a phone; changing the protected component is outside this role. |
| Sheet dismissal | `returned_paint_sheet.dart:240`, `src/components/WorkerOrderSheet.android.tsx` | A hardware-back handler and non-dismissible sheet option are set during saving, but the shared Android sheet always sets native `shouldDismissOnBackPress`; verify and resolve on a phone without changing Worker behavior. |
| iOS photo save | `returned_paint_sheet_helpers_part_01.dart:279-300`; `app.json` | Integrator commit `c678e86` adds the V2 photo-add purpose string. The save action requests write-only access through SDK 58; a fresh development binary and real-phone permission test are required. |
| Photo filename | `returned_paint_sheet_helpers_part_01.dart:379-381` | V2 passes the trimmed image name through, whereas the native temporary-file adapter strips path components and control characters and substitutes a safe fallback for `.` or `..`. Check unusual server filenames without weakening file-path safety. |
| Chat unread dot and surfaces | `role_dock.dart`, `chat_role_dock.dart`, `boyoqchi_dock.dart` | Both docks include the fourth Chat destination and use the shared unread runtime for a dot. Shared Chat remains partial as detailed in `status/chat.md`; badge, lifecycle and conversation behavior require backend/device validation. |
| Profile drawer and Android dock history | `profile_screen__ProfileScreenState_methods_02.dart:117-122`, `boyoqchi_dock.dart`, `app_root_navigation.dart` | V2 pops to an existing destination or pushes an absent one. Expo Router 58.0.29's plain `navigate` pushes an absent route but can duplicate an existing one; the installed Android stack reducer and role callbacks reproduce both cases in tests. SDK `NAVIGATE` with `pop: true` matches the flat-stack example, but Expo Router's public `NavigationOptions` does not expose that flag. Do not assume a safe nested-stack/iOS NativeTabs workaround without validation. |
| Native surface verification | `BoyoqchiHomeScreen`, `BoyoqchiAstatkaScreen`, `ReturnedPaintSheet` | Both Expo platform bundles compile, but no real phone was used. Verify navigation, gestures, images, local draft persistence, saving and accessibility in light/dark modes. |
| Text gate | `port_ledger.mjs` `scopeFiles` | After 26 evidence-backed exceptions, iOS reports two missing V2 strings (deferred test-mode error and the iOS palette heading) and 47 unrelated V4 strings; Android reports one missing test-mode error and 57 unrelated V4 strings. Unqualified `_refresh` and `_orderLabel` tags incorrectly bring GScale and Preparation folders into the scan. Fix scope without modifying protected roles; do not treat the gate as passed. |

## Deviations candidates

- None accepted in this checkpoint.

## Test mode pending

- The V2 returned-paint API has test-mode branches; test mode remains deferred to the shared final pass.

## Needs from the integrator

- Reconcile protected Worker `OrderScreen.tsx` returned-image/draft differences separately.

## Checkpoint verification

- Draft regression review: V2 `ReturnedPaintDraftStore` awaits `SharedPreferences.setString` and awaits queued writes before clear (`returned_paint_draft_store.dart:191-214`). Expo FileSystem 58.0.13 declares `File.move` as `Promise<void>` and documents that it mutates the file URI (`src/internal/NativeFileSystem.types.ts`); its native iOS and Android implementations also update that URI. The adapter awaits the move and cleans a reference to the original temporary URI. Nine draft tests pass, including controlled delayed/URI-mutating moves, restart/read, failed-move cleanup, repeated writes and clear-after-write. These filesystem tests are mocks; native-device verification is still needed.
- Draft recovery review: both SDK platforms delete an existing target before overwrite. The mock now models that exact delete-then-fail window and checks restart reads, successful URI-mutating moves, backup-copy failure, successive writes, read races, scope isolation and backup-first clear. Ten file-adapter and five draft-state tests pass. Backup restores the last completed primary when the primary is absent; the limits above remain open.
- Drawer regression review: V2 Home/Astatka use `Navigator.pushReplacementNamed` (`boyoqchi_home_screen_widgets_part_01.dart:58-60`, `boyoqchi_astatka_screen.dart:107-109`); these origins now use Expo Router `replace`. Five tests drive the role callbacks against Expo Router 58.0.29 stack and tab reducers, including selected-item close, logout, and the separately documented Profile/dock history mismatch. This does not mount a navigator or replace phone testing.
- Post-review gates after both fixes: 42/42 Boyoqchi tests passed; iOS typecheck and Expo lint passed; Android typecheck still has the same nine protected Worker errors. Full Node suite: 1,209 passed and the same six Preparation Expo UI ESM-resolution tests failed. Both iOS and Android offline Expo exports bundled successfully. The text gate remains at iOS 2 missing/47 extras and Android 1 missing/57 extras. Original V2 and the isolated snapshot remain clean at `f11910bb2c8c7081ce26770e69811b03fd0739ed`; no phone or emulator was used.
- `v2_oracle.sh test/returned_paint_models_test.dart test/returned_paint_draft_store_test.dart test/boyoqchi_astatka_screen_test.dart` against isolated `f11910bb`: 10 passed. The oracle uses a temporary export, not a device.
- Boyoqchi plus shared Chat unread/runtime and dock badge focused tests: 51 passed, 0 failed, including 34 Boyoqchi tests. Cases are source-derived; no V2 HTTP fixture exists for these requests. Filesystem and Photos permission tests use mocks, not a device or real permission grant.
- `node --test tests/*.test.cjs` after the shared Chat and badge merges: 1,201 passed, 6 failed. The six known Preparation Android tests fail because Node cannot resolve Expo UI's `jetpack-compose/modifiers/createModifier` ESM import; no Boyoqchi test failed.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed after Expo regenerated ignored `.expo/types/router.d.ts` using an offline local Metro session. No simulator or device was started.
- `npx tsc --noEmit -p tsconfig.android.json`: 9 existing errors, all in protected `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`; no new Boyoqchi errors.
- `npx expo lint`: passed.
- `CI=1 EXPO_OFFLINE=1 npx expo export --platform ios` and `--platform android` after the shared Chat and badge merges: both bundled successfully. Bundling does not verify runtime behavior.
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
| `BoyoqchiNavigationDrawer`, `boyoqchi_navigation_drawer.dart` | `BoyoqchiDrawer.tsx` | partial | partial | Uses the existing role drawer, shared logout prompt and exact destinations. Home/Astatka dispatch replacement; Profile history differs as documented above, and native navigation still needs a phone. |
| `BoyoqchiDock`, `boyoqchi_dock.dart`; `RoleDock`, `role_dock.dart`; `ChatRoleDock`, `chat_role_dock.dart` | NativeTabs, `BoyoqchiDock.android.tsx`, role chat routes | partial | partial | Home/Astatka/Profile/Chat destinations and unread dots use shared native components. Native display and Chat behavior need phone validation. |
