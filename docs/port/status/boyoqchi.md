# boyoqchi

Status: part 1 of 1 in progress
Stopped at: Baseline-independent model, pure rules, request-list and completion API paths, and image URL resolution. Pin the source, then implement the remaining API, persistence, views, routes, audit and gates.

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
| Baseline | `docs/port/V2_BASELINE`; V2 `f11910bb` | Integrator must pin the intended source before full role work, oracle runs and final gates. |
| Numeric JSON | `ReturnedPaintItemInput.fromJson`, `ReturnedPaintCalculation.fromJson` | JS JSON parsing cannot recover whether a numeric token was `1` or `1.0` or represent every large integer. The current backend serializes these decimal fields as strings; compare legacy numeric payloads before parity is claimed. Integer-like map keys may also have a different iteration order. |
| Returned-paint draft persistence | `ReturnedPaintDraftStore` | Implement and test full image metadata, legacy migration, serialized writes and actor/request scope without changing the existing worker draft implementation. |
| Boyoqchi APIs, UI and routes | `.port/role-boyoqchi.md` | Six of the nine listed API methods remain, along with both platform surfaces, sheet/dialog behavior and role navigation. Request-list and completion live paths and image URL resolution are implemented but still require the full role audit. |
| Training image errors | `uploadTrainingReturnedPaintImage`, `deleteTrainingReturnedPaintImage`, `_adminProductionMapException` | The existing shared production-map error helper is incomplete relative to V2. Resolve its full mapping before marking the training-image paths and callers complete; do not change the protected worker file in this role. |
| Image origin | `returnedPaintImageUrl`, `downloadReturnedPaintImage` | V2 attaches bearer headers even to absolute external URLs; the existing native transport restricts authenticated requests to the server origin. Do not weaken credential protection; confirm required cross-origin behavior. |
| Text gate | `port_ledger.mjs` `scopeFiles` | Unqualified `_refresh` and `_orderLabel` tags incorrectly bring GScale and Preparation folders into the Boyoqchi text scan. Scope or justify each discrepancy without modifying protected roles. |

## Deviations candidates

- None accepted in this checkpoint.

## Test mode pending

- The V2 returned-paint API has test-mode branches; test mode remains deferred to the shared final pass.

## Needs from the integrator

- Pin and confirm the V2 baseline; reconcile protected Worker `OrderScreen.tsx` returned-image/draft differences separately.

## Checkpoint verification

- `node --test tests/boyoqchiModel.test.cjs tests/boyoqchiApi.test.cjs`: 13 passed, 0 failed. Cases are source-derived; no V2 oracle or HTTP fixture was run. Request tests include the existing same-origin authenticated transport.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed after Expo regenerated ignored `.expo/types/router.d.ts` using an offline local Metro session. No simulator or device was started.
- `npx expo lint`: passed.
- `node .agents/skills/accord-port/scripts/port_ledger.mjs check`: passed with 8 repository-wide endpoint warnings outside this checkpoint.
