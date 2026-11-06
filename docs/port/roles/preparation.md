# Tayyorlov masteri — UI contract (V2 baseline 7c87a54e)

This document is the hand-off to the iOS and Android sessions. The route and view files are owned by those sessions; the logic session does not create native screens. This contract describes the V2 behaviour, including the still-open implementation items in `docs/port/status/preparation.md`.

## Shared rules

- The home route is `AppRoutes.preparation`, guarded by `preparation.access` for `tayyorlov_masteri`. `preparationFormulas` and `preparationProduction` use that capability; production additionally requires the master role. `supplySequence` is permitted to `qolip.manage`, `raw_material.assign` or `preparation.access`; for the real preparation session it opens the specialized read-only preparation order list. The base `src/shared/appRoutes.ts` already contains the guards. Native routes and the home-target entry remain platform/integrator work.
- Common dock: `Tayyorlov` replaces the root with home; `Profil` replaces it with profile. `Amallar` is present only when actions are supplied and opens those actions. Drawer: `Tayyorlov`, `Formulalar`, `Ishlab chiqarish`, `Ketma-ketlik`, conditional `Kirim` (scale capability), `Chat`, conditional `Ishlab chiqarilgan homashyolar` and `Profil`. `Ketma-ketlik`, `Kirim` and inventory movements are pushed; the other root destinations replace the root. Source: `features/preparation/presentation/preparation_navigation.dart`.
- Most of these V2 texts are literal Uzbek passed to `UrduAwareText` or `uiText`, so the literal itself is the lookup key in the generated `src/shared/localization/catalog.json`; `profileTitle` is an `AppLocalizations` getter and `worker.queue.search.sequence` is a `productionText` key. Keep interpolation values and fallback literals as in V2. The source sections below identify the complete literal and dynamic text for each view; the exact per-literal inventory is still an open item.
- Loading, empty and retry/error states must be visible as specified below. A network failure uses the relevant API error and retry behaviour, not fabricated empty data. No preparation view defines a separate offline, frozen or permission-denied panel: failures surface through the existing error text, and actions are disabled where noted. A session scope change discards scoped results; the sequence and catalog explicitly clear visible rows. No direct haptic call is defined in the preparation source files; preserve any behaviour of shared controls separately.
- Back closes a pushed screen/sheet and returns to its caller; root dock/drawer transitions above replace the root. The two formula dialogs below cannot be popped while saving. After returning from home child screens, home reloads. Pull-to-refresh must work even with short or empty lists.

## Home — `PreparationScreen`, `preparation_screen.dart:57`

Entry: preparation home. Logic: `usePreparationHome`, `preparationPendingCommand`, `preparationSnapshot`, `preparationSubmit` and `preparationLogic.ts`.

Initial state shows loading until pending command and snapshot are read. Keep the previous snapshot when a reload fails and show `Xatolik yuz berdi` plus the error. A single assigned warehouse is selected automatically; an invalid previous selection is cleared when multiple or no warehouses remain. No assigned warehouses shows `Sizga ombor biriktirilmagan. Admin foydalanuvchi kartasidan ombor biriktirishi kerak.` A pending command displays `Tasdiqlanmagan operatsiya`, its receipt quantity, material name or order ID, and `Tekshirish`; retry the same kind and payload. Loading, saving or a pending command locks stock/formula actions. While not saving/loading, pull-to-refresh reloads pending and snapshot.

Cards: `Ombor` opens warehouse if unlocked; `Homashyolar` and `Mahsulot formulasi` open their respective screens if unlocked; `Buyurtmalar` replaces the root with `supplySequence`; `Ishlab chiqarish` replaces it with the production journal; `Ishlab chiqarilgan homashyolar` pushes inventory movements; `Tarix` opens history. FAB offers the same warehouse/material/formula/history/order actions plus `Tarozi kirimi` when scale is permitted and `Kirim` when no warehouse is selected or it belongs to `material_warehouses`. `Kirim` without a selected warehouse opens warehouse; for a non-manual warehouse open scale, otherwise pick a visible, receivable material. Create material prompts `Yangi homashyo`/`Homashyo nomi`; receipt prompts `<name> — kirim`/`Kirim (kg)`. Successful stock command shows `Saqlandi`; failures show the error and always reload. Returning from scale reloads.

## Warehouse — `PreparationWarehouseScreen`, `preparation_screen_forms.dart:83`

Entry: home warehouse. Logic: `usePreparationHome`, `preparationVisibleMaterials`, `preparationReceiptMode`, `preparationCreateWarehouse`, `preparationRenameWarehouse`, `preparationDeleteWarehouse`.

Filter only assigned warehouses; search matches material name/code case-insensitively and lists visible materials, including zero balance. Empty texts: `Sizga ombor biriktirilmagan.`, `Yuqoridagi filtrdan ombor tanlang.`, `Bu omborda hali kirim yo‘q.` The warehouse filter says `Ombor`/`Tanlanmagan`, search says `Qidirish`, row balance says `Mavjud qoldiq`. Selecting a warehouse updates the parent. Tap a material to open detail; refresh reloads parent then synchronizes materials.

When selected and unlocked, `Kirim` picks a receivable visible material if the warehouse is in `material_warehouses`; otherwise `Tarozi kirimi` opens scale. `Homashyo qo‘shish` is available only for manual material warehouses. `Ombor qo‘shish` requires an unlocked state and at least one material warehouse; pick parent, enter a nonempty name, create, reload and select the returned warehouse. Long press offers rename/delete only for a managed warehouse, unlocked and not currently managing; delete requires confirmation. After success reload, replace a selected renamed warehouse or select the first remaining one after deletion. Errors preserve the existing state. Return to home causes a reload.

## Material detail — `PreparationMaterialDetailScreen`, `preparation_screen_forms.dart:548`

Entry: warehouse material row. Logic: `preparationMaterialHistory`, `preparationReceiptMode`, `usePreparationHome`. Show the material, balance and matching receipt/reversal and consumption lines for that warehouse and item only. Sections `Kirimlar`, `Chiqimlar`; no matching history shows `Bu homashyo bo‘yicha hali kirim yoki chiqim yo‘q.` Reversed entries show `Bekor qilingan`, reversals show the reason when present. `Kirim qilish` requires a material, unlocked state and `can_receive` for a manual warehouse; otherwise the action is `Tarozi kirimi` and opens scale. Reload parent and synchronize material/history after return. Pull-to-refresh reloads and synchronizes. Back returns to warehouse.

## Materials — `PreparationMaterialsScreen`, `preparation_materials_screen.dart:3`

Entry: home/FAB. Logic: `usePreparationMaterials`, `preparationWarehouseChoices`. Load only owned materials; search name, code and warehouse labels (`Homashyoni qidirish`). Show `Hali homashyo yaratmagansiz.` or `Homashyo topilmadi.` when appropriate, `Ombor biriktirilmagan` for no assignment, and error plus `Qayta urinish` on failure. Pull refresh retains current rows during refresh. Loading, refresh and save block actions.

Row menu: `Nomini o‘zgartirish`, `Omborga biriktirish`, `O‘chirish`. Rename uses prefilled nonempty name and updates/reorders only after confirmation from server. Delete warns that used material, stock, receipts or formulas prevent removal and needs destructive confirmation. For assignment first load snapshot; show union of existing and exclusive material warehouses sorted. Existing nonexclusive assignments are disabled with `Bu biriktirishni faqat administrator o‘zgartira oladi`. `Saqlash` is enabled only when the set changed; it sends the sorted selection, including an empty list, and updates only after server confirmation. Warn `Bu amal ombordagi qoldiqni ko‘chirmaydi.` Errors leave the row intact. Back returns and reloads home.

## Formula catalog — `PreparationFormulaCatalogScreen`, `preparation_formula_catalog_screen.dart:3`

Entry: drawer `Formulalar`. API: `preparationFormulaCatalog`, `preparationRenameFormulaVariant`; shared formula editor: `usePreparationFormula`. Load/refresh with retry; clear rows and show `Akkaunt o‘zgargan. Sahifani qayta oching` on account change. Search literal `Formula nomi, kodi yoki buyurtmani qidirish` across name, code, material, set, product title/code and order codes. Header is `Barcha buyurtmalarning formulalari: <n> ta`; empty `Saqlangan formulalar yo‘q.` or `Formula topilmadi.` Tap opens saved recipe editor using product/material/variant and `can_create`; long press offers rename. Busy/loading/scope change prevents opening or rename; reload after return or successful rename. Use `usePreparationLibrary` in catalog mode for this state.

## Formula sets and details — `PreparationFormulaOrdersScreen` / `_PreparationFormulaSetDetails`, `preparation_formula_orders_screen.dart:8,209`

Entry: home `Mahsulot formulasi`. APIs: `preparationFormulaSets`, `preparationFormulaCatalog`, `preparationRenameFormulaSet`, `preparationDeleteFormula`, `preparationUpdateFormulaShares`; editor: `usePreparationFormula`. Load sets then catalog; error retains rows and provides `Qayta urinish`. Search ID, name, product title/code and order codes (`Kod, nom yoki buyurtmani qidirish`). Empty `Saqlangan formulalar yo‘q.` or `Formula komplekti topilmadi.` Count catalog recipes for product plus legacy entries with empty variant ID. Long press renames a set only after the server confirms the same ID; loading/rename locks actions.

Set details show `Katalogdagi o‘zgarishlar formula keyingi safar buyurtmaga biriktirilganda olinadi.` Show catalog recipes and legacy formulas; empty `Bu komplektda formula qolmadi.` Tap a catalog entry opens its saved formula editor; long press renames. A legacy formula opens details with edit, delete and share actions. Edit uses its exact material/variant/name. Delete needs confirmation and removes only that tuple; share edit groups formulas by material and variant. Reload after returning or a successful change. Use `usePreparationLibrary` in sets mode for the set list and `usePreparationSetDetail` for its details.

## Order variants — `PreparationFormulaVariantsScreen`, `preparation_formula_variants_screen.dart:20`

Entry: preparation order formula navigation for a product, order and material. APIs: `preparationFormulaVariants`, `preparationCreateFormulaVariant`, `preparationReuseFormulaVariant`, `preparationRenameFormulaVariant`, `preparationRemoveFormulaVariantFromOrder`. Initial/refresh load is scoped to the current account; empty `Hali shnek varianti yo‘q. FAB orqali variant qo‘shing.` Failure shows retry. Rows show variant code, `Tarkib hali kiritilmagan` or count and completeness. Tap opens that variant's editor; long press offers `Tahrirlash`, `O‘chirish`, `Nomini o‘zgartirish`; remove requires confirmation and affects only this order. In-flight create/open/remove or changed scope blocks further actions.

`Variant qo‘shish` opens the name dialog and creates a single secure request ID before showing it; uncertain retries in the same dialog reuse that ID. `Qidirib variant qo‘shish` opens searchable catalog, using `loadReusePage` and `preparationReuseSubtitle` from `usePreparationVariants`, and copies the chosen variant into this exact order/material scope; cancel creates nothing. Open editor after successful create/reuse and reload on return.

## Formula editor — `PreparationOrderFormulaScreen`, `preparation_order_formula_screen.dart:93`

Entry: variants, catalog or set detail. Logic: `usePreparationFormula`, `preparationLogic.ts`. Load snapshot, scoped formula details and, for an order, the matching responsibility estimate; a missing/invalid estimate does not block editing and shows `Taxminiy kg hisobi hozir mavjud emas`. Sort available materials by lowercase name then code. Initial requested formula opens the editor; missing initial name shows `Formula topilmadi. Ro‘yxatni yangilang`.

A formula detail sheet offers `Shnek ulushlarini belgilash`, edit and delete. Add creates the next unused A–Z, AA… name. Each row needs a material and a strictly positive percentage up to 100 with at most six decimals; duplicate material codes are forbidden and the sum must equal exactly 100%. Show the first specific validation error and disable save until valid. Save uses normalized six-place percentages and the selected product/material/variant/order scope. Delete requires confirmation. Both refresh formula details on success and show errors without pretending success. If the post-save refresh fails, keep the successful save and expose the controller’s `notice` for the refresh error. Shares require positive percentages each at most 100 and an exact total of 100%; estimates require complete shares and are calculated from the order's material estimate, not overall order kg.

`Ishlab chiqarishni boshlash` is shown only outside saved-library management with scale permission, valid order/material and no load/save/delete/open in progress. If a variant is order-scoped, select it with the current recipe key before opening a fresh scale form with the order, material and variant; on HTTP 409 refresh formulas. The opening flag stays set until the scale screen returns. Pull refresh reloads. Back returns to the caller.

## Share sheet and name dialog — `_FormulaSharesSheet`, `_VariantNameDialog`

Sources: `preparation_formula_shares_sheet.dart:32`, `preparation_formula_variants_screen.dart:390`. Share sheet starts with current values, shows total and `Har bir shnek uchun 0 dan katta, 100 gacha foiz kiriting` when invalid; save is enabled only at exactly 100% and while not saving. Recheck account scope before save; saving blocks edits and back. On success return formulas; errors remain in sheet. Name dialog collapses whitespace, requires a nonempty name of at most 160 Unicode code points different from the initial name, blocks back/cancel and input while saving, and keeps the same creation request ID across retries. Rename helper explains whether the name applies only to the order or future assignments.

## Production journal — `PreparationProductionScreen`, `preparation_production_screen.dart:27`

Entry: home/drawer. Logic: `createPreparationProductionOrdersJournal` and `PreparationJournal`. Search `Buyurtma, homashyo yoki formula` with 350 ms debounce; status `Barchasi`, `Davom etmoqda`, `Yakunlangan` sends `all`, `active`, `completed`. New search/filter resets to offset zero. Empty `Hali ishlab chiqarish yozuvlari yo‘q.`, loading spinner or progress for existing rows, error/retry, `Yana yuklash` when more exists. Tap order to open order journal. Pull refresh reloads; every 15 seconds silently refresh the entire loaded page window only while route is current, app resumed, scope unchanged and no read is running. Resume refreshes silently. Account change clears rows and shows `Akkaunt o‘zgargan. Sahifani qayta oching`. Search back pops if possible, otherwise replaces root with home.

## Production order — `PreparationProductionOrderScreen`, `preparation_production_screen.dart:33`

Entry: journal order row. Logic: `createPreparationProductionOrderJournal`. Displays selected order summary and batches; tap batch to open batch journal. Same paging, retry, scope, refresh and lifecycle rules as above. Empty `Bu buyurtma bo‘yicha ishlab chiqarish yozuvi yo‘q.` Back returns to journal.

## Production batch — `PreparationProductionBatchScreen`, `preparation_production_screen.dart:41`

Entry: order batch row. Logic: `createPreparationProductionBatchJournal`, `reprintPreparationRoll`. Show active/completed status, timestamps, metrics, the captured immutable recipe and produced rolls. Empty `Hali rulon kirim qilinmagan.` Missing recipe shows `Formula qayd etilmagan`. Tap a roll to open QR sheet. Same paging, retry, scope, refresh and lifecycle rules. Back returns to the order.

## Roll QR sheet — `RpsQrReprintSheet`, `core/widgets/feedback/rps_qr_reprint_sheet.dart:17`; caller `preparation_production_screen.dart:646`

Entry: produced roll. Logic: `reprintPreparationRoll` plus printer selection and real transport, which remain open. Show `Chop etilgan QR`, item name, QR and EPC, captured recipe and `Qayta chop etish`. During printing disable repeat; cancel printer selection silently clears busy. Prepare server reprint and verify EPC/receipt identity before choosing printer; confirm server only after a successful physical print. Success shows `Mavjud QR qayta chop etildi`; print error stays in the sheet. A print followed by account change or failed confirmation displays `QR chop etildi, lekin server tasdig‘i saqlanmadi`. No close button is supplied by this caller; normal sheet dismissal applies. V2 passes roll detail rows but also supplies `detailsContent`, so this particular sheet renders the recipe instead of those rows; preserve that quirk until explicitly changed.

## Sequence — `AdminProductionMapOrdersScreen` / `_PreparationOrdersListState`, `admin_production_map_orders_screen_widgets.dart:236`, `admin_production_map_orders_preparation_list.dart:5`

Entry: home `Buyurtmalar` or drawer `Ketma-ketlik`. Logic: `PreparationOrdersState`, `PreparationOrdersWarmStore`, `preparationOrders`, `preparationOrderDetail`, `subscribePreparationOrdersLive`. Restore display-only cached rows without waiting for network; selected apparatus is loaded from the shared apparatus selection store. Initial reads request only scoped labels, not full queue. Search is server-side with 250 ms debounce; apparatus change persists selection and resets query window. Rows retain server position and are read-only; first paint text before mounting thumbnails. Near the list end or `Yana yuklash` loads the next cursor. Refresh forces an HTTP reload while retaining the visible prefix across matching versions. Error shows retry; 401/403 or live access error withdraws cached rows; an invalid live baseline causes one repair read. Foreground reconnects the stream, background stops it. Do not accept a stale account/query/cursor; account change clears rows. Empty `Mos buyurtma topilmadi.` Search hint uses `productionText('worker.queue.search.sequence')`.

Tap a row opens a non-dismissible detail host immediately, then reads only that order using `preparationOrderDetail`; loading/error/retry belong inside the sheet. It remains valid only while the same scoped row exists. Display is read-only: no reorder, write or WIP QR reprint. This borrowed admin view and its route/native navigation are outside this logic session; the integrator and platform sessions must connect the domain controller and existing shared detail presentation.

## History and input — `PreparationHistoryScreen`, `_PreparationInputDialog`, `preparation_screen_forms.dart:1117,1335`

History shows the last 100 receipt/consumption records or `Hali kirim yoki sarf yo‘q.` A non-reversed receipt long press offers `Kirimni bekor qilish`; it is enabled only when `can_reverse` is true. Require a nonempty reason up to 500 characters and destructive confirmation; after success prepend the reversal, mark the matching receipt reversed/non-reversible, reload parent, and show `Kirim bekor qilindi`. Failure retains history. Pull refresh delegates to the parent.

Input dialog trims values, rejects an empty name (`Nom kiriting` or supplied error) and text beyond the supplied maximum (`Matn juda uzun`); default max is 160. Quantity input accepts digits, comma and period and validates the six-place positive decimal rule. `Saqlash` returns the trimmed value; `Bekor qilish` returns no value. Dialog back/cancel leaves data unchanged.

## Static literal lookup inventory

Generated from V2 baseline presentation sources. Each literal below is its `uiText`/`UrduAwareText` lookup input or a directly displayed literal; the source line is the authority for conditional usage. Dynamic interpolation and literals nested inside expressions remain subject to the open text-inventory item.

### preparation_screen.dart

- `Saqlandi` — line 153
- `Homashyo tanlang` — line 208
- `Mahsulot formulasi` — line 224
- `Homashyolar` — line 230
- `Ombor` — line 235
- `Tarozi kirimi` — line 241
- `Kirim` — line 250
- `Buyurtmalar` — line 255
- `Tarix` — line 260
- `Tayyorlov masteri` — line 287
- `Ichki homashyo ta’minoti` — line 288
- `Xatolik yuz berdi` — line 319
- `Tasdiqlanmagan operatsiya` — line 343
- `Sizga ombor biriktirilmagan. Admin foydalanuvchi kartasidan ombor biriktirishi kerak.` — line 390
- `Ishlab chiqarish` — line 472
- `Ishlab chiqarilgan homashyolar` — line 486

### preparation_screen_forms.dart

- `Qidirish` — line 17
- `Yangi homashyo` — line 40
- `Homashyo nomi` — line 40
- `Kirim (kg)` — line 54
- `Order tanlang` — line 66
- `Homashyo tanlang` — line 81
- `Sarfni saqlash` — line 110
- `Hisoblangan homashyolar ombordan sarflansinmi?` — line 111
- `Bekor qilish` — line 112
- `Saqlash va sarflash` — line 113
- `Bola ombor ochish` — line 297
- `Saqlash` — line 339
- `Homashyo qo‘shish` — line 441
- `Ombor qo‘shish` — line 450
- `Ombor` — line 461
- `Tanlanmagan` — line 462
- `Sizga ombor biriktirilmagan.` — line 504
- `Yuqoridagi filtrdan ombor tanlang.` — line 514
- `Bu omborda hali kirim yo‘q.` — line 524
- `Mavjud qoldiq` — line 600
- `Kirimlar` — line 802
- `Chiqimlar` — line 864
- `Bu homashyo bo‘yicha hali kirim yoki chiqim yo‘q.` — line 906
- `Buyurtmalar` — line 992
- `Sarf (kg) = Order KG × foiz ÷ 100. Har bir homashyo foizi alohida hisoblanadi.` — line 1035
- `Olib tashlash` — line 1072
- `Foiz (%)` — line 1103
- `Sarf: —` — line 1124
- `Homashyo tanlash` — line 1142
- `Saqlash bosilganda ko‘rsatilgan miqdor ombordan sarflanadi. Bu orderning saqlangan retsepti qayta sarflanmaydi.` — line 1148
- `Kirimni bekor qilish` — line 1215
- `Yopish` — line 1225
- `Sabab` — line 1242
- `Sabab kiriting` — line 1243
- `Qaytish` — line 1253
- `Kirim bekor qilindi` — line 1285
- `Tarix` — line 1304
- `Oxirgi 100 ta kirim va sarf` — line 1305
- `Hali kirim yoki sarf yo‘q.` — line 1321

### preparation_materials_screen.dart

- `Homashyolar bilan amal bajarilmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring` — line 35
- `Nomini o‘zgartirish` — line 68
- `Omborga biriktirish` — line 73
- `O‘chirish` — line 78
- `Homashyo nomini o‘zgartirish` — line 96
- `Homashyo nomi` — line 97
- `Homashyoni o‘chirish` — line 103
- `Bekor qilish` — line 106
- `Sizga exclusive ombor biriktirilmagan.` — line 185
- `Bu biriktirishni faqat administrator o‘zgartira oladi` — line 199
- `Bu amal ombordagi qoldiqni ko‘chirmaydi.` — line 218
- `Saqlash` — line 226
- `Ombor biriktirish yangilandi` — line 244
- `Homashyolar` — line 264
- `Homashyoni qidirish` — line 274
- `Qayta urinish` — line 304
- `Homashyo amallari` — line 348

### preparation_formula_catalog_screen.dart

- `Formulalar` — line 114
- `Formula nomi, kodi yoki buyurtmani qidirish` — line 125
- `Qayta urinish` — line 150
- `Nomini o‘zgartirish` — line 198

### preparation_formula_orders_screen.dart

- `Nomini o‘zgartirish` — line 86
- `Komplekt nomini o‘zgartirish` — line 97
- `Komplekt nomi` — line 98
- `Komplekt nomi o‘zgartirildi` — line 115
- `Formulalar` — line 136
- `Kod, nom yoki buyurtmani qidirish` — line 146
- `Qayta urinish` — line 175
- `Formulani o‘chirish` — line 325
- `Bekor qilish` — line 328
- `O‘chirish` — line 329
- `Formula o‘chirildi` — line 345
- `Bu komplektda formula qolmadi.` — line 384

### preparation_order_formula_screen.dart

- `Formula ma’lumotlari` — line 57
- `Shnek ulushlarini belgilash` — line 78
- `Seriyo tanlang` — line 443
- `Qidirish` — line 444
- `Formula saqlandi` — line 577
- `Formulani o‘chirish` — line 593
- `Bekor qilish` — line 595
- `O‘chirish` — line 596
- `Formula o‘chirildi` — line 616
- `Ishlab chiqarishni boshlash` — line 679
- `Seriyo qo‘shish` — line 855
- `Shnek ulushlari` — line 893
- `Nom avtomatik beriladi` — line 1003
- `Tahrirlash` — line 1120
- `100% shart` — line 1217
- `Olib tashlash` — line 1317

### preparation_formula_variants_screen.dart

- `Shnek formulasini tanlang` — line 149
- `Formula nomi, kodi yoki buyurtmani qidirish` — line 150
- `Tahrirlash` — line 217
- `O‘chirish` — line 218
- `Nomini o‘zgartirish` — line 221
- `Shnek formulasini olib tashlash` — line 260
- `Bekor qilish` — line 262
- `Shnek formulalar` — line 292
- `Variant qo‘shish` — line 298
- `Qidirib variant qo‘shish` — line 303
- `Qayta urinish` — line 330
- `Hali shnek varianti yo‘q. FAB orqali variant qo‘shing.` — line 335
- `Akkaunt o‘zgargan. Sahifani qayta oching` — line 431
- `Variant nomi` — line 460

### preparation_formula_shares_sheet.dart

- `Akkaunt o‘zgargan. Sahifani qayta oching` — line 92
- `Shnek ulushlari saqlanmadi. Qayta urinib ko‘ring` — line 116
- `Shnek ulushlari` — line 140

### preparation_production_screen.dart

- `Ma’lumotlarni yuklab bo‘lmadi. Qayta urinib ko‘ring` — line 178
- `Qayta urinish` — line 220
- `Yana yuklash` — line 233
- `Ishlab chiqarish` — line 286
- `Buyurtma, homashyo yoki formula` — line 298
- `Holat` — line 324
- `Barchasi` — line 325
- `Davom etmoqda` — line 336
- `Yakunlangan` — line 340
- `Hali ishlab chiqarish yozuvlari yo‘q.` — line 356
- `Bu buyurtma bo‘yicha ishlab chiqarish yozuvi yo‘q.` — line 426
- `Hali rulon kirim qilinmagan.` — line 500
- `Formula qayd etilmagan` — line 598
- `Serverdagi QR identifikatori mos kelmadi` — line 709

### preparation_navigation.dart

- `Tayyorlov` — line 35
- `Amallar` — line 45
- `Profil` — line 57
- `Formulalar` — line 100
- `Ishlab chiqarish` — line 106
- `Ketma-ketlik` — line 114
- `Kirim` — line 122
- `Chat` — line 129
- `Ishlab chiqarilgan homashyolar` — line 136

### preparation_warehouse_management.dart

- `Ombor bilan amal bajarilmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring` — line 4
- `Nomini o‘zgartirish` — line 20
- `O‘chirish` — line 25
- `Ombor nomini o‘zgartirish` — line 39
- `Ombor nomi` — line 40
- `Omborni o‘chirish` — line 48
- `Bekor qilish` — line 51

## Interpolated literal lookup inventory

Generated from direct V2 text arguments. The expressions shown are the V2 source templates; values are substituted at runtime. Text nested inside conditional expressions remains an open inventory item.

### preparation_screen_forms.dart

- `${material.name} — kirim` — line 54
- `Ombor ochildi: $warehouse` — line 361
- `-${preparationDisplay(line['kg'] as String? ?? '0')} kg` — line 887
- `${doc['order_code']} ${doc['order_title']} • ${preparationDisplay(line['percent'] as String? ?? '0')}% • ${_formatDateTime(doc['created_at'])}` — line 889
- `Mavjud: ${preparationDisplay(materials[entry.key]!.available(widget.warehouse))} kg` — line 1083
- `Sarf: ${preparationDisplay(preparationRequiredKg(_order!.kg, entry.value.text))} kg` — line 1116
- `Kirim — ${doc['name'] ?? ''}` — line 1210
- `${doc['warehouse'] ?? ''} • ${preparationDisplay(doc['kg']?.toString() ?? '0')} kg` — line 1211
- `${preparationDisplay(doc['kg']?.toString() ?? '0')} kg kirim bekor qilinsinmi? Bu amal tarixda saqlanadi.` — line 1251

### preparation_materials_screen.dart

- `«${material.name}» o‘chirilsinmi? Faqat ishlatilmagan homashyo o‘chiriladi. Qoldiq, kirim yoki formula bo‘lsa, o‘chirish rad etiladi.` — line 104

### preparation_formula_catalog_screen.dart

- `Barcha buyurtmalarning formulalari: ${entries.length} ta` — line 144

### preparation_formula_orders_screen.dart

- `«${entry.formula.name}» formulasi o‘chirilsinmi? $_sharedFormulaWarning` — line 326

### preparation_order_formula_screen.dart

- `«${formula.name}» formulasi o‘chirilsinmi?` — line 594
- `${widget.variantName.isEmpty ? 'Saqlangan formulalar' : 'Ichki formulalar'} (${_formulas.length})` — line 917
- `Formula: $name` — line 995
- `${formula.lines.length} ta seriyo` — line 1102
- `${i + 1}` — line 1142
- `${preparationDisplay(formula.lines[i].percent)}%` — line 1154
- `≈ $kg kg` — line 1162
- `${index + 1}-seriyo` — line 1308

### preparation_formula_variants_screen.dart

- `${variant.name} shnek formulasi ${widget.orderCode} buyurtmasidan olib tashlanadi.` — line 261
- `${variant.name} buyurtmadan olib tashlandi` — line 277
- `${widget.materialName} • ${widget.orderCode}` — line 293
- `${widget.orderCode} • ${widget.productTitle}` — line 320

### preparation_formula_shares_sheet.dart

- `${widget.materialName.isEmpty ? 'Homashyo' : widget.materialName}: shnek ulushlari jami 100% bo‘lsin. Har bir shnek ichidagi seriyolar alohida 100% hisoblanadi.` — line 143
- `${widget.formulas[i].name} shnek ulushi` — line 157

### preparation_production_screen.dart

- `${order.displayCode} • ${order.title}` — line 366
- `${batch.formulaName}\n${batch.active ? 'Davom etmoqda' : 'Yakunlangan'} • ${batch.warehouse} • ${_date(batch.lastActivityAt)}` — line 449
- `${batch.warehouse}\nBoshlangan: ${_date(batch.startedAt)}${batch.endedAt.isEmpty ? '' : '\nTugagan: ${_date(batch.endedAt)}'}` — line 511
- `${_date(roll.printedAt)} • ${roll.warehouse}` — line 532
- `Shnek formulasi: ${recipe['variant_name'] ?? '—'}` — line 603
- `Formula kodi: ${recipe['variant_code']}` — line 610
- `Saqlangan tarkib • ${_date(recipe['captured_at']?.toString() ?? '')}` — line 611
- `Shnek ${screw['name']} • ${preparationDisplay(screw['share_percent']?.toString() ?? '—')}%` — line 616
- `${line['name'] ?? line['item_code']} — ${preparationDisplay(line['percent']?.toString() ?? '—')}%` — line 623

### preparation_warehouse_management.dart

- `«$warehouse» ombori o‘chirilsinmi? Ichida homashyo yoki bog‘langan yozuvlar bo‘lsa, o‘chirilmaydi.` — line 49
