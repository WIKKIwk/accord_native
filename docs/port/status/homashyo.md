# homashyo

Status: part 1 in progress
Stopped at: Wire native home/history/details, scanner/picker/print runtime, role navigation and feedback; then complete text and surface audits.

Source: `f11910bb2c8c7081ce26770e69811b03fd0739ed` in an isolated clean snapshot. The original V2 checkout is read-only.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| iOS and Android | `RawMaterialSplitScreen`, `RawMaterialSplitHistoryScreen`, `RawSplitDetailsSheet`, `RawSplitIssueDetailsSheet` | Candidate home/history/details contents exist, but scanner, printer selection/runtime, routing, wiring, scroll-to-issue, localized text and full surface comparison remain open. None is exposed by a role route. |
| Printing | `rawMaterialSplitPrintRequest`, `PrintService.printRps` | Label mapping and a supported Bluetooth/Zebra/Wi-Fi Zebra runtime reuse the existing bridge/API with mocked tests; connect them to role views and verify with physical printers and phones. D13 blocks GoDEX before a stock write. Explain this unsupported choice in the eventual UI; it must not silently proceed. |
| Request ID | `newRawSplitRequestId` | Secure randomness matches V2; JavaScript clock uses milliseconds × 1000 rather than a true microsecond clock. Verify or provide native microsecond precision. |
| Tests | `test/raw_material_split_test.dart` | Selected-baseline oracle: 16 passed, 3 widget tests failed (`saved issue permits measured stock and printing`, `field-sized plus adds only fitting rolls`, `measured split sends net stock and prints gross core`); investigate rather than use failed cases as the spec. An isolated f119 fixture has been recorded and passing stock retry, issue retry, source lookup and print/reprint requests are replayed. Investigate remaining failing widget cases and unexercised branches. |
| Models and issue details | `RawSplitIssue.createdAt` | Compare Dart `DateTime.parse` edge cases against the JavaScript date parser; malformed or offset-less timestamps and microsecond display need oracle coverage. |
| Test mode | `rawSplitSave`, `rawSplitReportIssue` | Implement the shared test-mode policy in the deferred test-mode pass. |

## Verification so far
- `node --test tests/homashyo*.test.cjs`: 51 passed, including mocked iOS/Android home/history render trees and source-derived labels, including selected-baseline wire replays.
- `tests/contracts/f11910bb/raw_material_split_test.json` is a new f119 recording; prior historical fixtures remain untouched. The file includes requests from the three failed V2 widget tests, which must not be treated as specifications.
- `npx tsc --noEmit -p tsconfig.ios.json`: passed after regenerating the worktree’s stale ignored Expo Router types.
- Selected-baseline Flutter oracle: 16 passed, 3 failed; no simulator or device.
- Ledger `role homashyo 1`: 8 API tags resolve; both routes and all four platform surfaces remain unchecked. `text homashyo both`: 82 V2 texts missing per platform, 0 invented V4 texts; 8 dialogs/sheets/feedback sites need comparison. No text exceptions accepted.
- Ledger `check`: all tags resolve, with 9 global endpoint warnings. This role’s `/v1/mobile/raw-material-split/{}{} ` is the dynamic `snapshot`/`source` read plus query in `rawSplitApi.ts`; both paths are present in the V2 source. Other warnings are outside this role.
- Full `node --test tests/*.test.cjs`: 1203 passed, 6 failed due to the known Preparation Android Expo UI ESM-resolution baseline.
- Android typecheck: the same 9 known Worker errors; no Homashyo errors. iOS typecheck and `npx expo lint` passed. Offline Expo JS exports passed for both iOS and Android.

## Deviations candidates
- D13 excludes GoDEX although V2 offers it and defaults Wi-Fi to it. The candidate controller requires a supported-printer preflight before stock mutation and reports the exclusion through a required callback; the eventual UI must explain it. No route exposes it yet.
- `raw_material_split_screen.dart:481–484`: editing a measurement, including an invalid waste value after an issue was saved, clears `_issueSaved`; the user must record the issue again. The controller preserves this V2 behaviour.

## Test mode pending
`rawSplitSave` and `rawSplitReportIssue` reject test mode in V2; this is deferred to the centralized test-mode pass.

## Needs from the integrator
- Keep Homashyo routes unexposed until the real scanner, supported printer selection and printing are wired and audited. Wire `rawSplitPrinterSupported` and the required unsupported-printer callback before any stock save. Existing shared Profile can be reused without the optional daily-work callback.
Do not expose a Homashyo Chat route until the shared WebSocket redirect/cookie security hold is cleared; do not change the protected worker/preparation Chat paths.

## Surface audit
| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `RawMaterialSplitScreen`, `raw_material_split_screen.dart:16` | `src/homashyo/RawSplitHome.{ios,android}.tsx`, `rawSplitController.ts` | open | open | Candidate native forms are connected to the tested shared controller. Scanner, device picker, printer runtime wiring, native header/drawer/dock, scroll-to-issue, localization and actual-device interaction remain unwired or unaudited. Android reuses `WorkerSheetButton`/`DropdownFilter`; a local native input wrapper was needed because the existing preparation field lacks external reset and Done callbacks. |
| `RawMaterialSplitHistoryScreen`, `raw_material_split_history_screen.dart:17` | `src/homashyo/RawSplitHistory.{ios,android}.tsx`, `rawSplitHistoryController.ts` | open | open | Candidate native history lists and controller exist; they reuse `PreparationList` on iOS and `OrdersList`/`WorkerQueueCard` on Android. Header, drawer/dock, detail callbacks and printer runtime are not wired; device and word-by-word audit pending. |
| `RawSplitDetailsSheet`, `raw_material_split_result_view.dart:230` | `src/homashyo/RawSplitDetails.{ios,android}.tsx` | open | open | Candidate native sheet contents exist and reuse `WorkerSheetButton`/`DropdownFilter` on Android. They are not wired to history, printer or a native sheet; compare every action and dismissal on devices before tagging. |
| `RawSplitIssueDetailsSheet`, `raw_material_split_result_view.dart:463` | `src/homashyo/RawSplitDetails.{ios,android}.tsx` | open | open | Candidate native contents exist, not wired or device-audited. Dart local date/microsecond formatting remains open. |
| Scanner and device picker, `raw_material_split_screen.dart:123,213` | not implemented | open | open | Reuse existing scanner/picker and compare dismissal and states. |
| Snackbars, `raw_material_split_screen.dart:302,375`, history:97 | not implemented | open | open | Success and error outcomes need their native feedback surfaces. |
