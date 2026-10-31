# Accord Mobile V4

Expo SDK 58 asosidagi bosmachi ish joyi prototipi. Loyiha V2 backend API kontraktlaridan foydalanadi.

## Ishga tushirish

```sh
npm install
npx expo start
```

Telefon va kompyuter bir tarmoqda bo‘lsin. Expo Go’da QR kodni oching; kerak bo‘lsa `npx expo start --tunnel` ishlating. Login ekranida server manzili, telefon va kirish kodi kiritiladi. Standart manzil V2 kodidagi test serveridir. Xodimga bosma aparati va navbat ruxsatlari biriktirilgan bo‘lishi kerak.

Navbat haqiqiy serverdan olinadi. Buyurtma amallari serverdagi ma’lumotni o‘zgartiradi; sinov hisobidan va test serverdan foydalaning. Prototipda yakunlash uchun bir rangli bo‘yoq hisoboti mavjud. Bir nechta rang, lak/erituvchi hamda QR yorliqni real printerga yuborish hali qo‘llab-quvvatlanmaydi. Yorliq ma’lumoti qaytsa ekranda ko‘rsatiladi.

```sh
npm run typecheck
```
