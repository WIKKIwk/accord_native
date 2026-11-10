# Aparatchi — navbatdagi tekshiruv va tuzatishlar

Status: in progress.
Stopped at: navbat, QR, printer, kunlik ish va shartli apparat oqimlarini V2 bilan tekshirish.

Specification: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`; checkout `lib/` va `test/` bilan bir xil. V2 va Mini ERP read-only. Wikki `main`da ishlash va har tekshirilgan o‘zgarishni commit qilishni aniq so‘radi. USB va Wi-Fi chop etish tanlovlari hozircha chiqariladi; Bluetooth qoladi. Bu foydalanuvchi qabul qilgan V2 farqi, yashirin parity da’vosi emas.

## Completed

| Change | V2 reference | V4 | Verification |
|---|---|---|---|
| iOS tugallangan buyurtmada issue note bo‘lsa muzlatish tafsiloti ochiladi; oddiy order WIP tarixiga boradi | `lib/src/features/admin/presentation/admin_production_map_orders_screen_state.dart:2899` | `src/components/WorkerWipHistory.tsx` | `tests/workerCompletedHistory.test.cjs`: render, branch, close |
| Oldingi F01–F11 homashyo/progress/hisobot portining checkpoint’i | `aparatchi-order-sheet.md` | OrderScreen, worker material/progress/native components and their dependencies | Worker focused suite 340/340, both typechecks exit 0 |
| Output / WIP reprint Bluetooth printer tanlovi va local print-job execution bilan ulandi; iOS report modal dismissal yakunini kutadi; completion request draftni tozalamaydi | `_pickProgressPrinter`, `_ReadOnlyOrderDetailSheetState._runQueueAction`, `_WorkerWipHistorySheetState._reprintWip` | `workerPrinting.ts`, OrderScreen, WIP details, shared printer pickers | Worker/printer suite 366/366, both typechecks exit 0; cancellation, stale session, print failure and modal dismissal covered |
| Cancel-start menyu entry, native confirmation, owner/operation/cursor/token qayta tekshiruvi | `admin_production_map_orders_cancel_start.dart` | `workerLongPress.ts`, `WorkerLongPressActions.tsx`, WorkerScreen | 54/54 menu/control tests; both typechecks exit 0, lint 0 errors / 1 existing warning |

## Open items

| Flow | Confirmed difference / next step |
|---|---|
| General QR | FAB QR qiymati orderga uzatilmaydi; URL QR normalizatsiyasi va band apparatdagi order-switch oqimi yetishmaydi |
| Daily work | Waiting WIP correction, reason va QR/reprint entry’lari ulanmagan |
| Lamination / cut | Bosma formasi bilan aralashtirilgan conditional report/handoff branchlarini ajratish |
| Scanned WIP | Tarix va return API bor, worker oynasida entry yo‘q |
| Instructions / paddons | Worker navigation placeholder. Paddon faqat biriktirilgan cut apparatus uchun bo‘lishi kerak |

## Verification and limits

- Before these fixes: worker-focused suite **338/338**, both platform typechecks exit 0; lint 0 errors / 1 existing admin hook warning.
- Completed-history checkpoint: **5/5** targeted tests, both platform typechecks exit 0, lint 0 errors / the same 1 existing warning, `git diff --check` exit 0.
- Bluetooth printing checkpoint: **366/366** focused tests; both platform typechecks exit 0, lint 0 errors / the same 1 existing warning. USB/Wi-Fi printing choices are temporarily hidden by explicit user request. The multi-purpose GScale chooser retains its scale transports.
- Full tree suite before changes: **5196 pass, 11 fail, 12 todo / 5219 total**. Eleven failures are Node harness imports into native Expo/Reanimated ESM modules, not confirmed device failures. Log: `/tmp/accord-worker-audit2-full-tests.log`.
- Ledger check: exit 0, 1083 `@v2` and 91 `@v2-test` tags resolve. Eleven existing dynamic endpoint diagnostics remain.
- Whole-role text gate remains open: iOS 280 missing / 99 added; Android 280 missing / 108 added. This diagnostic is not a functional bug count.
- No physical device, simulator, emulator or printer was exercised. No external API writes or print jobs were sent. Earlier welcome/account changes remain untouched. The previous worker material/report implementation is intentionally checkpointed separately, because the next printing integration depends on it.
