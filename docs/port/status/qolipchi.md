# qolipchi

Status: narrow logic checkpoints; role port incomplete
Stopped at: wait for the integrator's baseline synchronization before resuming the Qolip role scope, logic, screens, wiring and audits.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Source pin | `docs/port/V2_BASELINE`, V2 commit `f11910bb2c8c7081ce26770e69811b03fd0739ed` | The user chose the latest V2 source; the integrator is synchronizing the committed baseline before the remaining role work. |
| Role-wide logic and surfaces | `lib/src/features/qolip/`, `lib/src/core/api/qolip/` | Except for the isolated code helpers and search engine below, the role logic, iOS and Android views, navigation, text gate and surface audit remain to be completed. |
| Qolip search on devices | `qolip_search_engine.dart`, `search_normalizer.dart` | Confirm React Native timer slicing and cancellation on both phones. Rare Unicode lowercase mapping differences between the Dart VM and the phone's JavaScript engine have not been verified. |
| Full test gate | `tests/preparationHomeDependentPages.test.cjs`, `tests/preparationWarehouse.android.test.cjs` | Six existing preparation Android tests cannot resolve `@expo/ui`'s extensionless `createModifier` import under Node in this fresh install. They do not import this checkpoint's code. |
| Android typecheck | `WorkerOutputProgress.android.tsx`, `WorkerPaintPalette.android.tsx` | Nine existing errors remain in worker components; none points to the Qolip code. |

## Checkpoint

- Ported `parseQolipBatchCode`, `QolipBatchCodeDraft`, `qolipBatchMaxCount` and `qolipCodePrefixSuggestion` into `src/qolip/qolipCode.ts`. The two source files have no project imports and their Git blob IDs are identical at V2 `7c87a54e78fa99eb89b7342101f6ec468ecf2e19` and `f11910bb2c8c7081ce26770e69811b03fd0739ed`.
- Added the batch assertions from `test/qolip_products_selection_test.dart`, plus source-derived edge cases for both helpers, to `tests/qolipCode.test.cjs`. The V2 test file itself is identical at both pins, but it imports other V2 files and its full dependency closure was not established as identical. No direct V2 test for the prefix suggestion was found.
- Focused code and search tests: 14 passed. iOS typecheck and Expo lint passed. The preceding checkpoint's Android typecheck had 9 existing worker errors, and its full Node suite had 1,116 passed and 6 failed out of 1,122, as described above. Those two broad checks were not rerun for the narrow search checkpoint.
- The ignored Expo route types were regenerated in this worktree using the installed Expo type-generation module to include the existing `/sheet/[id]` route before typechecking. No simulator, emulator, device, V2 oracle, or backend was used. This checkpoint is not a role parity claim.
- Ported `QolipSearchDocument`, `QolipSearchQuery` and `filterQolipSearch` into `src/qolip/qolipSearchEngine.ts`. The engine's only project import is `search_normalizer.dart`; both source files, direct engine test and its legacy reference have identical Git blobs at the two V2 pins. `pubspec.yaml` and `pubspec.lock` are identical as well. The separate matcher and home-widget tests are identical files, but their full model/UI dependency closures were not established as identical.
- Reused `src/shared/searchNormalizer.ts`, applying Dart's U+0085 edge trim only within Qolip. `tests/qolipSearch.test.cjs` covers the V2 examples and compares 3,500 generated cases against a separately translated legacy matcher; it is source-derived, not a V2 oracle recording. Keyboard alternatives, variable edit distances, digital identifiers, cancellation, duplicate results and yielding are covered.

## Deviations candidates

None recorded for this narrow checkpoint.

## Test mode pending

The role-wide test mode is deferred by the port plan and was not addressed here.

## Needs from the integrator

- Complete the agreed V2 baseline synchronization and resolve the shared test toolchain issues before the remaining role work.
