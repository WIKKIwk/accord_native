# Native bridges and plugins

V4 targets Expo Go today, and Expo Go cannot load custom native code. The first role that needs a local
module moves V4 to a development build: add `expo-dev-client` and `eas.json`, and keep Expo Go working until
then. `.port/role-<id>.md` lists the channels each part needs. Native folders are generated, so never edit `ios/` or
`android/` by hand. Put native code in `modules/<name>/`, created with
`npx create-expo-module@latest --local`, and permissions in `app.json` or a config plugin.

The Expo docs' module flow uses CocoaPods terms and they do not mention an SPM-only setup. V2's rule
"iOS must use Swift Package Manager only" belongs to V2's `pubspec.yaml`, and nothing has established it
for V4. Do not apply it to V4 and do not try to remove Pods. Open an item if it blocks you.

## V2 platform channels

| Channel | What it does | V2 native source | V4 plan |
|---|---|---|---|
| `accord/bluetooth_printer`, `accord/bluetooth_printer/discovery` | Bluetooth label printing, device discovery | `BluetoothPrinterChannel.kt` (1,510 lines, `android/app/libs/printer-lib-3.5.8.aar`); `XPrinterBluetoothChannel.swift` (1,674 lines, `ios/vendor/xprinter/PrinterSDK`) | Local module. Vendor the same SDKs. Compare TSPL byte for byte with V2 output |
| `accord/usb_printer` | USB printing on Android | `UsbPrinterChannel.kt`, `GodexRpsRenderer.kt` | Local module, Android only |
| `accord/app_update` | Download and install an APK | `AppUpdateChannel.kt` | Local module, Android only |
| `gscale/bonjour`, `gscale/nsd`, `gscale/udp_discovery` | Local-network scale discovery | `SceneDelegate.swift` on iOS, `MainActivity.kt` on Android | Local module, plus iOS local-network permissions |
| `accord/secure_account_storage` | Account secrets | `SecureAccountStorageChannel.kt`, `SceneDelegate.swift` | `expo-secure-store` first; confirm its value size limit against the V2 payload |
| `accord/push_registration` | iOS push token | `AppDelegate.swift` | `expo-notifications`; send the token type the backend expects |
| `accord/device_info` | Device details for push registration | `MainActivity.kt`, `SceneDelegate.swift` | `expo-device`; compare field by field |
| `accord/system_navigation` | Android gesture or button navigation | `SystemNavigationMode.kt` | Read how V2 uses the answer, then choose insets or a small module |
| `accord/native_dock` | iOS system tab bar over Flutter | `SceneDelegate.swift` | Already native through `expo-router/native-tabs`; port the items, tap and hold behaviour |
| `accord/native_back_button` | Native iOS back button bridge | `SceneDelegate.swift` | Native stack header; port the behaviour |
| `accord/iroh_transport`, `accord/erp_discovery` | Dormant Iroh transport | `IrohTransportChannel.*` | Excluded |

Tag ported channels by name with non-word characters replaced: `// @v2 accord_usb_printer`.

## Flutter packages

Starting points, not facts. Confirm against the installed package and the SDK 58 docs, and always install
with `npx expo install <package>`.

| V2 package | V4 starting point | Note |
|---|---|---|
| `http` | `fetch` through `authorizedFetch` | See `mechanisms.md` |
| `shared_preferences` | `expo-sqlite/kv-store` (present in `node_modules`) | V4 has its own keys, `accord_v4_*`. Copying V2's key names gives no data migration by itself |
| `sqflite` | `expo-sqlite` | Installed |
| `image_picker`, `file_picker` | `expo-image-picker`, `expo-document-picker` | Installed |
| `mobile_scanner` | `expo-camera` | Installed. V2 uses a patched copy in `third_party/mobile_scanner`, so read what the patch changes |
| `qr_flutter` | `qrcode-generator` | Installed |
| `local_auth` | `expo-secure-store` biometric options, as in `appLock.ts`, or `expo-local-authentication` | V2 has a patched `third_party/local_auth_darwin`; read it |
| `firebase_messaging`, `flutter_local_notifications` | `expo-notifications` | Not installed. Confirm how the backend sends push before choosing |
| `just_audio`, `record` | `expo-audio` | Not installed. `app.json` blocks `android.permission.RECORD_AUDIO`; lift that only in the role that needs voice |
| `video_player` | `expo-video` | Not installed |
| `share_plus` | `expo-sharing` | Not installed |
| `gal` | `expo-media-library` | Installed |
| `pdf`, `barcode` | No direct equivalent | Label and PDF output must match. Do not assume HTML-to-PDF is equivalent. Open an item |
| `pdfx` | No direct equivalent | V2 has a patched copy in `third_party/pdfx`. Open an item |
| `model_viewer_plus` | No direct equivalent | 3D factory view in `assets/models/`. Open an item |
| `xml`, `crypto` | Check usage; `expo-crypto` is installed | |
| `loading_indicator_m3e`, `androidx_graphics_shapes` | Compose `LoadingIndicator`, `Shape` in `@expo/ui/jetpack-compose` | |
| `device_preview`, `sqflite_common_ffi_web` | Not needed | Development or web only |

## Rules for a local module

- Keep the method names, arguments and result shape of the V2 channel. The TypeScript above it should
  read like the V2 Dart wrapper.
- Implement both platforms, or state clearly that V2 only has one. Keep timeouts and retries where V2 has
  them.
- Vendored SDK binaries need a licence check before they go in the V4 repo. Open an item if the licence
  is unclear.
- Hardware behaviour counts as verified only on a real device with a real printer or scale. Say so in the
  report when it was not.
