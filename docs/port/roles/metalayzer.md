# Metalayzer — V2 UI contract

Source: `accord_mobile_v2/lib/src/features/metalayzer/presentation/metalayzer_screen.dart`, `metalayzer_navigation.dart` and `features/admin/presentation/raw_material_scan_dialog*.dart`.

## Home

- Title and home destination: `Metalayzer`; profile destination: `Profil`. Drawer and dock expose these two destinations.
- Body instruction: `Xomashyoni skan qiling yoki QR kodini kiriting.`
- Scanner button: `Xomashyoni skan qilish`, or `Keyingi xomashyoni skan qilish` after a completed material. Opens the existing raw-material scanner with title `Xomashyoni skan qiling`; cancellation retains current material.
- Input: `Xomashyo QR kodi`, submit affordance `Tekshirish`. Empty lookup displays `Xomashyo QR kodini kiriting`. Editing clears the result and errors.
- Result card: item name (or item code if name is empty), `Metalayzer bo‘ldi` or `Metalayzer bo‘lmagan`, `QR kod`, `Ombor`, `Miqdor`. Quantity has at most six decimal places and a trimmed unit.
- Action `Metalayzer bo‘ldi` sends the scanned material barcode and is disabled when already marked or an operation is busy. A successful reply updates the same card. No quantities, cutting or stock state changes are requested.
- While looking up/scanning/saving, input and actions are disabled and shell loading is shown. Save displays an activity indicator.
- Missing scope: `Metalayzer akkaunti bilan kiring.` Errors use the server message, or respectively `Xomashyo ma’lumotlari tasdiqlanmadi. Qayta tekshiring.`, `Akkaunt yoki ruxsatlar o‘zgardi. Sahifani qayta oching.`, or `Serverga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.`

## Scanner

Reuse the raw-material QR scanner: camera detection or manual entry returns one code; close/back cancels. The scanner uses the existing localized camera, manual-entry and permission surfaces. An account change invalidates pending scan and request results.

## Shared hook

`useMetalayzerLogic()` exposes `barcode`, `setBarcode`, `material`, `inputError`, `error`, `busy`, `saving`, `enabled`, `lookup`, `startScan`, `lookupScanned`, and `complete`. Call `startScan()` before opening the scanner and `lookupScanned(codeOrNull)` after it closes. `formatMetalayzerQuantity(qty, uom)` formats the card quantity.
