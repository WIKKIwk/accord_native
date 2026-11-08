# qolipchi

Status: narrow logic checkpoint; role port not started
Stopped at: confirm the V2 source pin and resume the Qolip role scope, logic, screens, wiring and audits.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Source pin | `docs/port/V2_BASELINE`, V2 commit `f11910bb2c8c7081ce26770e69811b03fd0739ed` | The committed baseline and source HEAD differ; the integrator is resolving the pin before the remaining role work. |
| Role-wide logic and surfaces | `lib/src/features/qolip/`, `lib/src/core/api/qolip/` | Except for the two isolated code helpers below, the role logic, iOS and Android views, navigation, text gate and surface audit remain to be completed. |
| Full test gate | `tests/preparationHomeDependentPages.test.cjs`, `tests/preparationWarehouse.android.test.cjs` | Six existing preparation Android tests cannot resolve `@expo/ui`'s extensionless `createModifier` import under Node in this fresh install. They do not import this checkpoint's code. |
| Android typecheck | `WorkerOutputProgress.android.tsx`, `WorkerPaintPalette.android.tsx` | Nine existing errors remain in worker components; none points to the Qolip code. |

## Checkpoint

- Ported `parseQolipBatchCode`, `QolipBatchCodeDraft`, `qolipBatchMaxCount` and `qolipCodePrefixSuggestion` into `src/qolip/qolipCode.ts`. The two source files have no project imports and their Git blob IDs are identical at V2 `7c87a54e78fa99eb89b7342101f6ec468ecf2e19` and `f11910bb2c8c7081ce26770e69811b03fd0739ed`.
- Added the batch assertions from `test/qolip_products_selection_test.dart`, plus source-derived edge cases for both helpers, to `tests/qolipCode.test.cjs`. The V2 test file itself is identical at both pins, but it imports other V2 files and its full dependency closure was not established as identical. No direct V2 test for the prefix suggestion was found.
- Focused tests: 7 passed. iOS typecheck and Expo lint passed. Android typecheck: 9 existing worker errors. Full Node suite: 1,116 passed and 6 failed out of 1,122, as described above.
- The ignored Expo route types were regenerated in this worktree using the installed Expo type-generation module to include the existing `/sheet/[id]` route before typechecking. No simulator, emulator, device, V2 oracle, or backend was used. This checkpoint is not a role parity claim.

## Deviations candidates

None recorded for this narrow checkpoint.

## Test mode pending

The role-wide test mode is deferred by the port plan and was not addressed here.

## Needs from the integrator

- Resolve the V2 source pin and shared baseline/test toolchain issues before the remaining role work.
