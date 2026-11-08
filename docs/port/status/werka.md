# werka

Status: 1/1 in progress (partial)
Stopped at: Port the remaining Werka API, store, UI contract, both platform views and navigation, then run the full gates and surface audit.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Werka screens and routes | `.port/role-werka.md`: 28 surfaces, 24 routes | Port each reachable screen, sheet, dialog and navigation edge on iOS and Android. No role entry has been wired. |
| Werka APIs and stores | `.port/role-werka.md`: 26 methods; `werka_store.dart`, `werka_notification_store.dart` | Port and test remaining API, model, state and account-reset behavior. Reuse existing shared parsers and components where appropriate; check their documented parity limits. |
| Shared Paddon and WIP models/errors | `AdminPaddonSnapshot`, `AdminProgressBatch`, `_adminProductionMapException` | Werka reuses existing shared decoders and error mapper. Complete their documented cross-role parsing and error-field parity before exposing the receiving flow. |
| Werka record API verification | `werkaPending`, `werkaSummary`, `werkaStatusBreakdown`, `werkaStatusDetails`, `werkaHistory`, `werkaNotifications`, `confirmReceipt` | V2 has no direct recordings for these methods. Source-derived tests cover requests and basic decoding; live server and full shared parser/error parity remain unverified. No route calls these functions yet. |
| Stock entry lookup verification | `werkaStockEntryLookup`, `StockEntryBarcodeLookup` | V2 has no direct HTTP recording; source-derived tests cover request, decoding and error codes. Scanner and lookup screens are not wired. |
| Issue API verification | `createWerkaUnannouncedDraft`, `createWerkaCustomerIssue`, `createWerkaCustomerIssueBatch` | V2 has no direct HTTP recordings. Source-derived mock tests cover request bodies, result decoding and the two conflict codes; screens and account-safe action wiring remain open. |
| Archive QR UI | `test/werka_archive_batch_qr_test.dart` | Five pure logic cases are ported, but the widget case and runtime flow still need native UI and device verification. |
| Shared routes and subscriptions | `NotificationDetailScreen`, RoleDock chat | Shared notification, hidden/unread and Customer runtime account-switch races remain open. Existing RN Chat redirect/cookie and login cross-origin 307/308 risks are under security hold. Do not expose new-role Chat or unsafe shared routes or invent unread counts. |
| Test mode | `TestModeController` | Implement role test-mode behavior in the coordinated final test-mode pass. |
| Full gate and device | `$port` surface/text gates | Run both platform typechecks, all tests, lint, ledger checks and the text/surface audits. No simulator, emulator or physical device has been used. |

## Deviations candidates

None identified yet.

## Test mode pending

Role-specific test-mode branches remain for the coordinated final pass.

The isolated f119 oracle passed all five `werka_paddon_api_test.dart` cases and all six `werka_archive_batch_qr_test.dart` cases. Its seven API request records are in `tests/contracts/f119/werka_paddon_api_test.json`; the historical fixtures were not overwritten.

## Needs from the integrator

Do not merge or expose Werka routes until the role is complete and the documented shared security/account-switch holds are resolved.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Archive batch QR parsing and customer selection, `werka_archive_batch_qr.dart`, `werka_archive_batch_qr_lookup_screen_helpers_part_01.dart` | `src/werka/werkaArchiveBatchQr.ts` | open | open | Pure rules only; no screen or end-to-end flow exists yet. |
