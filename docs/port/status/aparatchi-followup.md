# Aparatchi — navbatdagi tekshiruv va tuzatishlar

Status: in progress.
Stopped at: busy-apparatus QR handoff va full worker Paddon management’ni V2 bilan tekshirish.

Specification: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`; checkout `lib/` va `test/` bilan bir xil. V2 va Mini ERP read-only. Wikki `main`da ishlash va har tekshirilgan o‘zgarishni commit qilishni aniq so‘radi. USB va Wi-Fi chop etish tanlovlari hozircha chiqariladi; Bluetooth qoladi. Bu foydalanuvchi qabul qilgan V2 farqi, yashirin parity da’vosi emas.

## Completed

| Change | V2 reference | V4 | Verification |
|---|---|---|---|
| iOS tugallangan buyurtmada issue note bo‘lsa muzlatish tafsiloti ochiladi; oddiy order WIP tarixiga boradi | `lib/src/features/admin/presentation/admin_production_map_orders_screen_state.dart:2899` | `src/components/WorkerWipHistory.tsx` | `tests/workerCompletedHistory.test.cjs`: render, branch, close |
| Oldingi F01–F11 homashyo/progress/hisobot portining checkpoint’i | `aparatchi-order-sheet.md` | OrderScreen, worker material/progress/native components and their dependencies | Worker focused suite 340/340, both typechecks exit 0 |
| Output / WIP reprint Bluetooth printer tanlovi va local print-job execution bilan ulandi; iOS report modal dismissal yakunini kutadi; completion request draftni tozalamaydi | `_pickProgressPrinter`, `_ReadOnlyOrderDetailSheetState._runQueueAction`, `_WorkerWipHistorySheetState._reprintWip` | `workerPrinting.ts`, OrderScreen, WIP details, shared printer pickers | Worker/printer suite 366/366, both typechecks exit 0; cancellation, stale session, print failure and modal dismissal covered |
| Cancel-start menyu entry, native confirmation, owner/operation/cursor/token qayta tekshiruvi | `admin_production_map_orders_cancel_start.dart` | `workerLongPress.ts`, `WorkerLongPressActions.tsx`, WorkerScreen | 54/54 menu/control tests; both typechecks exit 0, lint 0 errors / 1 existing warning |
| Scanned WIP tarixini o‘qish va unused WIPni native tasdiq bilan qaytarish | `admin_production_map_orders_scanned_wip.dart` | `workerScannedWips.ts`, shared hook, native iOS/Android sheets and order header | 14/14 initial focused tests; wider suite found one missing localization mock, fixed and focused presentation/history/API suite passed; both typechecks exit 0, lint 0 errors / 1 existing warning |
| FAB QR payload va URL normalizatsiyasi saqlandi; dastlabki input kamera qayta ochilmasdan tekshiriladi; manual entry va iOS dismissal handshake | `_extractQrPayload`, `_loadInitialInteractionAndScan` | `workerQr.ts`, WorkerQrScanner, WorkerScreen, OrderScreen | QR/progress/bootstrap focused suite 55/55 |
| Worker yo‘riqnomasi placeholder o‘rniga biriktirilgan apparatlarga mos V2 matni, locale va native UI bilan ochiladi | `AparatchiWorkInstructionsScreen` | Shared work-instructions controller/views, guarded worker hook, iOS route / Android section | 12/12 focused tests; both typechecks exit 0, lint 0 errors / 1 existing warning |
| Daily work waiting WIP correction va majburiy reason, native maydonlar va QR long-press/reprint | `_AparatchiDailyWorkScreenState._editWip`, `_DailyWorkWipEditDialogState` | Daily work model/controller, shared dialogs and both platform screens | Focused correction/history/API tests, native typechecks and lint |
| Laminate atomic Astatka / full completion, source revisions, pending request reconciliation va post-save native printer flow | `_IntegratedLaminationAstatka._runIntegratedLaminationAstatka` | WorkerLaminationWorkflow, native form/history/QR, SQLite pending store and guarded APIs | Atomic workflow / API / queue-action focused tests |
| Rezka Astatka waste-only native form, session/stage binding va exact pending request reconciliation | `_ReadOnlyOrderDetailSheetState._runRezkaAstatkaReport` | WorkerRezkaAstatkaWorkflow, WorkerRezkaAstatkaReport, guarded Rezka API | Workflow / API tests cover zero waste, total-only cut, uncertain responses, explicit retry and stale account; iOS modal closes after native dismissal |
| Glue legacy Astatka va full completion uchun alohida layer remainder/waste talablari; non-print long-press finish Astatka’ga boradi | `_ProgressQtyDialogState._submit`, `_showWorkerOrderLongPressActions` | WorkerLegacyLaminationReport, OrderScreen, WorkerLongPressActions | Focused metric/API/menu tests and native typechecks; glue hisobotida bo‘yoq talab qilinmaydi |
| Apparatusda qoldirilgan laminate/glue WIP uchun Continue / Detach menyusi va guarded detach report | `_laminatsiyaWorkerHandoffBatch`, `_runInitialResumeFlow`, `_runInitialRollRemovalFlow` | WorkerHandoff, native menu, OrderScreen | Actual native submit path tested for exact metrics, missing/changed WIP, changed stage and expired account; no printer for detach |
| Android report Back-dismiss block honors the existing preventDismiss contract | `_ProgressQtyDialogState.build` (`PopScope(canPop: false)`) | WorkerFormDialog.android and fallback | Native Compose dialog property/event tests; explicit Cancel remains available |
| Work, long-press and scan entry follows assignment for all operations; completed tab never silently falls back to another apparatus | `_isAssignedWatchApparatus`, `_openWorkerQrScanner` | WorkerApi, WorkerScreen | Assignment / selected-tab tests; mutations still require authoritative server controls |
| Cut multi-frame output: immutable saved slots, serial save/print queue, issue/peremotka, autofill/deviation approval, scoped report fallback and final print-only retries | `_ProgressQtyDialogState`, `_RezkaFramePrint`, `_RezkaDeviationWarning` | WorkerRezkaOutputWorkflow/Model, WorkerRezkaOutputReport, native fields/print controls and report modal event handoff | Focused domain, API, native event-harness tests; exact wire guards, lost responses, competing writers and account changes covered |
| Worker active-Paddon selector: assigned selected cut tab only, server-owned choice, scoped selectable rows, None, live/focus/resume refresh and verified save | `ActiveRezkaPaddonAction`, `_workerPaddonApparatus` | WorkerActivePaddon/controller/hook, native SwiftUI toolbar/sheet and Compose icon button/sheet | Controller, native event harness, hook lifecycle, 401 retry guards and existing V2 contract replay tests |
| Rezka header peremotka queue: one-shot scoped read, raw quantities and read-only roll details | `_showRezkaPeremotkaQueue`, `screen_state.dart:952` | WorkerPeremotka model/controller/hook and both native sheets; serial native header launchers | 74/74 peremotka, active-Paddon and WIP focused tests; native typechecks and lint |

## Open items

| Flow | Confirmed difference / next step |
|---|---|
| General QR | Band apparatdagi order-switch, joriy ishni report/temporary-pause qilib keyin QRni qayta uzatish oqimi qolgan |
| Paddons | Active selector va header peremotka queue ulandi. Full worker Paddon management/navigation hali ochiq. Paddon faqat biriktirilgan cut apparatus uchun bo‘lishi kerak; master read-only controllerining ruxsatini ko‘r-ko‘rona kengaytirmaslik kerak |

## Verification and limits

- Before these fixes: worker-focused suite **338/338**, both platform typechecks exit 0; lint 0 errors / 1 existing admin hook warning.
- Completed-history checkpoint: **5/5** targeted tests, both platform typechecks exit 0, lint 0 errors / the same 1 existing warning, `git diff --check` exit 0.
- Rezka Astatka checkpoint: **45/45** workflow / API / pending-store / lamination / long-press tests; iOS and Android typechecks exit 0; lint 0 errors / the same 1 existing warning; ledger resolves 1105 `@v2` and 98 `@v2-test` tags. Lamination close now also waits for the real iOS modal dismissal and blocks a competing auto-print handoff.
- Glue / non-print menu checkpoint: **99/99** focused tests; both native typechecks exit 0; lint 0 errors / the same 1 existing warning; ledger resolves 1106 `@v2` and 99 `@v2-test` tags. Safe-stop classification includes partially entered layer remainders, so they cannot silently become a no-output issue report.
- Handoff-roll checkpoint: **95/95** focused tests, both native typechecks exit 0, lint 0 errors / the same 1 existing warning; ledger resolves 1107 `@v2` and 99 `@v2-test` tags. Native form submission is exercised in a Node mock harness; physical/native rendering was not exercised.
- Report dismissal / shared instructions checkpoint: **20/20** focused tests; both native typechecks exit 0; lint 0 errors / the same 1 existing warning; ledger resolves 1107 `@v2` and 99 `@v2-test` tags. The screen harness now renders the shared instructions view before checking its actual text, order, loading and empty states.
- Apparatus-entry checkpoint: **83/83** focused tests; both platform typechecks exit 0; lint 0 errors / the same 1 existing warning; ledger check exit 0. V2's assignment guard has no print-only restriction; server controls remain the authority for each available action.
- Cut multi-frame checkpoint: **116/116** focused workflow / native event-harness / report / queue-action / printing tests. Both native typechecks exit 0; lint 0 errors / the same existing admin hook warning; ledger check exit 0 (1117 `@v2`, 102 `@v2-test` tags resolve), role ledger generated, `git diff --check` exit 0. Acknowledged output printing uses only saved QR identities, and a stale report cannot erase saved slots or regress below the write receipt's revision. Native modal timing/focus is tested with event mocks, not a phone.
- Full-tree cut checkpoint: **5365 pass, 11 fail, 12 todo / 5388 total**, log `/tmp/accord-rezka-output-final-all-tests.log`. Failure names were compared programmatically to the pre-audit log: no new or resolved failures; all eleven are the known native-module Node harness imports. The final added iOS form event/scroll-ref test is included in the 116/116 focused result.
- Full-tree checkpoint after report dismissal and instructions: **5292 pass, 11 fail, 12 todo / 5315 total**. The eleven failing cases are the same native-module Node import failures present before this audit; the two newly detected instructions harness failures were fixed. Log: `/tmp/accord-worker-audit2-final-all-tests.log`.
- Bluetooth printing checkpoint: **366/366** focused tests; both platform typechecks exit 0, lint 0 errors / the same 1 existing warning. USB/Wi-Fi printing choices are temporarily hidden by explicit user request. The multi-purpose GScale chooser retains its scale transports.
- Full tree suite before changes: **5196 pass, 11 fail, 12 todo / 5219 total**. Eleven failures are Node harness imports into native Expo/Reanimated ESM modules, not confirmed device failures. Log: `/tmp/accord-worker-audit2-full-tests.log`.
- Ledger check: exit 0, 1083 `@v2` and 91 `@v2-test` tags resolve. Eleven existing dynamic endpoint diagnostics remain.
- Whole-role text gate remains open: iOS 280 missing / 102 added; Android 280 missing / 110 added. This diagnostic is not a functional bug count; no text exception was added merely to turn the gate green.
- No physical device, simulator, emulator or printer was exercised. No external API writes or print jobs were sent. Earlier welcome/account changes remain untouched. The previous worker material/report implementation is intentionally checkpointed separately, because the next printing integration depends on it.

## Surface audit — cut report

| V2 surface and location | V4 | iOS | Android | What differs / limits |
|---|---|---|---|---|
| `_ProgressQtyDialogState._submit/build`, `admin_production_map_orders_progress_qty.dart:748,1726,1900` | WorkerRezkaOutputModel/Workflow and report | compared | compared | Waste/frame order, validation, issue reveal, freeze safe-stop and final report branches checked in source and event tests. Full worker Paddon management remains open. |
| `_rezkaFrameSection`, `_RezkaFramePrint`, `progress_qty.dart:1211`, `rezka_frame_print.dart:190,465` | Native report fields/print button and serial queue | compared | compared | Native controls replace Flutter controls. Saved-slot, held-roll, issue, uncertainty, retry and duplicate-label behavior checked. Physical printing/gesture precedence unverified. |
| `_confirmRezkaOutputDeviations`, `_confirmFreshRezkaFrame`, `rezka_deviation.dart:155,290` | Shared deviation model, native warning panel and focus/scroll target | compared | compared | Exact measurement approvals and refreshed-reference warnings tested; native warning dismissal precedes correction focus. Device keyboard behavior unverified. |
| `_cancelProgressQtyDialog`, `progress_qty.dart:383` | Queue discard panel | compared | compared | Paused queue asks before closing; cancel preserves the queue. iOS transitions await native onShow/onDismiss and do not briefly re-present the main modal on discard. |

## Surface audit — active Paddon

| V2 surface and location | V4 | iOS | Android | What differs / limits |
|---|---|---|---|---|
| `_workerPaddonApparatus`, `admin_production_map_orders_screen_state.dart:947`; multi-apparatus widget tests | WorkerScreen, workerPaddonApparatus, shared optional toolbar/action slots | compared | compared | Only the selected assigned cut tab shows the action; completed and watch-only tabs never fall back to another machine. Existing profile/menu actions stay present. |
| `ActiveRezkaPaddonAction._choose/build`, `active_rezka_paddon_action.dart:190,305` | WorkerActivePaddon and native platform picker/button | compared | compared | Native 65% sheet, identical production text keys, None before server-ordered rows, roll count/check, loading/error/empty states and dismiss behavior. Locked, peremotka and cross-apparatus rows are excluded. No local selection fallback. |
| `_refresh/_readSelection/_resetScope`, `active_rezka_paddon_action.dart:90,138,155` | useWorkerActivePaddon and controller | compared | compared | Coalesced focus/foreground/live-revision refresh, owned picker refreshes while open; late scope/account/assignment results and queued old taps cannot send PUT. Same-account 401 refresh stays valid; post-save GET is the selection authority. |

- Active-Paddon checkpoint: **99/99** focused tests; both native typechecks exit 0; lint 0 errors / the existing admin hook warning; ledger check exit 0. Shared `OrdersHeader`, `OrdersWorkspace.ios` and their props receive optional action slots solely to connect the worker's native header; other callers keep their previous defaults. Full worker Paddon CRUD/print and peremotka queue remain open.
- Active-Paddon full-tree checkpoint: **5420 pass, 11 fail, 12 todo / 5443 total**, log `/tmp/accord-active-paddon-all-tests.log`. The failing case names were compared to the cut checkpoint: no new or resolved failures; all eleven remain the pre-existing Node/native harness imports. Ledger resolves 1119 `@v2` and 104 `@v2-test` tags, role ledger regenerated. Whole-role text gate remains open with the same iOS 280 missing / 102 added and Android 280 missing / 110 added; no exception rows were added.
- Cut quick settings are restricted to `rezka_master` by V2 `_canEditRezkaPrintSide`; they are not an aparatchi omission. Native rendering and physical taps/gestures still require phone verification. No external writes, hardware printing, simulator or device launch was performed.

## Surface audit — peremotka queue

| V2 surface and location | V4 | iOS | Android | What differs / limits |
|---|---|---|---|---|
| Header replay action before active Paddon, `screen_state.dart:496` | WorkerScreen, native WorkerCutToolbar and WorkerPeremotkaButton | compared | compared | Same selected assigned cut scope as active Paddon. Native toolbar row/Compose header buttons; queued taps share one presentation owner. |
| `_showRezkaPeremotkaQueue`, `screen_state.dart:952` | WorkerPeremotka controller/hook and native sheet | compared | compared | One read on opening: apparatus, status `peremotka`, limit 500. Loading/error/empty and non-interactive rows retain V2 texts/order, untrimmed typed reason, integer frame and full raw quantity. Dismiss aborts the owned read; route/account/assignment changes discard late responses. |

- Peremotka checkpoint: **74/74** focused tests; both native typechecks exit 0; lint 0 errors / the existing admin hook warning; ledger check exit 0 (1121 `@v2`, 104 `@v2-test` tags resolve). V2 has no separate recorded contract for this header preview; the exact query was checked from its source and exercised against mocked transport. No real read/write, printer, physical device or simulator was used.
- The remaining shared WIP-consumer suite, `tests/workerOrderParity.test.cjs`, also passed **46/46**. The most recent full-tree run is the active-Paddon checkpoint above; it was not repeated for this read-only preview after all four directly affected WIP consumer test files passed.
