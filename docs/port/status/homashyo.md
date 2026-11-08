# homashyo

Status: part 1 in progress
Stopped at: Implement API, screens, navigation, text and surface audits.

Source: `f11910bb2c8c7081ce26770e69811b03fd0739ed` in an isolated clean snapshot. The original V2 checkout is read-only.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| iOS and Android | `RawMaterialSplitScreen`, `RawMaterialSplitHistoryScreen`, `RawSplitDetailsSheet`, `RawSplitIssueDetailsSheet` | Native screens, sheets, scanner, printer selection, routing and full surface comparison remain to be implemented. |
| Printing | `rawMaterialSplitPrintRequest`, `PrintService.printRps` | The label request mapping is implemented; connect the existing printer bridge to the role and verify with a physical printer and phones. GoDEX stays excluded by D13. |
| Request ID | `newRawSplitRequestId` | Secure randomness matches V2; JavaScript clock uses milliseconds × 1000 rather than a true microsecond clock. Verify or provide native microsecond precision. |
| Tests | `test/raw_material_split_test.dart` | Selected-baseline oracle: 16 passed, 3 widget tests failed (`saved issue permits measured stock and printing`, `field-sized plus adds only fitting rolls`, `measured split sends net stock and prints gross core`); investigate rather than use failed cases as the spec. An isolated f119 fixture has been recorded and passing stock retry, issue retry, source lookup and print/reprint requests are replayed. Investigate remaining failing widget cases and unexercised branches. |
| Models | `RawSplitIssue.createdAt` | Compare Dart `DateTime.parse` edge cases against the JavaScript date parser; malformed or offset-less timestamps need oracle coverage. |
| Test mode | `rawSplitSave`, `rawSplitReportIssue` | Implement the shared test-mode policy in the deferred test-mode pass. |

## Verification so far
- `node --test tests/homashyo*.test.cjs`: 28 passed, including selected-baseline wire replays.
- `tests/contracts/f11910bb/raw_material_split_test.json` is a new f119 recording; prior historical fixtures remain untouched. The file includes requests from the three failed V2 widget tests, which must not be treated as specifications.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed after regenerating the worktree’s stale ignored Expo Router types.
- Selected-baseline Flutter oracle: 16 passed, 3 failed; no simulator or device.
- Full `node --test tests/*.test.cjs`: 1203 passed, 6 failed due to the known Preparation Android Expo UI ESM-resolution baseline.
- Android typecheck: the same 9 known Worker errors; no Homashyo errors. iOS typecheck and `npx expo lint` passed. Offline Expo JS exports passed for both iOS and Android.

## Deviations candidates
- `raw_material_split_screen.dart:481–484`: editing a measurement, including an invalid waste value after an issue was saved, clears `_issueSaved`; the user must record the issue again. The controller preserves this V2 behaviour.

## Test mode pending
`rawSplitSave` and `rawSplitReportIssue` reject test mode in V2; this is deferred to the centralized test-mode pass.

## Needs from the integrator
Do not expose a Homashyo Chat route until the shared WebSocket redirect/cookie security hold is cleared; do not change the protected worker/preparation Chat paths.

## Surface audit
| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `RawMaterialSplitScreen`, `raw_material_split_screen.dart:16` | not implemented | open | open | Shared controller exists and is unit-tested; source/scan form, pending retries, issue reporting, save and printing still need platform views and native runtime wiring. |
| `RawMaterialSplitHistoryScreen`, `raw_material_split_history_screen.dart:17` | not implemented | open | open | History, issues, refresh and navigation need platform views. |
| `RawSplitDetailsSheet`, `raw_material_split_result_view.dart:230` | not implemented | open | open | Detail and reprint sheet not wired. |
| `RawSplitIssueDetailsSheet`, `raw_material_split_result_view.dart:463` | not implemented | open | open | Issue detail sheet not wired. |
| Scanner and device picker, `raw_material_split_screen.dart:123,213` | not implemented | open | open | Reuse existing scanner/picker and compare dismissal and states. |
| Snackbars, `raw_material_split_screen.dart:302,375`, history:97 | not implemented | open | open | Success and error outcomes need their native feedback surfaces. |
