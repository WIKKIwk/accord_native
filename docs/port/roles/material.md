# Material ta’minotchisi: UI contract, f11910bb

Specification: `f11910bb2c8c7081ce26770e69811b03fd0739ed`. This describes the source contract; `docs/port/status/material-taminotchi.md` records this branch’s implementation and verification. The older `material.md` status describes the historical partial checkpoint. Role access is `material_taminotchi`; use the existing route capability guards, session witness and security. Shared Chat/unread, profile, settings and PIN are reused. Material’s receipt policy excludes GoDEX, including restored choices and dispatch, without changing other roles.

## Home: `MaterialTaminotchiHomeScreen`

`material_taminotchi_home_screen_widgets_part_01.dart:123` refreshes the profile on pull, swallowing a failed refresh and retaining current scope. A blank `assignedItemGroups` shows `Mahsulot guruhi biriktirilmagan` and `Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.` The cards, in order and only when route capability permits, are `Vazifalar`, `Kirim`, `Homashyo biriktirish`, `Joylashtirish va transfer`. A material-group-scope failure when opening assignments or scanner produces a snackbar `Avval material guruhlari biriktirilishi kerak` and does not navigate. FAB actions are `Kirim`, `QR skanerlash`, `Homashyo biriktirish`, `Joylashtirish va transfer`, in that order. Scanner calls `showRawMaterialScanDialog`, then passes `rawMaterialBarcodeFromQr` to assignments; cancel/empty does nothing. Drawer and dock have additional navigation, recorded below. Every unimplemented action stays open in the status; do not mark this surface covered by an empty or partial screen.

## History: `MaterialTaminotchiHistoryScreen`, `_MaterialHistoryDetailsSheet`

`material_taminotchi_home_screen_widgets_part_01.dart:4`, `material_taminotchi_home_screen_declarations_part_02.dart:149`, `material_taminotchi_home_screen_declarations_part_03.dart:60`: open from `Harakatlar tarixi`. Load `adminRawMaterialHistory(limit: 100)` and independently `adminApparatus(limit: 10000)`; a catalog error is swallowed. Show spinner while loading. A failed history shows tappable `Tarix yuklanmadi` with the source-derived error; tap retries. Empty history says `Harakatlar hali yo‘q`. Render up to 100 events in returned order; cards have event-specific title, warehouse/order/friendly apparatus/barcode subtitle and local time. Pull refresh reloads history. Tapping opens a dismissible bottom sheet, with the event title and subtitle followed by nonempty detail rows from `_materialHistoryDetails` in source order. Do not reveal raw colon-separated person refs or unresolved canonical apparatus IDs. Close by platform back, tapping outside or dragging. Account switch must dismiss sheets and discard old results before a new account can see them.

The f119 details header includes the event icon, title and subtitle. The whole header and all detail lines share one vertical scroll surface, with no nested detail-list viewport. Each line has a leading label column and a wrapping value. Error and empty messages retain their respective error/history status icons; only the error message retries on tap. Native iOS symbols adapt the Android source icons.

## Navigation

Drawer `Material bo‘limlari`: home (`homeNavTitle`), `Vazifalar`, `Ketma-ketlik`, `Kirim`, `Harakatlar tarixi`, conditional `Homashyo biriktirish`, conditional `Joylashtirish va transfer`, profile (`profileTitle`). Drawer closes current destination without navigation; the other entries push except home. Logout uses shared `showLogoutPrompt`. Dock order is home, `Kirim`, `Vazifalar`, profile, Chat; V2 appends Chat in `RoleDock`. Reuse real shared Chat/unread and hide the dock in a conversation. Profile uses the existing shared Profile screen with no `onDailyWork` callback because V2 Material does not expose that row. Its settings/PIN use existing native pages. Deep links apply the same source capabilities; denied routes show centered localized `accessDenied`.

## GScale and shared operational pages

`_MaterialGScaleControlScreen` reuses Preparation’s control-only dashboard, APIs, durable draft, command owner and print transports with `Homashyo kirimi`, `Print`, `Print tarixi`, linked-order loading and refreshed scope. Material retains its own shell. Its opt-in presentation and policy preserve shared defaults.

- Preserve item/apparatus/warehouse choices, linked-order lock and width validation, bobbin/tare/gross/net/manual kg, copies, save/start/stop/print enable conditions and the full batch-close confirmation. Saving without a device is allowed under source rules.
- Start locks before autosave. Restoring an active batch cannot overwrite a changed order/new batch. A 409 refresh retains the other-order conflict and supports retry without unlocking. Reuse existing idempotency and uncertain-command protection.
- Control-only explicitly hides the current-batch QR list. Archive retains source metadata, full detail and nested receipt QR, empty-EPC disable, warning/success, busy/close and copy/delete visibility.
- Device selection order is USB / Bluetooth / Wi-Fi. Preserve source loading/empty/error/retry and Bluetooth technical disclosure. The nested manual-server sheet probes, closes, then returns the selection. Reuse real UDP/NSD/Bonjour, Bluetooth and Zebra USB bridges.
- GoDEX is excluded by D13, including restored choices and Material dispatch. Shared demonstration mode is deferred by D3. No device/hardware success is claimed; development-client rebuild and physical verification remain explicit checks.

## Tasks and full-order detail

V2: `SupplyTasksScreen` and Material branches of `AdminProductionMapOrdersScreen`. V4: `MaterialTasks.*`, `MaterialTasksRoute`, shared `SupplyTasksController`, `materialTaskLive`, `materialTasksWarmStore`.

- Reuse Worker list, order row, search, apparatus filter and page-size controls. Preserve source counts, selection, 250 ms Dart-trimmed/lowercased search debounce, loading/empty/error/retry and pull refresh.
- Use the compact source window endpoint. Validate canonical apparatus IDs, literal JSON integer forms and the source Unicode lowercase table. Keep up to eight memory aliases and existing durable snapshot storage, fenced to the original session/window.
- Source live path/query, ten-second first-message timeout, reconnect 1/2/4/8/16/30 seconds, atomic delta validation and one bounded chain-repair resync. Background/unmount/account retirement cancels owned work. No added HTTP polling.
- Tap hydrates the exact full order in the existing native bottom sheet. Long press hydrates then opens receipt and refreshes after return. Opening a native detail/receipt does not retire the still-mounted list owner.
- Full detail reuses Worker overview/image, assigned material/QR/balances and unlink, molds/product QR, expected summary, production map/WIP and read-only stage history in source order. No Worker stage reprint/reactivation. Sequence entry passes its actual context; task entry does not invent one.
- Receipt arguments preserve original order code/description/width/kg and `saved: false`. Enable by source Material/nonworker/not-busy rules; the receipt destination applies its own GScale capability denial. Reload detail on return.

## Supply sequence and its assignment sheet

V2: `SupplySequenceScreen`, snapshot/live helpers and `_SequenceRawMaterialAssignmentSheet`. V4: `MaterialSequence.*`, shared sequence controller/model/API/live, `MaterialSequenceAssignment.*` and its shared controller.

- Use the global canonical snapshot, source apparatus/queue order and live state-delta stream with `worker_scope=false`; do not substitute Preparation’s differently scoped queue. Preserve full/hash/list-edit validation, fallback protocol and canonical snapshot cache behavior.
- Keep source search/filter/counts/loading/error/refresh and full detail with actual sequence context.
- Assignment is a separate native bottom sheet with order/apparatus, material filters/balances, multi-selection and manual/QR tabs. Sequential bulk write stops on the first failure and retains remaining selections.
- Embedded quick scanner suppresses repeated QR input for two seconds. Keep unmatched/consumed/incompatible diagnostics and ambiguity choice. Width allowances remain printing +20 mm and lamination +30 mm.

## General manual/QR assignment

V2: `AdminRawMaterialAssignmentsScreen` declarations/method/widget parts. V4: `MaterialAssignments.*`, `materialAssignmentsController`, `useMaterialAssignments`, `materialAssignmentPresentation` and native order picker.

- Load orders, assignments and apparatus concurrently. Select first source order and first authorized apparatus. Initial QR lookup runs independently of pending lists. Preserve manual/QR modes and loading/empty/error/refresh/save states.
- Manual mode uses source order picker, apparatus filter, candidate balances and current assignments. Candidate details close before the separate confirmation/choice. iOS waits for native sheet dismissal.
- QR uses existing parser/bootstrap lookup and source diagnosis. Save requires successful lookup, compatible/unassigned/unconsumed stock and no busy state. Keep source labels and the single-apparatus shortcut.
- Only the exact source ambiguity response permits a choice and second write; never automatically retry an uncertain write. Notices retain source tone and five-second lifetime.
- Unlink uses source confirmation and case-sensitive order/barcode identity; success clears matching scanned metadata. Stale order/QR/account responses are inert.
- Preserve V2’s manual order-change quirk: do not eagerly run the QR branch’s candidate reload.

## Inventory movements

Reuse `WorkerInventoryScreen` through `MaterialMovements.*`: original owner, requests, filters, QR lookup, details, actions and warehouse/group scope. Do not duplicate the existing inventory logic. Android uses existing Compose Material controls; iOS uses existing SwiftUI controls and substantial buttons.
