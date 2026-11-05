# V2 → V4 portini Codex bilan yuritish

Bu qo'llanma odam uchun. Codex uchun qoidalar `.agents/skills/` ichida.

## Asosiy g'oya

Port rol bo'yicha boradi. Logika bir marta yoziladi va umumiy bo'ladi. Android va iOS o'z ekranlarini alohida
yasaydi, shuning uchun biriga mos narsa ikkinchisini buzmaydi.

Qancha ish borligini shu buyruq ko'rsatadi:

```bash
node .agents/skills/accord-port/scripts/port_ledger.mjs plan
```

## Codex'ni ishga tushirish

Har doim `accord_mobile_v4` ichidan oching. Boshqa joydan ochilsa, skilllar va `AGENTS.md` to'g'ri yuklanmaydi.

```bash
cd /Users/wikki/Desktop/Accord_project/accord_mobile_v4 && codex -m gpt-6.1-terra -c model_reasoning_effort=max -s workspace-write -a on-request -c sandbox_workspace_write.network_access=true
```

- `-m`: `config.toml` da `gpt-6-luna` (272 ming oyna) turibdi, terra va sol'da oyna 500 ming.
- `-s workspace-write`: `config.toml` da `danger-full-access` turibdi. Bu flag bilan Codex v2 ni o'qiy oladi, lekin
  unga yoza olmaydi.
- `.git` va `.agents` ham yozishdan yopiq bo'ladi. Shu sabab `git commit`, `v2_contracts.sh` va `v2_oracle.sh` uchun
  Codex ruxsat so'raydi.
- Codex'ni ChatGPT ilovasidan ishlatsangiz, shu model va cheklovni ilovadan tanlang.

### `$accord-port` topilmasa

Skill nomlari uchta va aynan shunday yoziladi: `$accord-port`, `$accord-port-ios`, `$accord-port-android`.
Codex'da `$` yozing: ro'yxatda uchalasi chiqishi kerak.

Chiqmasa, deyarli har doim Codex `accord_mobile_v4` emas, `Accord_project` ildizidan ochilgan bo'ladi. Ildizdan
ochilganda Codex faqat eski uchta skillni ko'radi (`flutter-to-expo-port`, `expo-ios-swiftui-screens`,
`expo-android-compose-screens`). Shu paytda ildizga yozish ruxsati v2 ni ham qamraydi, shuning uchun u yerda portni
boshlamang. Ilovada loyiha sifatida aynan `accord_mobile_v4` papkasini oching.

## Bitta rol qanday o'tadi

**1. Logika.** Rol necha qismdan iborat bo'lsa, shuncha sessiya. Qismlar sonini `plan` ko'rsatadi.

```text
$accord-port preparation rolining 1-qismini port qil
```

**2. Android va iOS.** Logika commit qilingandan keyin. Har biri alohida sessiya, bir vaqtda ham ishlatsa bo'ladi.

```text
$accord-port-android preparation rolining ekranlarini docs/port/roles/preparation.md bo'yicha yasa
```

```text
$accord-port-ios preparation rolining ekranlarini docs/port/roles/preparation.md bo'yicha yasa
```

**3. Audit.** Rol oxirida bir marta, yangi sessiyada.

```text
$accord-port preparation rolini audit qil: V2 bilan solishtir, kodni o'zgartirma
```

Android va iOS'ni bir vaqtda ishlatsangiz, har birini alohida worktree'da oching. Buning uchun avval `.agents/`,
`docs/port/` va tsconfig fayllari commit qilingan bo'lishi kerak, worktree ichida esa `npm ci` kerak bo'ladi.

## Commitlar

Codex har bir tugagan ish guruhidan keyin commit qiladi, oxirida bir marta emas. Guruh: bitta API sohasi (endpoint'lar
va ularning testlari), hook'ga ko'chirilgan bitta qoida, yozib olingan kontraktlar yoki UI kontrakti. Odatda har 8-15
metoddan keyin. Xabar shakli: `port(aparatchi/1): queue actions, 9 methods`.

- Codex faqat o'zi o'zgartirgan fayllarni qo'shadi (`git add <fayl>`), `git add -A` ishlatmaydi. Sizning yoki boshqa
  sessiyaning tegilmagan fayllari commitga kirmaydi.
- To'xtashdan oldin ham o'tgan narsani commit qiladi va to'xtagan joyini `PORT.md` ga yozadi.
- `git push`, `amend`, `rebase` va `reset` yo'q. Push'ni o'zingiz qilasiz.
- `.git` sandbox'da yozishdan yopiq, shuning uchun har commitda Codex ruxsat so'raydi. Ruxsat oynasida
  "shu buyruq uchun yana so'rama" variantini tanlasangiz (agar chiqsa), keyingi commitlar so'ramaydi.
- Qaytarish kerak bo'lsa, Codex ilovasidagi **Undo** emas, `git revert <hash>` ishlating: Undo oxirgi javobdagi hamma
  o'zgarishni olib tashlaydi.

## Hamma rollar uchun tayyor promptlar

Menga yozib o'tirmaysiz: prompt hamma rolda bir xil, faqat rol nomi (`id`) o'zgaradi. Ro'yxat `roles.json` va `plan`
dan olingan, shuning uchun nomlar aniq. Tartib: yuqoridan pastga, lekin istalgan rolni oldin olsangiz ham bo'ladi.

| # | Rol (`id`) | Nima | Logika sessiyalari | Logika prompti |
|---|---|---|---:|---|
| 1 | `base` | Login, session, profile, PIN and the shared core (~225 ming token) | 2 | `$accord-port base rolining 1-qismini port qil` · `$accord-port base rolining 2-qismini port qil` |
| 2 | `preparation` | Tayyorlov masteri (~112 ming token) | 1 | `$accord-port preparation rolini port qil` |
| 3 | `boyoqchi` | Boyoqchi (~27 ming token) | 1 | `$accord-port boyoqchi rolini port qil` |
| 4 | `customer` | Customer (~29 ming token) | 1 | `$accord-port customer rolini port qil` |
| 5 | `supplier` | Supplier (~29 ming token) | 1 | `$accord-port supplier rolini port qil` |
| 6 | `aparatchi` | Print apparatus worker (~443 ming token) | 3 | `$accord-port aparatchi rolining 1-qismini port qil` · `$accord-port aparatchi rolining 2-qismini port qil` · `$accord-port aparatchi rolining 3-qismini port qil` |
| 7 | `homashyo` | Homashyo rezkachi (~20 ming token) | 1 | `$accord-port homashyo rolini port qil` |
| 8 | `chat` | Chat, used by all roles (~88 ming token) | 1 | `$accord-port chat rolini port qil` |
| 9 | `rezka` | Rezka master (~51 ming token) | 1 | `$accord-port rezka rolini port qil` |
| 10 | `material` | Material supply and GScale (~98 ming token) | 1 | `$accord-port material rolini port qil` |
| 11 | `werka` | Werka (~116 ming token) | 1 | `$accord-port werka rolini port qil` |
| 12 | `qolipchi` | Qolipchi (~174 ming token) | 1 | `$accord-port qolipchi rolini port qil` |
| 13 | `admin` | Admin, everything else (~795 ming token) | 5 | `$accord-port admin rolining 1-qismini port qil` · `$accord-port admin rolining 2-qismini port qil` · `$accord-port admin rolining 3-qismini port qil` · `$accord-port admin rolining 4-qismini port qil` · `$accord-port admin rolining 5-qismini port qil` |
| 14 | `brigader` | Brigader and sales manager (~0 ming token) | 0 (admin'dan keyin) | `$accord-port brigader roli uchun faqat AppRouter qoidalari va yashirin amallarni port qil` |

Jadvaldagi qismlar soni rollar shu tartibda port qilinsa to'g'ri. Rolni birinchi bo'lib olsangiz, unga kerak bo'lgan
umumiy kod (login, session, API) ham o'qish ro'yxatiga kiradi va qismlar ko'proq bo'ladi. Aniq sonni
`node .agents/skills/accord-port/scripts/port_ledger.mjs role <id>` ko'rsatadi. Shu umumiy kodni baribir bir marta
port qilish kerak, qaysi rol birinchi bo'lishidan qat'i nazar. Rol tugagach, Codex uning nomini
`docs/port/DONE_ROLES.txt` ga qo'shadi va keyingi rollar uchun o'qish ro'yxati qisqaradi.

Bir rolning qismlari ketma-ket, har biri yangi sessiyada ishlaydi. Logika tugab commit qilingach, shu rol uchun:

```text
$accord-port-android <id> rolining ekranlarini docs/port/roles/<id>.md bo'yicha yasa
```

```text
$accord-port-ios <id> rolining ekranlarini docs/port/roles/<id>.md bo'yicha yasa
```

```text
$accord-port <id> rolini audit qil: V2 bilan solishtir, kodni o'zgartirma
```

Bu yerda `<id>` o'rniga jadvaldagi rol nomini yozasiz.

## Qayerdan boshlash kerak

**Qaysi rolni birinchi olishni siz hal qilasiz.** Quyida men taklif qilgan sinov varianti bor, majburiy emas:
**`preparation` (tayyorlov masteri)**. U arzon va v2 da testlari bor. Formulalar, materiallar, omborlar va
ishlab chiqarish ro'yxatlari Expo Go'da ishlaydi. Faqat ishlab chiqarish ekranidagi QR yorliqni qayta chop etish printer
orqali ishlaydi, shuning uchun u development build talab qiladi. Codex buni `PORT.md` dagi Open items ga yozib qoldiradi
va qolganini davom ettiradi. Natija yoqsa, `base` va keyingi rollarga o'ting. Yoqmasa,
kam narsa yo'qotasiz va skillni tuzatamiz.

Boshqa tartib kerak bo'lsa, `.agents/skills/accord-port/references/roles.json` dagi tartibni o'zgartiring, `plan`
qayta hisoblaydi.

## Limitni tejash

- **O'qish ro'yxati:** `role` buyrug'i kerakli kodni qator raqamlari bilan beradi, Codex 1 165 fayl ichida qidirmaydi.
- **Yozib olingan so'rovlar:** `v2_contracts.sh` v2 testlari yuborgan so'rovlarni skript bilan yozib oladi, model
  JSON'ni qo'lda ko'chirmaydi.
- **Widget testlari** port qilinmaydi, audit esa rolga bir marta o'tkaziladi.
- **Effort:** limit qisilsa, avval ekran sessiyalarini `-c model_reasoning_effort=high` bilan sinang. Logika va auditni
  `max` da qoldiring.

## Holatni tekshirish

Bitta rolda nima qolganini ko'rish:

```bash
node .agents/skills/accord-port/scripts/port_ledger.mjs role preparation
```

Umumiy qamrovni ko'rish:

```bash
node .agents/skills/accord-port/scripts/port_ledger.mjs status
```

V2 baseline'dan keyin nima o'zgarganini ko'rish:

```bash
node .agents/skills/accord-port/scripts/port_ledger.mjs drift
```

## Siz qaror qiladigan narsalar

- `docs/port/PORT.md` dagi **Decisions** jadvali hozircha standart qarorlar.
- **Open items** ga qarab turing: Codex savol berish o'rniga noaniq narsalarni shu yerga yozadi.
- **Deviations candidates** dagi v2 xatolarini tuzatish yoki tuzatmaslikni siz hal qilasiz.
- V2 ni qachon yangi baseline qilishni ham siz hal qilasiz: `drift` natijasini ko'rib, Codex'ga "drift sync qil" deysiz.
