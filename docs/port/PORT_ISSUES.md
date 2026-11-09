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
| PORT-009 | Yangi rollarning Chat ulanishi | Umumiy transport merge qilindi, lekin bu har bir rolning yashirilgan Chat route, drawer/dock va unread ko‘rsatkichini avtomatik ulab bermaydi. Har bir rolning navigatsiyasi V2 bilan alohida tugatiladi. | `status/boyoqchi.md`, `status/customer.md`, `status/supplier.md`, `status/homashyo.md`; [umumiy Chat](status/chat.md) | Boyoqchi ulandi; qolgan rollar navbatida |
| PORT-010 | Boyoqchi / `port/boyoqchi` | Palitraning animatsiyali page tracking’i, draft fayl saqlanishi, completion reconciliation’ning V2’dan farqlari, training-image error mapping, sheet dismissal va ayrim Profile/Settings yo‘llari bo‘yicha qaydlar bor. Chat/login hold olib tashlandi: ikki platformada Chat route, drawer/dock va haqiqiy unread ulandi; Profile Settings/PIN va boshqa sanalgan tafovutlar hali ochiq. | [Boyoqchi Open items](status/boyoqchi.md#open-items) | Branch tekshiruvida aniqlashtirish |
| PORT-011 | Homashyo / `port/homashyo` | Haqiqiy save/issue/print amallari va pending buyruqni tasdiqlash/reconciliation bo‘yicha hold’lar qayd etilgan. Printer/scanner, saqlangan buyruq, navigatsiya va ikki platformadagi surface xulqi V2 bilan tekshiriladi. | [Homashyo Open items](status/homashyo.md#open-items) | Branch tekshiruvida aniqlashtirish |
| PORT-012 | Qolipchi | Asosiy `port/qolipchi`, read-only home va integratsiya branchlaridagi takroriy ishlar hali birlashtirib baholanmagan. To‘liq rolning V2 parity va surface auditi qolgan. | `port/qolipchi`, `port/qolipchi-home-readonly-20261109a`, `port/integrate-production-roles-20261109a`; `status/qolipchi-home-readonly-20261109b.md` | Branch navbatida |
| PORT-013 | Admin read-only | `port/integrate-admin-readonly-20261109a` dagi qolgan read authority o‘zgarishlari joriy `main` va V2 bilan solishtirilishi kerak. Butun Admin roli tugagan deb belgilanmagan. | [Admin holati](status/admin.md), [production read guard](status/production-order-read-guard.md) | Branch navbatida |
| PORT-014 | Umumiy test mode | D3 bo‘yicha markazlashgan test mode portning oxirida qilinadi. Hozirgi alohida demo-token bloklari to‘liq V2 test mode bilan teng deb hisoblanmaydi. | `PORT.md` D3, `status/chat-secure.md#test-mode-pending` va rol holat fayllari | Reja bo‘yicha keyin |
| PORT-015 | Boyoqchi logout / PIN | V2 `SecurityController.clearForLogout` app PIN, switch PIN va biometric sozlamalarni o‘chiradi. Boyoqchi hozir guarded auth logout’ni chaqiradi, ammo yangi same-account login PIN’ini kechikkan cleanup o‘chirib yubormasligi uchun ushbu cleanup vaqtincha yo‘q. Account-operation va witness bilan muvofiqlashtirilgan cleanup kerak. | `src/boyoqchi/BoyoqchiLayout.ios.tsx`, `.android.tsx`; V2 `security_controller.dart:59-72`; `status/boyoqchi.md` | Keyin tuzatish |

## V2’dan meros bo‘lgan va alohida tuzatiladigan holatlar

Quyidagilar Chat manba auditi vaqtida qayd etilgan V2 xulqlari. Ular yangi V4 regressiyasi deb belgilanmagan; tuzatishdan oldin tegishli holat takrorlanadi va alohida o‘zgarish qilinadi.

| ID | V2 xulqi | Manba / dalil | Holat |
|---|---|---|---|
| V2-001 | Chat detail focus’ni yo‘qotsa ham mounted qolgan paytda active conversation saqlanishi mumkin; eski detail dispose’i yangisini tozalashi mumkin. | `chat_detail_screen.dart:81-109`, `chat_store_ChatStore_methods_01.dart:501-533`; [Deviations candidates](status/chat.md#deviations-candidates) | Keyin tekshirish va tuzatish |
| V2-002 | App fon rejimiga o‘tganda oldindan boshlangan sync yoki receipt flush bekor qilinmaydi; kech kelgan natija read receipt yuborishi mumkin. | `chat_runtime.dart:42-49`, `chat_store_sync.dart:77-131,406-443`; [Chat qaydi](status/chat.md#deviations-candidates) | Keyin tekshirish va tuzatish |
| V2-003 | Gap xabarlari avval xotiraga olinadi, keyin lokal bazaga yoziladi. Yozish xatosidan keyingi retry xotiradagi sequence sabab ayrim saqlanmagan xabarlarni qayta olmasligi mumkin. | `chat_store_sync.dart:160-213`; [Chat qaydi](status/chat.md#deviations-candidates) | Keyin tekshirish va tuzatish |

## Tuzatilgan qaydlar

Hozircha yo‘q. Keyingi tuzatishda tegishli ID, natija va commit shu yerda qayd etiladi.
