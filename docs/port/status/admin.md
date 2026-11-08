# admin

Status: part 1 of 8 in progress
Stopped at: Continue part 1's remaining API families and their V2 tests, then write the full UI contract, implement and wire every reachable admin surface on both platforms, run all gates and finish the surface-by-surface audit. Nothing in this checkpoint makes the Admin role runnable or complete.

The source used for the new work is `f11910bb2c8c7081ce26770e69811b03fd0739ed`. An isolated clean clone was used for ledger and oracle reads. The original source and the clone were both clean at that SHA before and after those operations. The ledger reports 8 parts, 275 public API entries (including already-tagged imports) and 112 surface entries; runtime reachability and existing tags still require review. The historical 61 top-level contract files are from `7c87a54e` and were not overwritten.

## Checkpoint: item groups and item paging

- `src/admin/itemGroupApi.ts` ports the live paths of `adminItemGroups`, `adminItemGroupTree`, `adminCreateItemGroup`, `adminMoveItemGroupParent`, `adminMoveItemsToGroup`, `adminItemUoms` and `adminItems`. The last reuses the existing `adminItemsPage` reader. `itemGroupModel.ts` implements the group/result parsers and the customer-ancestry rule.
- Independently ran V2 `test/admin_item_group_customer_policy_test.dart` in an exported f119 oracle: 2 passed. The matching V4 rule is covered by `tests/adminItemGroup.test.cjs` along with source-derived mocked request/parser tests; 6 tests passed. No V2 HTTP recording was found for these operations, so the tests are not f119 recorded-wire replays.
- iOS TypeScript passes after regenerating the ignored `.expo/types/router.d.ts` using Expo's installed route generator. The worktree script copied stale route types lacking the existing `/sheet/[id]` route, which initially caused an unrelated `src/nativeSheet.tsx` type error. No tracked routing or TypeScript configuration was changed.
- Text gate before implementation: iOS 1,172 V2 strings absent / 62 native extras; Android 1,170 absent / 73 extras. These are scanner results, not audited differences: matching the broad admin ledger also sweeps shared and other-role surfaces, while dynamically assembled and localized strings can be missed. No exceptions were accepted. Every relevant V2 screen and dialog still needs side-by-side review rather than using counts as proof.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Entire role | `.port/role-admin-1.md` through `.port/role-admin-8.md` generated at f119 | Complete remaining unchecked methods, models, contracts, logic tests, all reachable screens, sheets, navigation and UI contract. Existing `[x]` tags are imports, not f119 parity evidence. |
| V2 drift | `docs/port/status/baseline-sync.md` | Compare role-relevant `7c87a54e..f11910bb` changes, including dependencies already tagged in V4. A zero drift report against the new pin does not establish that historical drift was re-ported. |
| Recorded contracts | `.port/role-admin-tests.md` | Run each relevant V2 test independently first; record successful f119 cases into distinct nested fixtures, never overwrite the historical top-level files, and port the replays. Coordinate shared stems. Do not run a live-backend mutation. |
| Item groups and paging | `mobile_api_admin_item_groups.dart`, `mobile_api_admin_items_MobileApiAdminItems_methods_01.dart`, `mobile_api_admin_items_MobileApiAdminItems_methods_04.dart` | No direct V2 HTTP recording was found for the seven checkpoint methods. Source-derived tests cover their requests; add a real f119 recording if a suitable V2 mock test is found. |
| JSON value fidelity | `adminItemGroups`, `AdminItemGroupBulkMoveResult.fromJson` | Dart distinguishes integer-valued double JSON tokens and exact large integers; standard `JSON.parse` does not. Group-name conversion and count parsing therefore differ on those unusual non-string/non-integer payloads. A lossless parser needs evaluation; do not silently mark full parser parity. |
| Existing `adminItemsPage` | `SupplierItem.fromJson` in `app_models_declarations_part_01.dart` | The imported reader parses ordinary catalog payloads. Its JS stringification of nested `order_apparatus_options` / `customer_names` values differs from Dart collection `toString()`; compare nonstandard values and resolve without rewriting the shared reader independently. |
| Admin production queue | `AdminProductionMapOrdersScreen(workerMode: false)` and other admin-only branches | Existing worker queue code covers worker mode, not proof of admin parity. Do not modify protected worker or preparation files; record the specific shared switches and request an integrator change if required. |
| UI/text and platform checks | `.port/role-admin.md`, `.port/text-admin.md` | No Admin surface has been implemented or audited in this checkpoint. Build and verify all reachable surfaces, including the complete sheet/dialog/back-guard inventory. Run text gate, both platform typechecks, lint and Node tests; devices, simulators and emulators were not used. |
| Large responses | `json_payload_decoder.dart` | V2 decodes JSON >=128K code units in a background isolate. The existing JS path is synchronous; measure on a real admin payload and review the user-visible performance consequence. |

## Deviations candidates

None identified in this checkpoint.

## Test mode pending

| V4 function | V2 symbol |
|---|---|
| `adminItemGroups`, `adminItemGroupTree`, `adminItemUoms`, `adminItems` | Their namesakes read or derive test-mode demo data; this shared mode is deferred and has not been added to the live-path functions. |

## Needs from the integrator

- Integrate other role branches and shared navigation only after reviewing conflicts and role guards. The Admin home and routes are not wired by this checkpoint.
- Preserve the protected worker and preparation code. Admin's separate branches of shared production queue surfaces still require a reviewed integration plan.

## Surface audit

No surface is marked `ok`. The V2 ledger inventories 112 surfaces; reachability, both-platform views and each listed sheet/dialog are still pending. Run the f119 ledger again and compare every relevant source location and V4 implementation side by side before replacing this statement with individual audit rows.
