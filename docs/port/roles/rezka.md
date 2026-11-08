# Rezka role UI contract

Source: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`. This is a working contract, not a claim that any surface is complete.

## Reachability

`AppSession.homeRoute` selects `apparatusQueue` for a `rezka_master` with `rezka.master.access`. `AppRouter.canOpenRoute` allows only `apparatusQueue`, `apparatusDailyWork`, `apparatusWorkInstructions`, `apparatusPaddons`, `apparatusPaddonDetail`, `adminWorkerSettings`, and `adminAdditionalSettings` for that role, in addition to common account/profile/chat routes. `rezkaSplit` is not in that allowlist. The separate `rezkaSplit` route belongs to sessions that pass its `rezka.split.manage` capability guard. Do not add it to the master drawer. V2 references: `app_router_AppRouter_resplit_class_AppRouter_resplit2_static_methods_02.dart:28–37` and `_routeCapabilities.dart:87`.

## Master workers and apparatus

V2: `AdminWorkerSettingsScreen`, `admin_worker_settings_screen.dart:62–96`, `_methods_01.dart:22–185`, `_methods_02.dart:145–220`, `_widgets_part_06.dart`, `widgets/admin_apparatus_scope_picker.dart`. Hook/controller: `src/rezka/useRezkaWorkerSettings.ts`, `rezkaWorkerSettings.ts`. Route and platform screens are pending.

- Master sees the operator shell, `worker.title`, no admin tabs or creation actions. The existing Aparatchi drawer and dock are reused; dock has `activeTab: null` and `showPrimaryFab: false`.
- Initial load and pull refresh start `rezkaMasterWorkers()` and `adminApparatus(limit: 500)` together. Show a loading indicator until both complete, `worker.load_failed` if either fails, `worker.empty` for an empty team, otherwise preserve the server's worker order. One card expands at a time.
- A card heading displays worker name, localized level (unknown level falls back to `3 - darajali`) and nonempty phone. Expanded details in order: `worker.worker_details` with name; `worker.name_label`, `worker.level`, `worker.phone_label` (or `worker.not_entered`), `worker.id`; `scope.operator_title` apparatus selection. Master cannot edit name, level, deactivate, create, or manage groups.
- Picker is a dismissible, draggable bottom sheet with title `scope.operator_title`, subtitle worker name, description `rezka_master.rezka_apparatus_required`, then `scope.allowed` and the loaded apparatus list as checkboxes. Initial selection includes only assigned IDs present in that list. Empty selection disables `scope.save_action`; saving prevents another save, selection changes and the sheet’s close button, and uses `action.saving`. The modal itself uses Flutter defaults and can still be dismissed by back, swipe or barrier; completion may then update the underlying list.
- Save normalizes selected IDs by trimming, removing duplicates and sorting. A canonical set equal to the saved assignment does not issue a write and shows `scope.already_assigned` with sorted names. Otherwise PUT includes worker ID, the selected list, and the unmodified previous list. A success closes the sheet, shows `scope.saved` for five seconds and reloads. `rezka_worker_has_open_run` leaves the sheet open and shows a live error in the sheet, including worker and blocked apparatus names when supplied. `rezka_assignment_changed` and master `worker_not_found` close, show `rezka_master.rezka_assignment_changed` and reload; `rezka_apparatus_required` and other errors use the source's notices.
- Scoped data and mutation attempts belong to the exact active session and captured capability/apparatus scope. No 401 retry may send with a different session or scope. A sent request whose result becomes uncertain must not be silently retried or shown as success. Screen hookup still requires reliable invalidation when the same Session object is mutated in place.

## Master order options in reused queue

V2 `admin_production_map_orders_helpers.dart:3–45`: only a Rezka master assigned to an apparatus in a map's linear work stages can edit print side; IDs beginning `training-` or `template-` cannot. Additional options are unavailable when lifecycle status is `production_completed`, `closed` or `cancelled`. Save sends new and previous print side / duplicate label / bobina values; conflict errors preserve V2 translations. Native existing `WorkerScreen`/`OrderScreen` and their route implementations are protected. Their full latest-baseline UI and integration are open, not duplicated here.

## Additional Settings

V2 master uses the shared `AdminAdditionalSettingsScreen`, only the two Paddon switches, with the same operator shell and no primary FAB. Shared component is owned by the admin session. No duplicate implementation is permitted here.

## Split, item picker and scanner

V2 `rezka_split_screen.dart`, `_methods_01.dart`, `_methods_02.dart`, `_declarations_part_01.dart`. Source and split APIs: `src/rezka/rezkaSplitApi.ts`; pure barcode, draft and quantity rules: `rezkaSplitLogic.ts`. Both platform screens, guarded routing, item picker, scanner and printer integration remain open.

- Screen: `Rezka`, subtitle `Mahsulotni bo‘lish`, Source QR field, scan action, `QR ni tekshirish`, printer selector. A successful source read replaces drafts with two empty outputs seeded with source unit (or `kg`) and warehouse; it shows source name/code/quantity/location. Add output, remove only while more than two. Per output show product selector for QR outputs or `Atxot: QR chiqarilmaydi`, quantity, UOM, location, reason, then overall reason and expandable Printer fields (Driver URL, Printer, Mode). Submit is `Bo‘lish va QR chiqarish`; loading and submission disable their respective buttons.
- Item picker is a bottom sheet, search `ERPNext item qidirish`, 220 ms debounce, `gscaleItemsPage(query, limit: 30)` and `Mahsulot topilmadi` empty state. Selecting an item sets code, name, UOM (default `kg`) and nonempty warehouse. The scanner is a full-screen dialog, `QR scan`, QR and Data Matrix, with `Scanner bu qurilmada ishlamaydi` where unsupported; cancellation has no effect.
- For local printing, prepare first, print every QR-enabled output with nonempty EPC, then confirm using exactly those EPCs and only if prepared count matches input. Remote/Wi-Fi calls direct split. Never confirm after a failed local print. Do not report an uncertain backend mutation as failed or repeat it automatically. Existing shared picker extraction needs a safe transient consumer and supported USB/Bluetooth/Wi-Fi transports; GoDEX is excluded by project decision. No fake printer or successful print is allowed.
- Output validation requires item on QR outputs, positive quantity and location; scrap can inherit source item. Total within 0.0001 is accepted; a remainder opens `Miqdor yetmayapti` with `Unutibman`, `Brak mahsulot`, `Bekor qilish`, and adds the selected new draft before requiring another submit. Scrap goes to `brak - ombori - A`, no QR and reason `Atxot / brak mahsulot`. Excess shows the V2 snackbar. Server total mismatch can add remaining output or show a mismatch message as in `_methods_02.dart`.
- Exact messages, loading, back/sheet dismissal, printer errors and user-visible text still need platform-by-platform audit. No simulator or phone validation has been performed.
