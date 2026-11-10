# Aparatchi — buyurtma oynasi auditi

Status: tarixiy audit. Quyidagi farqlar audit vaqtida ochiq edi. Keyingi F01–F11 implementatsiyasi va joriy tekshiruvlar: [aparatchi-order-sheet.md](aparatchi-order-sheet.md).

Scope: bosma aparatchining buyurtma sheeti, homashyo bloklari, progress, hisobot va shu oynadan ochiladigan oqimlar. Bu butun aparatchi rolining barcha 90 API metodi va 29 ekran/sheeti uchun yakuniy audit emas.

Method: `$port` va `$accord-port` audit qoidalari bo‘yicha V2 va V4 manbalari, chaqiruvchilar, shartlar va kontrakt testlari solishtirildi. V2 va backend faqat o‘qildi. Oldingi foydalanuvchi topshiriqlaridan qolgan o‘zgarishlar saqlandi.

Source: `docs/port/V2_BASELINE` = `f11910bb2c8c7081ce26770e69811b03fd0739ed`. V2 checkout HEAD = `44396752396b69bc5ba9198a9352b71848b3b86a`, clean. Ikkisi orasida `lib/` va `test/` diffi yo‘q; farq faqat iOS loyiha fayllarida. Ledger uchun baseline’ning `git archive` eksporti `/tmp/accord-aparatchi-audit-v2.qD79Ze` ishlatildi. Checkout yoki baseline almashtirilmadi.

Qisqa V2 `admin_production_map_orders_*.dart` nomlari `../accord_mobile_v2/lib/src/features/admin/presentation/` katalogiga nisbatan berilgan. Boshqa `features/` va `core/` yo‘llari V2 `lib/src/`ga nisbatan.

## Findings — open items

### F01 · P1 · Ishlayotgan orderda biriktirilgan homashyolar yashiriladi — iOS va Android

V4 `preparationVisible`ni faqat `start` yoki `resume` amali borligida yoqadi (`src/OrderScreen.tsx:242`). Keyin `showMaterials = preparationVisible || interaction.assigned_materials_display_only === true` (`:619`). Backend faol `in_progress` orderga `material_intake_allowed=true`, `assigned_materials_display_only=false` beradi (`../mini_rs_erp/src/core/production_map/queue/service.rs:1195`). Natijada `pause`/`complete` bor ishlayotgan orderda butun homashyo bo‘limi yashiriladi, garchi assignmentlar alohida yuklansa ham (`src/OrderScreen.tsx:270`).

V2 `admin_production_map_orders_start_card.dart:603` shu holatda ham biriktirilgan homashyo blokini chiqaradi. Backend bayrog‘i bu yerda bo‘limni yashirish sharti sifatida talqin qilinmagan.

Tekshiruv: V4 manbasidan olingan ikkala ifoda o‘zgartirmasdan bajarildi: `allowed=['pause','complete']`, `synchronized=true`, `assigned_materials_display_only=false` → `preparationVisible=false`, `showMaterials=false`. Bu manba darajasidagi reproduksiya, telefondagi HTTP yozuvi emas.

Yetishmayotgan test: faol bosma orderda shu control bilan biriktirilgan homashyo soni va qatori ko‘rinishini tekshiradigan ekran testi.

### F02 · P1 · Qabul qilinmagan homashyolar bloki port qilinmagan — iOS va Android

V2 `admin_production_map_orders_start_card.dart:555` intake nomzodlari uchun alohida expandable blok, son, loading/error va bo‘sh holatni chiqaradi. Rasmdagi «Hali qabul qilinmagan homashyo yo‘q» ham shu blok.

V4 nomzodlarni o‘qiydi (`src/OrderScreen.tsx:281`), lekin alohida ro‘yxat va bo‘sh holat yo‘q. Faqat `intakeCandidates.length > 0` bo‘lsa «Homashyo ulash» tugmasi chiqariladi (`:764`); nomzodlar ro‘yxati foydalanuvchiga ko‘rsatilmaydi. O‘qish xatosi ham `[]`ga aylantiriladi (`:287`).

Yetishmayotgan test: intake nomzodlari bor/yo‘q/yuklanayotgan/xatoli holatlarni bir-biridan farqlash.

### F03 · P1 · iOS bosma progressi bo‘sh komponent — iOS

`src/components/WorkerOutputProgress.tsx:11` shartsiz `return null` qiladi. `.ios.tsx` varianti yo‘q. TypeScript resolution tekshiruvi iOS aynan shu faylni, Android esa `WorkerOutputProgress.android.tsx`ni tanlashini tasdiqladi.

V2 `admin_production_map_orders_worker_output_progress.dart:10` print/laminate uchun bajarilgan metraj, reja, foiz va qolgan metrajni ko‘rsatadi (`:161`). V4 `OrderScreen.tsx:772` komponentni chaqiradi, ammo iOS’da natija chiqmaydi. Android’da progress implementatsiyasi mavjud; bu finding uni butunlay yo‘q deb hisoblamaydi.

Yetishmayotgan test: iOS ishlayotgan order uchun WIP natijasi, foiz va qolgan metrajni render qilish; yuklash/xato/noma’lum metraj holatlari.

### F04 · P1 · Tugatishdagi muammo izohi orqali muzlatish yo‘li yo‘q — iOS va Android

V2 `admin_production_map_orders_progress_qty.dart:807` oddiy `complete` oqimida, bosma closing-output hisobotidan tashqari, kiritilgan izohni `isIssue=true` sifatida qaytaradi. `admin_production_map_orders_read_only_sheet.dart:3258` undan `freeze`, `freezeWithIssue=true`, `issueNote` buyrug‘ini yaratadi.

V4 tugatish formasida umumiy izoh maydoni yo‘q (`src/OrderScreen.tsx:796`). `freezeNote` faqat allaqachon mavjud safe-stop so‘rovi uchun pauzada, `astatkaNote` esa astatka uchun chiqariladi. Oddiy tugatishda metr/vazn/bobina musbat bo‘lmasa handler darhol qaytadi (`:529`); V2’dagi muammoni izohlab muzlatish yo‘li ochilmaydi. Pastki API `freeze_with_issue`ni qo‘llaydi (`src/workerQueueAction.ts:28`), lekin shu formadan ulanmagan.

Yetishmayotgan test: training bo‘lmagan oddiy complete oqimi → izoh → `freeze_with_issue` va issue note. Closing-output, safe-stop va astatka yo‘llari alohida tekshirilishi kerak.

### F05 · P1 · Ishchining ruxsat etilgan homashyoni ishlatish oqimi yo‘q — shartli, ikkala platforma

V2 `admin_production_map_orders_detail_widgets.dart:480` apparatning `workerMaterialAssignmentAllowed` ruxsati bo‘lsa `WorkerMaterialUsePanel`ni ochadi. Panel serverdagi ruxsat etilgan nomzodlarni oladi, QRni tekshiradi, tasdiq oladi va `useWorkerMaterial`ni yuboradi (`features/material_link/presentation/worker_material_use_panel.dart:132,174`). Endpoint: `core/api/admin/mobile_api_worker_material_use.dart:27` — GET/POST `/v1/mobile/worker-material-use`, mutatsiyada `placement_version` saqlanadi.

V4 `src/`da bu endpoint, API va panel topilmadi. Katalog parseri ruxsat bayrog‘ini biladi (`src/apparatusApi.ts:72`), lekin worker mashinalari modeli faqat `id/name/operation`ni saqlaydi (`src/workerApi.ts:174`). Bu oddiy intake/receipt bilan bir xil oqim emas.

Yetishmayotgan test: apparat ruxsati, nomzodlarning yangiligi, tasdiq va placement version kontrakti. Ruxsat o‘chiq apparatga bu imkoniyat qo‘shilmasligi kerak.

### F06 · P1 · Homashyo ulash so‘rovlari paneli yo‘q — shartli, ikkala platforma

V2 `admin_production_map_orders_detail_widgets.dart:500` to‘g‘ridan-to‘g‘ri ishlatishga ruxsat bo‘lmagan apparat, start-material holati va training bo‘lmagan order uchun `MaterialLinkRequestPanel`ni chiqaradi. Chaqiruvchi ham ulangan (`admin_production_map_orders_read_only_sheet.dart:690`). Panel so‘rov yuborish, holatni kuzatish, bekor qilish va tasdiqdan keyin assignmentlarni yangilashni bajaradi (`features/material_link/presentation/material_link_request_panel.dart:153,234,266`). API `/v1/mobile/material-link-requests` (`core/api/admin/mobile_api_material_link.dart:4`).

V4’da endpoint va panel topilmadi. Chat modelida `material_link_request` turining nomi mavjudligi bu oqimni port qilingan qilmaydi.

Yetishmayotgan test: eligibility, so‘rov yaratish/bekor qilish, yangi status kelganda order materiallarini yangilash va sessiya almashishi.

### F07 · P2 · Homashyo tafsilotlari qisqartirilgan — iOS va Android

V4 expanded qatorda faqat nom va barcode chiqariladi (`src/OrderScreen.tsx:744`). `received_qty`, `consumed_qty`, `remaining_qty`, guruh va execution status modelda bor (`src/workerRawMaterials.ts:24,35`).

V2 `_RawMaterialAssignmentsExpansionBody` miqdorlar mavjud bo‘lsa balansni chiqaradi (`admin_production_map_orders_detail_widgets.dart:1757`); `_AssignedMaterialTile` esa guruh va `ready/in_use/consumed/awaiting_delivery/needs_cutting/width_mismatch` holatlarini izohlaydi (`admin_production_map_orders_detail_material_widgets.dart:949`). V4’da balans va individual status tafsilotlari UI’ga ulanmagan.

Yetishmayotgan test: bir xil assignment fixture’i uchun balanslar, birliklar va execution statuslarning foydalanuvchiga ko‘rinishi. `workerRawMaterials.test.cjs` parserni tekshiradi, shu UI’ni emas.

### F08 · P2 · Homashyoga uzun bosishdagi QR/tafsilot oynasi yo‘q — iOS va Android

V2 `_AssignedMaterialTile` uzun bosishda haptic va `_showAssignedMaterialReprintSheet`ni chaqiradi (`admin_production_map_orders_detail_material_widgets.dart:980`). QR sheet item code, guruh, miqdor, ombor, apparat va stock statusni ko‘rsatadi (`:1120`) hamda qayta chop etish oqimini ochadi.

V4’dagi homashyo qatori oddiy `View`, press/long-press handleri yo‘q (`src/OrderScreen.tsx:744`). Boshqa WIP QR oqimlari bu material barcode oynasining o‘rnini bosmaydi. GoDEX bu findingga kiritilmadi — D13 bilan chiqarilgan.

Yetishmayotgan test: homashyo qatori → long press → to‘g‘ri barcode va tafsilotlar bilan QR sheet. Haqiqiy printer alohida qurilma tekshiruvi bo‘lib qoladi.

### F09 · P2 · Homashyo/qolip haqida xabar berish UI’i ulanmagan — iOS va Android

V2 start/preflight va boshqa aniq guardlar ostida homashyo yoki qolip yetishmasa `OrderAlertButton` chiqaradi (`admin_production_map_orders_start_card.dart:310,665,814`). U buyurtma darajasida bir marta xabar yuborib, yuborilmoqda/yuborildi/xato holatlarini saqlaydi (`features/aparatchi/presentation/widgets/order_alert_button.dart:26,52`).

V4 `sendOrderAlert` API’sini port qilgan (`src/workerControlsApi.ts:268`) va uning testlari bor. Ammo `src/`da uni chaqiradigan UI topilmadi.

Yetishmayotgan test: V2 guardlariga mos raw-material/qolip bo‘sh holati, yuborish, takror bosishni bloklash va xato/retry.

### F10 · P2 · Buyurtma oynasining tarjimasi qisman — iOS va Android

V2 action/form matnlari `context.l10n.productionText(...)`dan keladi (masalan, `admin_production_map_orders_start_card.dart:1123`). V4 summary hookida locale bor (`src/components/useWorkerOrderOverview.ts:23`), ammo `OrderScreen.tsx:740,775,789` bo‘limlari, tugmalar va formadagi matnlar literal Uzbek.

Masalan, catalogda `worker.action.complete` uchun `Complete job` va `Завершить` mavjud, lekin `OrderScreen` `label="Tugatish"` yuboradi; `WorkerOrderControls.ios.tsx:16` uni tarjimasiz chiqaradi. Android fallback ham kelgan label’ni bevosita chiqaradi (`src/components/WorkerSheetButton.tsx:22`). Stage statuslarining bir qismi ham Uzbek literal (`useWorkerOrderOverview.ts:12`).

Yetishmayotgan test: uz/en/ru/ur til almashishida nafaqat summary sarlavhasi, balki homashyo, action, dialog va status matnlari ham yangilanishi.

### F11 · P2 · Hisobot formasining turi/yopilish qoidasi V2’dan farq qiladi — iOS

V2 `_showProgressQtyDialog` `showDialog` va `barrierDismissible=false` ishlatadi (`admin_production_map_orders_progress_qty.dart:146`). V4 `WorkerFormDialog.ios.tsx:13` katta native bottom sheet chiqaradi; odatiy forma bo‘sh turganda swipe bilan yopilish ruxsat etiladi. Faqat busy yoki inline paint holatlarida bloklanadi (`OrderScreen.tsx:790`). Android varianti dialog bo‘lib qolgan.

`$port`da dialog/sheet turi va yopilish qoidasi ham parity talabi. Shu oqimning kind/gesture farqi qabul qilinganini tasdiqlovchi qaror ushbu auditda aniqlanmadi. Tugmalarning foydalanuvchi so‘ragan native glass ko‘rinishi va joylashuvi bundan alohida.

Yetishmayotgan test: normal hisobot, busy va paint holatlarida tashqariga bosish/swipe/back/aniq cancel natijalarini V2 bilan solishtirish.

## Surface audit

V2 fayllari yuqoridagi prefikslar bilan berilgan. Faqat ko‘rilgan scope keltirilgan.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `admin_production_map_orders_start_card.dart:555,603` — pending/attached materials | `src/OrderScreen.tsx` | open | open | F01/F02: visibility va alohida intake bloki |
| `admin_production_map_orders_detail_widgets.dart:1757`, `detail_material_widgets.dart:949,980` — balance, rows, QR | `src/OrderScreen.tsx`, `src/workerRawMaterials.ts` | open | open | F07/F08: data bor, tafsilot va long press ulanmagan |
| `admin_production_map_orders_worker_output_progress.dart:10` — output | `WorkerOutputProgress.tsx`, `.android.tsx` | open | partial | F03: iOS null; Android bor, to‘liq behavioral audit qilinmagan |
| `admin_production_map_orders_detail_widgets.dart:480,500` — worker use/link requests | `src/workerApi.ts`, `src/OrderScreen.tsx` | open | open | F05/F06: shartli ikki oqim yo‘q |
| `admin_production_map_orders_start_card.dart:665,814` — order alerts | `src/workerControlsApi.ts`, `src/OrderScreen.tsx` | open | open | F09: API bor, UI chaqiruvchisi yo‘q |
| `admin_production_map_orders_progress_qty.dart:146,807` — complete/report | `src/OrderScreen.tsx`, `WorkerFormDialog.ios.tsx` | open | open | F04; qo‘shimcha iOS surface farqi F11 |
| `admin_production_map_orders_start_card.dart:1123` — locale text | `src/OrderScreen.tsx`, controls, overview hook | open | open | F10: ko‘p matnlar literal Uzbek |
| `admin_production_map_orders_detail_widgets.dart:633,668` — summary/map collapse | `useWorkerOrderOverview.ts`, platform overview views | compared | compared | Workerda summary bilan bosqichlarni birga yig‘ish V2’da ham bor; alohida kamchilik deb olinmadi |

## Verification

- `node --test tests/worker*.test.cjs`: **257 pass / 0 fail**. Contract replays shu to‘plam ichida ishladi. Log: `/tmp/accord-aparatchi-audit-tests.log`.
- `npx tsc --noEmit -p tsconfig.ios.json`: exit 0.
- `npx tsc --noEmit -p tsconfig.android.json`: exit 2, **9 avvalgi xato** — `WorkerOutputProgress.android.tsx` va `WorkerPaintPalette.android.tsx`. Ikkala faylning HEAD bilan diffi yo‘q; audit ularni o‘zgartirmadi.
- `npx expo lint`: 0 errors, 1 avvalgi warning — `src/admin/AdminClosedHistoryOwner.tsx:36`, `useMemo` dependency `ticket`.
- `port_ledger.mjs drift`: `lib/test` farqi 0; bu historical drift tugaganini anglatmaydi.
- Audit oxirida V2 HEAD va clean status o‘zgarmagani, baseline bilan `lib/test` diffi hanuz yo‘qligi qayta tekshirildi.
- `port_ledger.mjs role aparatchi --v2 <baseline-export>`: 3 qism, 90 API method, 67 endpoint, 29 ekran/sheet, 42 contract / 35 logic / 100 widget test fayli.
- `port_ledger.mjs text aparatchi both --v2 <baseline-export>`: **exit 1**. iOS: 280 missing / 99 added / 445 global-only match; Android: 280 / 108 / 448. 0 ambiguous tag, 158 surface/guard qaydi. Bular avtomatik diagnostika sonlari, tasdiqlangan funksional buglar soni emas; shared/admin-only matnlar ham qo‘lda ajratilishi kerak. Text exception qo‘shilmadi.
- `worker_list_api_test.json` va `order_scan_bootstrap_api_test.json` kabi foydalanilgan replay fixture’lari `7c87a54e...` baseline’iga tegishli; replay helperi baseline metadata’sini tekshirmaydi (`tests/support/contractFetch.cjs:9`). Shu sabab 257 pass `f11910bb`dagi to‘liq UI/behavior parity isboti emas. V2 oracle/fixture regeneratsiyasi bu read-only auditda bajarilmadi.

## Scope limits and exclusions

- Runtime API yozuvi olinmadi, real API mutatsiyasi qilinmadi; qurilma, simulator va emulator ishlatilmadi.
- To‘liq worker queue, WIP/printing, returned-paint, lamination/rezka va barcha 29 surface branch-by-branch ko‘rib tugatilmadi. Ledger’da `[x]` bo‘lishi yakuniy parity deb olinmadi.
- Material unlink V2’da shu sheet ichida material ta’minotchiga tegishli (`admin_production_map_orders_read_only_sheet.dart:149`); aparatchi uchun yetishmayotgan tugma deb olinmadi.
- Attached qoliplar katalogi blokining bir qismi `!workerMode` bilan cheklangan (`admin_production_map_orders_start_card.dart:678`); uni ishlayotgan aparatchida ko‘rinmayotgani uchun bug deb olinmadi.
- GoDEX, deferred test mode va boshqa rollarning admin-only imkoniyatlari bu findinglar soniga kiritilmadi.
- Manba kodi, testlar, branch, konfiguratsiya va server holati o‘zgartirilmadi. Faqat ushbu audit hisoboti hamda ignored `.port/` diagnostika hisobotlari yaratildi.
