# Port davomida aniqlangan kamchiliklar

Bu fayl port va merge vaqtida topilgan, keyin tuzatiladigan kamchiliklarning umumiy ro‘yxati. Yangi qaydlar shu faylga qo‘shiladi. Rol bo‘yicha mavjud `status/` fayllari batafsil dalil sifatida saqlanadi.

Har bir qaydda ta’sir qilgan soha, kuzatilgan holat va dalil bo‘lishi kerak. Port tafovuti, V2’dan meros bo‘lgan xulq va hali bajarilmagan tekshiruv alohida ko‘rsatiladi. Tasdiqlanmagan holat tasdiqlangan bug deb yozilmaydi. Tuzatilgan qayd o‘chirilmaydi: holati va tuzatish commiti qo‘shiladi.

Boshlang‘ich qayd: 2026-11-09. V2 manba commiti: `f11910bb2c8c7081ce26770e69811b03fd0739ed`. Quyidagi umumiy tekshiruv natijalari `chat-secure` merge commiti `3f8f158` holatiga tegishli.

## Tasdiqlangan tekshiruv natijalari

| ID | Turi / soha | Kamchilik yoki qolgan ish | Dalil | Holat |
|---|---|---|---|---|
| PORT-001 | Test muhiti / Preparation Android | Umumiy Node to‘plamidagi 6 test Expo UI `createModifier` ESM importini host mock ichida resolve qila olmaydi. Xuddi shu xatolar o‘zgartirilmagan `main`da ham takrorlandi; bu kuzatuv telefon ekranining buzilganini isbotlamaydi. | `tests/preparationHomeDependentPages.test.cjs`, `tests/preparationWarehouse.android.test.cjs`; [Chat transport tekshiruvi](status/chat-secure.md#verification) | Keyin tuzatish |
| PORT-002 | Typecheck / Worker Android | 9 ta mavjud TypeScript diagnostikasi: `WorkerOutputProgress` prop tipi va callback tiplari, `WorkerPaintPalette` prop/usage tiplarining platforma importi. Android typecheck to‘liq o‘tmayapti. | `src/components/WorkerOutputProgress.android.tsx`, `src/components/WorkerPaintPalette.android.tsx` | Keyin tuzatish |
| PORT-003 | Lint / Admin | `useMemo` ichida `ticket` dependency bo‘yicha bitta ogohlantirish bor. Uning amaldagi UI ta’siri alohida tekshirilmagan. | `src/admin/AdminClosedHistoryOwner.tsx:36` | Keyin tekshirish |
| PORT-004 | Build muhiti / Android | Standart SDK 37 bilan to‘liq app build tasdiqlanmagan. Mac’dagi NDK 27.1 o‘rnatilishi chala; joriy sdkmanager katalogida `platforms;android-37` topilmadi. Chat moduli mavjud SDK 36 / Build Tools 36 / NDK 28.2 bilan, loyiha sozlamalarini o‘zgartirmagan holda kompilyatsiya qilindi. | [Aniq build natijalari va cheklovlar](status/chat-secure.md#verification) | Muhitni keyin tugatish |
| PORT-005 | Qurilma tekshiruvi / Chat transport | Yangi `AccordChatSecure` modulini o‘z ichiga olgan development build va real iOS/Android telefon sinovi kerak. Tarmoq uzilishi, fon/resume, token muddati tugashi, akkaunt almashuvi va sokin ulanishdagi ping/pong telefonda sinalmagan. Native modul buildlari va host testlari bu sinov o‘rnini bosmaydi. | [Telefon tekshiruvlari](status/chat-secure.md#verification-limits-and-user-phone-checks) | Foydalanuvchi sinovi kutilmoqda |
| PORT-006 | Kutilayotgan test holatlari / umumiy | Umumiy to‘plamda 12 ta avvaldan mavjud TODO bor. Guard xulqi, bildirishnoma statuslari va mikrosekund bo‘yicha tartiblashga oid kutilmalarni tegishli rol porti vaqtida V2 bilan solishtirish kerak. | `node --test --test-concurrency=6 tests/*.test.cjs`: 4327 test, 4309 pass, 6 fail, 12 TODO | Keyin ko‘rib chiqish |

## Port va auditda qolgan ishlar

Bu qatorlar mavjud holat fayllaridagi ochiq ishlarni bir joydan kuzatish uchun kiritilgan. Tegishli branch bilan ishlaganda oxirgi kodga nisbatan qayta tekshiriladi.

| ID | Soha / branch | Qolgan ish | Dalil | Holat |
|---|---|---|---|---|
| PORT-007 | Chat UI va matnlar | To‘liq Chat roli tayyor deb belgilanmagan. Text gate: iOS 151 yetishmagan / 82 ortiqcha, Android 152 / 93; 9 ta surface qayd etilgan. Ikki ichki, ekranga chiqarilmaydigan transport xatosi uchun dalilli istisno bor. Ko‘rinadigan matnlar va surface’larni V2 bilan to‘liq solishtirish kerak. | [Chat holati](status/chat.md), `docs/port/text/chat.tsv` | Alohida Chat auditi |
| PORT-008 | Chat model, sinxronlash va media | V2 modelining qolgan maydonlari, noto‘g‘ri recovery payloadlari, jonli oxirgi-xabar preview/tartibi, pending text/media retry va receipt holatlari bo‘yicha to‘liq parity tekshiruvi qolgan. | [Chat Open items](status/chat.md#open-items) | Keyin tugatish |
| PORT-009 | Yangi rollarning Chat ulanishi | Umumiy transport merge qilindi, lekin bu har bir rolning yashirilgan Chat route, drawer/dock va unread ko‘rsatkichini avtomatik ulab bermaydi. Har bir rolning navigatsiyasi V2 bilan alohida tugatiladi. | `status/boyoqchi.md`, `status/customer.md`, `status/supplier.md`, `status/homashyo.md`; [umumiy Chat](status/chat.md) | Boyoqchi va Homashyo ulandi; qolgan rollar navbatida |
| PORT-010 | Boyoqchi / `port/boyoqchi` | Palitraning animatsiyali page tracking’i, draft fayl saqlanishi, completion reconciliation’ning V2’dan farqlari, training-image error mapping, sheet dismissal va ayrim Profile/Settings yo‘llari bo‘yicha qaydlar bor. Chat/login hold olib tashlandi: ikki platformada Chat route, drawer/dock va haqiqiy unread ulandi; Profile Settings/PIN va boshqa sanalgan tafovutlar hali ochiq. | [Boyoqchi Open items](status/boyoqchi.md#open-items) | Branch tekshiruvida aniqlashtirish |
| PORT-011 | Homashyo / `port/homashyo` | Branchdagi keyingi main tuzatishlari saqlandi. Save/issue/print amallari pending buyruqning ishonchli yakunlanishi, acknowledgment va bir scope’dagi eski/yangi owner operatsiyalarini muvofiqlashtirish tugamaguncha hozir ham bloklangan. Printer/scanner, saqlangan buyruq, navigatsiya va ikki platformadagi surface xulqi V2 bilan tekshiriladi. | [Homashyo Open items](status/homashyo.md#open-items) | Branch tekshiruvida aniqlashtirish |
| PORT-012 | Qolipchi | Asosiy branchdagi modellar/API/controller va native content main’dagi tor read-only Home bilan muvofiqlashtirildi; 8 ta read-only modul alohida saqlangan. Keyingi checkpoint’da cell/raw/universal native QR sahifalari va V2 secure request ID manbasi port qilindi (PORT-019/020). Qolip hali route’larga ulanmagan: haqiqiy shell, drawer/dock/Profile/Chat, scanner caller’i va sheet opener’lari, barcha write/return/attach/take/move/print yo‘llari hamda 23 surface auditi ochiq. Text gate iOS 80/55, Android 80/64; 163 dialog/sheet/back havolasi bor. | `port/qolipchi`, `port/qolipchi-home-readonly-20261109a`, `port/integrate-production-roles-20261109a`; `status/qolipchi.md` | Qisman integratsiya; rol ochilmagan |
| PORT-013 | Admin read-only | Read authority candidate main bilan solishtirilib integratsiya qilindi: Work Map GET witness, original window/catalog lifetime, immutable request va detail ticket tekshiruvlari qo‘shildi. Fizik route papkalari mavjud, lekin ikki root layout ham `/` ga redirect qiladi; Admin home target yo‘q. Home/Activity read closure, 401 recovery, sheet ownership, write amallari va butun rol parity auditi ochiq. Joriy text gate: iOS 869/238, Android 867/248; 560 surface havolasi. | [Admin holati](status/admin.md), [production read guard](status/production-order-read-guard.md) | Read candidate qabul qilindi; rol hali yopiq |
| PORT-014 | Umumiy test mode | D3 bo‘yicha markazlashgan test mode portning oxirida qilinadi. Hozirgi alohida demo-token bloklari to‘liq V2 test mode bilan teng deb hisoblanmaydi. | `PORT.md` D3, `status/chat-secure.md#test-mode-pending` va rol holat fayllari | Reja bo‘yicha keyin |
| PORT-015 | Boyoqchi logout / PIN | V2 `SecurityController.clearForLogout` app PIN, switch PIN va biometric sozlamalarni o‘chiradi. Boyoqchi hozir guarded auth logout’ni chaqiradi, ammo yangi same-account login PIN’ini kechikkan cleanup o‘chirib yubormasligi uchun ushbu cleanup vaqtincha yo‘q. Account-operation va witness bilan muvofiqlashtirilgan cleanup kerak. | `src/boyoqchi/BoyoqchiLayout.ios.tsx`, `.android.tsx`; V2 `security_controller.dart:59-72`; `status/boyoqchi.md` | Keyin tuzatish |
| PORT-016 | Text ledger scope | `ledger-scope` faqat diagnostikani kuchaytiradi: qisqa `@v2` nomi bir nechta Dart declaration’ga mos kelishi yoki native matn faqat boshqa global V2 scope’da topilishi text gate’ni ochiq qoldiradi. Boyoqchi: 2 ambiguous tag, iOS 1 uncertain match, global-only iOS 482 / Android 489; Homashyo: 0 ambiguous tag, global-only 59/59. Bu sonlar tasdiqlangan UI bug soni emas; manba/reachability auditi kerak. | `docs/port/LEDGER_SCOPE.md`, `.port/text-boyoqchi.md`, `.port/text-homashyo.md`; 16/16 fixture test | Keyin provenance auditi |
| PORT-017 | Transfer / synthetic probe | Arxivdagi fake transport testi `adminTransferProductionMapOrder` javobi va lokal acknowledgment akkaunt almashtirilgandan keyin ham yakunlanishini ko‘rsatdi. Bu real backend’da boshqa akkauntga ta’sir bo‘lganini isbotlamaydi. Ko‘rilgan snapshot’da ushbu API uchun production UI caller topilmagan; transfer amallari hamon yopiq. Caller/response/ack scope’ini yozish yo‘li ochilishidan oldin muvofiqlashtirish kerak. | `handoff-probes/stale-transfer-response.cjs`, `src/productionMapTransferApi.ts`; fake probe qayta ishga tushirildi | Keyin caller va sent-write auditi |
| PORT-018 | `port/scoped-read-experiment` / alohida tajriba | V2 portiga teng bo‘lmagan, production caller’i yo‘q mustaqil transport. 27/27 fake test o‘tdi, lekin ulardan biri tekshiruvdan keyingi ichki dispatch oralig‘ida eski token trusted origin’ga yuborilishi mumkinligini ataylab ko‘rsatadi; bu native qurilmada takrorlangan hodisa emas. 401 va path/redirect siyosati ham V2’dan farq qiladi. Amaldagi reviewed transport yoniga ushbu alternativani ulash uchun asos yo‘q, shu sabab branch merge qilinmadi va o‘zgartirilmay saqlandi. | `port/scoped-read-experiment` `cb0e751`, `tests/scopedReadTransport.test.cjs` oxirgi test; o‘z worktree’sida qayta tekshirildi | Merge qilinmadi; alohida tadqiqot |
| PORT-019 | Qolip native scanner | Cell/raw/universal native skaner va V2 flow tayyorlandi, lekin to‘liq rol caller/route’i hali yo‘q. CameraView SDK 58 torch mavjudligini bermaydi: tugma kamera ready/running paytida torch’siz qurilmada ham ko‘rinishi mumkin. V2 ReliableScanner’ning umumiy lease/handoff va decode-error recovery xulqi to‘liq port qilinmagan; pause/unmount native camera to‘liq bo‘shaganini telefon sinovisiz isbotlamaydi. Background/focus bo‘yicha kech lookup natijasi V2’dan qat’iyroq bekor qilinadi. | `src/qolip/QolipQrScanner.*`, `useQolipQrCamera.ts`, `useQolipQrScanner.ts`; `status/qolipchi.md` scanner audit | Native/caller ishlari va telefon sinovi ochiq |
| PORT-020 | Qolip request ID / native development build | V2 request ID’dagi mikrosekund vaqt uchun `AccordNativeClock` local moduli va Expo Crypto’dan 128-bit secure random ulandi. C/Swift host tekshiruvi, Android modul AAR assembly va iOS modul build’i o‘tdi. Android modul SDK 36/NDK 28.2 command override bilan tekshirildi; bu butun SDK 37 app build’i dalili emas (PORT-004). Yangi modul uchun development binary qayta build qilinishi kerak. Clock/crypto availability va return oqimi haqiqiy telefonda tekshirilmaguncha release dalili deb olinmaydi. | `modules/accord-native-clock/`, `src/qolip/qolipReworkRequestId.ts` | Native modul build’lari o‘tdi; telefon va caller tekshiruvi ochiq |

| PORT-021 | Qolip storage retry intent | Retry ID retention port qilindi, ammo Expo secure ID async bo‘lgani uchun har bir caller `await keyFor`dan so‘ng original rol umrini qayta tekshirishi kerak. Native entropy/clock xatosidan keyin failed promise chiqariladi; V2 synchronous xato yo‘li oldingi `_id`ni qoldirishi mumkin. Arbitrary JSON double/numeric-key tafovutlari va real sent-write settlement tasdiqlanmagan. | `qolipStorageIntent.ts`; `qolip_storage_test.dart:349`; 8 focused test | Helper tayyor; action caller’lari ochiq |

## V2’dan meros bo‘lgan va alohida tuzatiladigan holatlar

Quyidagilar Chat manba auditi vaqtida qayd etilgan V2 xulqlari. Ular yangi V4 regressiyasi deb belgilanmagan; tuzatishdan oldin tegishli holat takrorlanadi va alohida o‘zgarish qilinadi.

| ID | V2 xulqi | Manba / dalil | Holat |
|---|---|---|---|
| V2-001 | Chat detail focus’ni yo‘qotsa ham mounted qolgan paytda active conversation saqlanishi mumkin; eski detail dispose’i yangisini tozalashi mumkin. | `chat_detail_screen.dart:81-109`, `chat_store_ChatStore_methods_01.dart:501-533`; [Deviations candidates](status/chat.md#deviations-candidates) | Keyin tekshirish va tuzatish |
| V2-002 | App fon rejimiga o‘tganda oldindan boshlangan sync yoki receipt flush bekor qilinmaydi; kech kelgan natija read receipt yuborishi mumkin. | `chat_runtime.dart:42-49`, `chat_store_sync.dart:77-131,406-443`; [Chat qaydi](status/chat.md#deviations-candidates) | Keyin tekshirish va tuzatish |
| V2-003 | Gap xabarlari avval xotiraga olinadi, keyin lokal bazaga yoziladi. Yozish xatosidan keyingi retry xotiradagi sequence sabab ayrim saqlanmagan xabarlarni qayta olmasligi mumkin. | `chat_store_sync.dart:160-213`; [Chat qaydi](status/chat.md#deviations-candidates) | Keyin tekshirish va tuzatish |

## Tuzatilgan qaydlar

PORT-009, Boyoqchi qismi: `503ecad` (main merge `ee19c78`) — ikki platformada real Chat route’lari, V2 drawer/dock tartibi va unread dot ulandi. Qolgan rollar va umumiy Chat auditi ushbu qatorni ochiq qoldiradi.

PORT-009, Homashyo qismi: `c6ddfd4` — V2’dagi Rezka/Profil/Chat dock tartibi, haqiqiy unread dot va ikkala platformaning shared Chat route’lari ulandi. Save/issue/print hold bundan mustaqil qoladi.

PORT-012 integratsiya: original `port/qolipchi` `f02051e` orqali (main merge `5e0b23c`) qabul qilindi. `port/qolipchi-home-readonly-20261109a` dagi eski transport/Home checkpoint’i ham keyingi main varianti bilan tekshirildi; yangi main xulqi saqlandi. To‘liq Qolip roli hali yopilmagan.

PORT-013 integratsiya: `b0278c4` (main merge `7bdec60`) — Admin Work Map read authority qabul qilindi. Root redirect hold va ochiq rol ishlari saqlandi.

## 2026-11-09 lokal merge paketi

Bu paket avvalgi `c07156e` holatidan davom etdi. Quyidagi 10 branch bittalab joriy main bilan solishtirildi va lokal merge qilindi. Branchlar o‘chirilmagan va remote’ga push qilinmagan. `backup/accord-native-before-github-update-2026-11-07` eski backup’i merge qilinmadi. Kalendar kunlari Asia/Tashkent bo‘yicha 8–9 noyabr bo‘lgan port branchlar ko‘rildi; Git’dagi asl timezone sabab ayrim head’lar 7-noyabr sanasi bilan ko‘rinadi.

| Branch | Main merge | Natija |
|---|---|---|
| `port/boyoqchi` | `ee19c78` | Keyingi main tuzatishlari saqlandi; ikki platformada Chat list/new/thread, V2 drawer/dock tartibi va real unread dot ulandi. Qolgan rol tafovutlari PORT-010/015’da. |
| `port/homashyo` | `4cac4ba` | Keyingi save/print/pending guard’lari saqlandi; V2 dock Chat’i ikki platformada ulandi. PORT-011 hold ochiq. |
| `port/qolipchi` | `5e0b23c` | Asl full-role modullar va main’dagi tor read-only Home alohida saqlandi; API/controller tip nomuvofiqliklari bartaraf etildi. Rol hali route’larga ulanmagan, PORT-012 ochiq. |
| `port/qolipchi-home-readonly-20261109a` | `8f968a4` | Eski checkpoint keyingi reviewed Home/transport xulqi bilan muvofiqlashtirildi; original variantlar qayta buzilmadi. |
| `port/integrate-admin-readonly-20261109a` | `7bdec60` | Original-operation read witness va immutable window/detail authority qo‘shildi; root release hold saqlandi. PORT-013 ochiq. |
| `port/ledger-scope` | `6c87e63` | Matn scope noaniqligi uchun diagnostika va 16 fixture test; UI matni va business logic o‘zgarmadi. |
| `port/integrate-production-roles-20261109a` | `f3c8afc` | WIP’dagi ikki xil Home modelini aralashtirish muammosi keyingi main yechimiga muvofiqlashtirildi; ilova kodi main bilan bir xil. |
| `port/chat-integrate` | `5409ea6` | Alohida qolgan non-merge patch yo‘q; keyingi shared Chat transport/main kodi saqlandi. Faqat tarix birlashtirildi. |
| `port/integrate-rezka` | `112bf8a` | Alohida qolgan non-merge patch yo‘q; protected split deep-link guard saqlandi. Faqat tarix birlashtirildi. |
| `port/handoff-scratch-20261109a` | `10ea19d` | Arxivdagi synthetic probe’lar app va odatiy test globidan tashqarida saqlandi. Expo fetch host adapteriga moslangan Qolip probe’i 6/6; transfer observation PORT-017’da. Dart ishga tushirilmadi. |

`port/scoped-read-experiment` `cb0e751` ko‘rildi, 27 fake testi o‘tdi va o‘zgarishsiz qoldirildi; PORT-018 sabab main’ga olinmadi. Merge natijasi butun V2 porti yoki barcha rollar tugaganini anglatmaydi. Hali ochiq V2 tafovutlari va telefondagi tekshiruvlar yuqoridagi ID’larda davom etadi.

### Paketning yakuniy tekshiruvi

- To‘liq Node to‘plami: `node --test --test-concurrency=6 tests/*.test.cjs` — 4,972 test, 4,954 pass, avvalgi aynan 6 Preparation host-import fail va 12 TODO. Exit 1; hammasi o‘tdi deb belgilanmagan. Fail nomlari yuqoridagi PORT-001’dagi ikki faylga tegishli.
- `npx tsc --noEmit -p tsconfig.ios.json` — exit 0. Android — exit 2, avvalgi aynan 9 Worker diagnostikasi; yakuniy log dastlabki batch diagnostikalari bilan satrma-satr bir xil.
- `npx expo lint` — exit 0, 0 error va avvalgi 1 Admin warning.
- `CI=1 EXPO_OFFLINE=1 npx expo export --platform ios --output-dir .expo/port-batch-final-ios` va Android uchun mos buyruq — ikkalasi exit 0, Hermes bytecode yaratildi. Bu native build yoki telefon sinovi emas.
- Ledger `check` — exit 0, 1,030 source va 87 test tag V2’da resolve bo‘ldi; 11 literal-endpoint warning saqlangan. Text gate’lar yuqoridagi tafovutlar va PORT-016 scope diagnostikalari sabab ochiq; yangi istisno qo‘shilmadi.
- V2 checkout toza, HEAD va baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`, drift 0. V2’da Flutter/Dart, live backend, telefon, simulator yoki printer ishlatilmadi.
- Qolgan unmerged branchlar: eski backup va o‘zgartirilmagan `port/scoped-read-experiment`. Qolgan o‘nta ko‘rilgan port/integratsiya branchi main tarixida mavjud. Keyingi journal-only commit/merge tekshirilgan app kodini o‘zgartirmaydi.

## 2026-11-09 Qolip davomiy checkpoint’i

`port/qolipchi` joriy `f2becec` main’dan davom etdi. Cell/raw/universal scanner sahifalari (`ea541b1`) va real secure request ID uchun native mikrosekund moduli tayyorlandi. V2 oqimi, scanner’ning original role/focus/foreground umri va retry ID formati saqlandi. To‘liq Qolip roli ochilmadi; qolgan caller, UI va telefon ishlari PORT-012/019/020’da.

- Qolip/shared-camera testlari 750/750. To‘liq Node to‘plami: 5,034 test, 5,016 pass, avvalgi aynan 6 Preparation host-import fail va 12 TODO; hammasi o‘tdi deb belgilanmagan.
- iOS typecheck va lint o‘tdi; Android’da avvalgi 9 Worker diagnostikasi, lint’da avvalgi bitta Admin warning saqlandi. Ikkala platforma Hermes eksporti o‘tdi.
- Clock moduli iOS `iphoneos` uchun unsigned build va Android debug AAR assembly’dan o‘tdi; Android tekshiruvi command-only SDK 36 / NDK 28.2 bilan bo‘ldi. C va Swift clock core’lari host’da kompilyatsiya qilinib tekshirildi. Bu butun app yoki telefon sinovi emas.
- Ledger: 1,038 source / 88 test tag resolve, avvalgi 11 endpoint warning, V2 drift 0. Text gate hali ochiq: iOS 80 missing / 55 extra; Android 80 / 64, global-only scope mosliklari 376 / 381. Yangi matn istisnosi yo‘q.
- Native development binary qayta build qilinishi va telefon sinovi kerak. V2 checkout o‘zgarmadi; Flutter/Dart, live backend, simulator yoki printer ishlatilmadi. Push qilinmaydi.

