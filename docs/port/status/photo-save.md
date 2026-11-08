# photo-save

Status: build configuration prepared; native device verification remains open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| iOS photo save | `ios/Runner/Info.plist`, `NSPhotoLibraryAddUsageDescription` | Build a new development binary and verify the permission prompt and image saving on a real iPhone. No permission was granted by this change. |

## Checkpoint

The Expo SDK 58 media-library config now uses the exact V2 photo-add purpose text. Existing photo-read and Android granular permissions are unchanged. Expo documents `savePhotosPermission` as the iOS `NSPhotoLibraryAddUsageDescription` setting: https://docs.expo.dev/versions/v58.0.0/sdk/media-library-legacy/.

No worker or preparation files, source V2 files, native project directories, or user photo permissions were changed. The new setting requires a fresh app binary. No simulator, emulator, or physical device was used.

## Verification

- The focused configuration test passed. Expo's SDK 58 config introspection added only the expected iOS photo-add description; all other iOS plist values and the Android permission lists matched the starting configuration.
- iOS TypeScript, uncached Expo lint, and the ledger check passed. Android TypeScript retained the nine pre-existing worker errors.
- The full Node suite had 1,110 passes and the same six pre-existing preparation Android ESM import failures; the new focused test passed.
