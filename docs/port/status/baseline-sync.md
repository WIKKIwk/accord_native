# baseline-sync

Status: source selected; historical drift and role verification remain open
Stopped at: audit and reconcile the old-to-new V2 diff as each affected role or shared component comes into scope. The user chose the latest V2 source and will address remaining shortcomings later.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| All affected roles and shared components | `git diff 7c87a54e78fa99eb89b7342101f6ec468ecf2e19 f11910bb2c8c7081ce26770e69811b03fd0739ed` | Compare the relevant changes across all 208 changed files; 206 are under `lib/` and `test/`. Most are state-wrapper churn, but do not assume every change is equivalent. A new-baseline zero-drift report does not close this historical work. |
| Protected `src/workerOpenedOrderEditApi.ts:118–133` | `lib/src/core/api/admin/mobile_api_opened_order_edit.dart:140–172` | New V2 normalizes generic, authentication and server errors to the order-edit fallback. The existing worker implementation still needs comparison and correction; it was deliberately not changed in this alignment. |
| Calculate screen | `lib/src/features/admin/presentation/admin_calculate_screen__AdminCalculateScreenState_methods_04.dart:5–18` | Compare the invalid-number path that cancels a pending print-side lookup, invalidates stale responses and clears the remembered side. |
| Confirmation and early-close dialogs | `lib/src/core/widgets/feedback/m3_confirm_dialog.dart:112`, `lib/src/features/admin/presentation/admin_production_map_orders_screen_widgets.dart:58` | Compare the new scrollable dialog behavior for the platform surfaces that use these dialogs. |
| Text-entry dialog | `lib/src/core/widgets/feedback/app_text_input_dialog.dart:18–23,76` | Compare controller disposal after the dialog exit animation. |
| Admin notices | `lib/src/features/admin/presentation/widgets/admin_top_notice.dart:18–75` | Compare notice-handle and timer cancellation when a banner is removed or disposed. |
| Localization load timing | `lib/src/core/localization/app_localizations.dart`, `app_localizations_declarations_part_01.dart` | V2 changed its delegate to return `SynchronousFuture`; compare locale readiness and reload timing on native. The regenerated catalog differs only in provenance, not text data. |
| Contract fixtures and test outcomes | `tests/contracts/*.json`, `tests/support/contractFetch.cjs:9–11`, `v2_contracts.sh:63–64` | The 61 files and 822 records are historical `7c87a54e` fixtures. For each selected test regenerate and check provenance at `f11910bb`, and independently verify the V2 test with the oracle; failed V2 cases are not specifications. Coordinate overlapping filenames between roles. |
| Ledger input | `.agents/skills/accord-port/scripts/port_ledger.mjs:124–137` | The ledger reads its selected V2 tree. Follow the isolated snapshot procedure in `PORT.md` to prevent live or ignored files contaminating scans, verify the snapshot before use, and independently check the original V2 HEAD and clean status before and after work; stop if it changes. |

## Deviations candidates

None asserted by this source selection.

## Test mode pending

The existing project-wide list remains in `docs/port/PORT.md`.

## Needs from the integrator

Coordinate shared fixture ownership and retain the historical-drift warnings when integrating role branches. Do not interpret this source pin as a completed drift sync or claim existing worker and preparation behavior is current.
