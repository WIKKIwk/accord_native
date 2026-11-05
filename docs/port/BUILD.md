# Accord Mobile V4: qurilmaga o‘rnatish

V4 Android va iOS’da `com.accord.mobilev4` identifikatoridan foydalanadi. U V2’ning
identifikatorlaridan farq qiladi, shuning uchun ikkala ilova bir qurilmada turishi mumkin.

## Expo hisobini ulash

Quyidagi buyruqlarni loyiha papkasida bajaring. Expo akkauntiga kiring, so‘ng yangi
EAS loyihasini yarating yoki mavjudini ulang:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` loyihaning EAS identifikatorini `app.json` ga yozadi. Uni integrator bilan
saqlang. Quyidagi build va imzolash bosqichlari hisob egasi tomonidan bajariladi.

## Android telefonga o‘rnatish

```sh
npx eas-cli@latest build --platform android --profile preview
```

EAS so‘rasa, Android uchun yangi imzolash kalitini yarating yoki mavjud kalitni
tanlang. Build tugagach, EAS bergan havolani Android telefonda ochib, APK’ni
yuklab oling va o‘rnating. `preview` ilovasi Metro serversiz ishlaydi.

Debug vositalari kerak bo‘lsa, `--profile preview` o‘rniga `--profile development`
ishlating; o‘rnatilgandan keyin development serverni ishga tushiring:

```sh
npx expo start --dev-client --port 19183
```

Telefonda development build’ni ochib, terminaldagi QR-kodni skanerlang. Telefon va
kompyuter bir tarmoqda bo‘lsin; port band bo‘lsa, boshqa bo‘sh port tanlang.

## iPhone yoki iPad’ga o‘rnatish

Ichki tarqatish uchun Apple Developer Program hisobiga kirish va qurilmani build’dan
oldin ro‘yxatdan o‘tkazish kerak:

```sh
npx eas-cli@latest device:create
```

EAS ko‘rsatgan havolani qurilmada oching va ro‘yxatdan o‘tkazishni yakunlang. Keyin:

```sh
npx eas-cli@latest build --platform ios --profile preview
```

So‘ralganda Apple Developer hisobini va ro‘yxatga olingan qurilmani tanlang; EAS’ga
imzolash sertifikati va provisioning profilini yaratishga ruxsat bering yoki mavjud
ma’lumotlarni tanlang. Build tugagach, EAS havolasini o‘sha qurilmada ochib ilovani
o‘rnating. Keyinchalik boshqa qurilma qo‘shilsa, uni ro‘yxatdan o‘tkazib yangi build
yarating yoki mavjud build’ni qayta imzolang.

Debug vositalari uchun `--profile development` bilan build yarating va yuqoridagi
`npx expo start --dev-client --port 19183` buyrug‘ini ishlating. Qurilma so‘rasa,
Settings → Privacy & Security → Developer Mode bo‘limida Developer Mode’ni yoqing.

## Expo Go va production

Expo Go bilan ishlash uchun development client o‘rnatilganidan keyin ham uni aniq
tanlash mumkin:

```sh
npx expo start --go --port 19183
```

Qurilmada SDK 58 bilan mos Expo Go’dan foydalaning. Printer kabi Expo Go tarkibida
bo‘lmagan native modullar uchun development build kerak. Fizik iOS qurilmada Expo Go
va Expo CLI bir xil Expo hisobiga kirgan bo‘lishi kerak.

Do‘konlarga mo‘ljallangan production build kerak bo‘lganda:

```sh
npx eas-cli@latest build --platform all --profile production
```

Production Android build’i AAB, iOS build’i esa App Store tarqatishiga mo‘ljallangan;
bu buyruq ilovalarni do‘konlarga avtomatik yubormaydi.

## Lokal tekshiruvlar

`npx expo prebuild --clean --no-install` iOS va Android loyihalarini muvaffaqiyatli
yaratdi; `ios/` va `android/` generatsiya qilinadi va Git’ga kiritilmaydi. Lokal
Android build bu Mac’da Android SDK topilmagani uchun ishlatilmadi.

`expo-doctor` mavjud loyihadagi yettita SDK paket versiyasi nomuvofiqligini ko‘rsatdi:
`react-native-safe-area-context`, `@expo/ui`, `expo`, `expo-constants`, `expo-linking`,
`expo-router` va `expo-splash-screen`. Ularni integrator boshqa parallel ishlarga
ta’sirini hisobga olib yangilashi kerak.

Manbalar: [EAS build profillari](https://docs.expo.dev/build/eas-json/),
[ichki tarqatish](https://docs.expo.dev/build/internal-distribution/),
[SDK 58 development client](https://docs.expo.dev/versions/v58.0.0/sdk/dev-client/).
