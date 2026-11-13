# homashyo

Status: functional port integrated on main; device verification and documented parity items remain open
Stopped at: Real-account stock save, issue save, exact pending-command retry, printer selection and reprint now run through the existing APIs and native components. Code and automated gates are complete for this checkpoint; phone/printer verification and the explicit parity items below remain open.

## Scope and source

The user explicitly requested work directly on `main` on 2026-11-13 and reuse of existing components. This overrides the skill's separate-worktree rule for this session. The eight remaining commits from `port/homashyo` were cherry-picked onto main before continuing. V2 remains read-only at `44396752`; the ledger confirms no changes under `lib/` or `test/` from pinned source `f11910bb`. Only the two iOS project configuration files differ, so no V2 checkout or baseline file was changed.

## Implemented

- Removed the unconditional production dispatch hold, which has no V2 equivalent. Actual production-policy tests now exercise stock/issue/print paths instead of replacing the policy with an always-true mock.
- Kept original-session tickets, persisted exact payload/request-ID retries, separate stock/issue keys, malformed-response checks, and no stock resubmission after print failure. Pending reads and new writes wait for an existing JS-runtime writer to finish, including its stale-session key restoration.
- Reused shared `PrintService`, native Bluetooth on both platforms, Android Zebra USB and Wi-Fi Zebra. GoDEX remains excluded by D13; iOS USB remains unsupported by the existing native module.
- Both platforms reuse `WorkerOrderSheet` and `DeviceSheet` for the dismissible printer picker. The Homashyo caller uses the default transport choices; the shared Bluetooth-only `printerOnly` mode is not applied.
- Both platforms reuse the existing guarded Profile with Settings/PIN enabled, the role drawer/dock, Chat and unread badge, native fields and list/card components.
- Camera and manual input close the scanner and start lookup directly, like V2. Duplicate detections and stale scanner/session callbacks are rejected.
- iOS reuses native ScrollView and SwiftUI controls for animated issue-form scrolling on iOS 16+, persistent scanner field labels and keyboard avoidance. Android reuses Compose IconButton and TextField blur for width Done and adding a roll.

## Verification

- Logic/API/pending recovery/native print tests: 151/151 passed before the final UI gate.
- V2 recorded-contract replays run with the real V4 dispatch policy and fake transport/storage only. No live data was changed.
- Final Homashyo tests: 382/382 passed. Full Node suite: 6,423 passed, zero failed, 12 existing TODO cases (6,435 total); exit 0. The spec reporter prints the failing TODO bodies, but these are not test-suite failures.
- Both `npx tsc --noEmit -p tsconfig.ios.json` and `-p tsconfig.android.json` passed with zero diagnostics. `npx expo lint --no-cache` passed with the existing AdminClosedHistoryOwner hook-dependency warning and no errors. `git diff --check` passed.
- Ledger check passed: 1,264 source tags and 115 test tags resolve. The Homashyo routes and four actual surfaces are tagged on both platforms. The dynamic raw-material-split endpoint warning comes from `read()` composing a source-defined path/query, corresponding to V2 `_rawSplitRead`; no new endpoint was invented.
- Text gate exits 1: zero missing V2 texts; 13 iOS/12 Android added strings and 58 global-only scope diagnostics per platform. Most diagnostics come from unrelated Boyoqchi/DailyWork selection, plus the existing local pending-status/error feedback and unsupported iOS USB explanation. No diagnostics were hidden by changing another role. The exception file has 69 data rows, carried forward with obsolete hold/Profile/transport entries removed or updated; no new acceptance row was added.
- Commits include the eight prior Homashyo commits and `e6d49571` for enabled command/printing flows; the native UI/scanner checkpoint is committed separately on main. The only shared source edit in this checkpoint is two coverage comments in `src/shared/appRoutes.ts`.
- V2 remained clean and read-only. No simulator, phone, live backend or physical printer was used.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| RawMaterialSplitScreen, raw_material_split_screen.dart:16 | RawSplitHome.*, rawSplitController.ts | code compared | code compared | Native controls; status-read retry guard; native-device interaction remains unverified. |
| RawMaterialSplitHistoryScreen, raw_material_split_history_screen.dart:17 | RawSplitHistory.*, rawSplitHistoryController.ts | code compared | code compared | Native list/cards; real printer results remain unverified. |
| RawSplitDetailsSheet, raw_material_split_result_view.dart:230 | RawSplitDetails.*, RawSplitResultBinding.tsx | code compared | code compared | Shared native sheet and printer bridge; device dismissal/printing checks remain. |
| RawSplitIssueDetailsSheet, raw_material_split_result_view.dart:463 | RawSplitDetails.* | code compared | code compared | Source row order and values retained; native wrapping/RTL needs phones. |
| showPrintDevicePicker, raw_material_split_screen.dart:213 / history_screen.dart:56 | RawSplitPickerOverlay.*, shared DeviceSheet | code compared | code compared | Existing native sheet; GoDEX excluded, iOS USB unsupported. |
| showRawMaterialScanDialog, raw_material_split_screen.dart:123 | RawSplitScanner.*, useRawSplitHomeScreen.ts | code compared | code compared | Automatic first-code lookup restored; native ROI/focus/zoom differences remain. |
| SnackBar, raw_material_split_screen.dart:302,375 / history_screen.dart:97 | RawSplitContext.tsx, PreparationNotice | code compared | code compared | Reuses existing localized transient notice. |

## Open items

| Where | V2 reference | What remains |
|---|---|---|
| Physical device checks | Home, History, detail sheets, showPrintDevicePicker | Test login, lookup/manual/camera scan, keyboard/width actions, issue scroll, picker dismissal/cancellation, Settings/PIN, account switch, light/dark, large text, Urdu/RTL and accessibility on iOS/Android phones. No simulator or phone was used. |
| Physical printing | raw_material_split_print.dart, PrintService | Test Bluetooth on each platform, Android Zebra USB and Wi-Fi Zebra; verify each output's net/gross/core/length label and print-only retry after a failure. These reuse existing modules and have only mocked role-level transport coverage. The installed development binary must include the existing AccordNativeClock and printer modules. |
| GoDEX / iOS USB | PORT.md D13, native USB module | GoDEX stays excluded. The iOS module has no USB implementation. Neither is claimed supported. |
| Scanner behavior | RawMaterialScanDialog, reliable_mobile_scanner.dart | Expo currently detects the full preview; V2 decoder ROI, tap-to-focus and auto-zoom are not reproduced. The visual guide remains the source's fixed 260 points. |
| Shared test mode | TestModeController | The app-wide independent V2 test-mode store is deferred by D3. Demo-token writes fail before storage/network; the role does not implement a second test-mode system. |
| Shared navigation and logout | RoleDock, AppRootNavigation, clearAppLock | Native tabs/Android dock use existing navigation rather than V2's exact root-stack reset/timing. Logout retains the current shared PIN cleanup limitation. Shared Chat and Profile behavior retain their own documented device checks. |
| Source oracle / edge values | test/raw_material_split_test.dart, RawSplitIssue.createdAt | Historical independent f119 oracle has three failing widget cases; passing recordings and source-derived V4 tests are used, not those failed assertions. Extreme Dart calendar/URI/Unicode/Hermes cases need separate runtime verification. |
| Text gate | .port/text-homashyo.md | Gate remains open at the exact counts above. Shared formatLocalDateTime tagging pulls unrelated Boyoqchi and DailyWork files into this role's report; the remaining role-local status/error feedback also needs an explicit parity verdict. |

## Deviations candidates

The existing paired pending-status read gate blocks controls on failed local reads and waits for an in-flight writer before showing a clear status. V2 does not have this paired gate. Session guards and exact stock-response matching are retained. The unconnected journal experiment is not used by the role and is not a dependency for this port.

## Phone smoke check

Sign in as Homashyo rezkachisi; look up/scan a source; enter width/gross/core/length/waste; cancel and select the printer; save a balanced split; report and then save a measured discrepancy; open History/details and reprint a single roll/all without another stock write. Check Settings/PIN, account switching, swipe/back/outside dismissal and keyboards on both platforms.
