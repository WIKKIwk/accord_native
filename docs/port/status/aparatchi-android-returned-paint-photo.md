# Aparatchi Android: returned-paint controls and photo

## V2 comparison

| V2 surface | V4 surface | Result |
|---|---|---|
| Finish quantity dialog, `admin_production_map_orders_progress_qty.dart` | `src/OrderScreen.tsx` | Returned-paint action has a 56 dp Android height. V2's action has a 52 dp minimum. |
| Returned-paint sheet, `returned_paint_sheet.dart` | `src/OrderScreen.tsx`, `src/components/WorkerIconButton.android.tsx` | Back and photo actions have 48 dp touch targets and 24 dp icons; labels and actions are unchanged. |
| Selected photo, `returned_paint_sheet.dart` | `src/workerReturnedPaintPhoto.ts`, `src/boyoqchi/BoyoqchiImage.tsx` | Read the selected file's bytes before uploading; show the uploaded image with the existing authenticated preview. |

## Verification

- 67 focused tests pass, including the two Android hit targets, action height, native file reading, upload failure,
  selected-image preview and image replacement.
- Android and iOS platform TypeScript checks and the Android Expo export pass. Expo lint passes with one existing
  unrelated Admin hook warning. The export source map contains the changed Android source files.
- The connected Android phone's existing upload contained a 14-byte `File not found` response from `fetch(file://...)`.
  Executing the corrected reader in isolation against the phone's selected cache file returned the complete JPEG bytes.
  The actual upload and preview of a newly selected photo were covered by focused tests, not repeated on the phone.

## Open item

The open phone session still has the old code and a corrupted previously uploaded image. Reload the app and reselect
the photo; the currently entered finish-form values may be lost on reload.

## Android photo-source dialog

At the user's request, the Android camera/gallery choice now uses the existing Expo UI Material dialog. It has
56 dp camera and gallery actions and a cancel action; Back and outside taps dismiss it. V2 uses a bottom sheet with
the same two source choices. The iOS source picker is unchanged. Account/order changes retire the open choice.

Focused dialog, picker, upload and preview tests pass, as do both platform TypeScript checks. The actual native
dialog's appearance and picker transitions still need a phone check after the updated app is loaded.
