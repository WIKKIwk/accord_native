# Admin Home on Android Expo Go

Status: Admin Home login regression fixed. Full page parity remains open.

The Android Expo Go inspector showed an active Admin session and one mounted notice driver, while `AdminTopNoticeProvider` had no child after screen reader detection resolved. The Metro bundle showed that React Compiler reused the initial lease result when the messenger and driver kept the same identities. The provider now subscribes to the actual lease. After reload, the inspector showed the Admin Home header and an opaque, interactive body on the connected phone.

V2 comparison used the pinned `f11910bb` source. The Home, shell and dock contracts already live in `docs/port/roles/admin.md`. The fix changes when the existing stack stays mounted and adds no user-facing text.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Home title, summary, retry and list, `admin_home_screen.dart:86` | `src/admin/AdminHomeScreen.android.tsx`, `src/admin/AdminTopNoticeProvider.tsx` | Outside this device check | Home verified mounted in Expo Go | Existing V4 destination coverage is partial. The notice driver can attach without dropping the screen. |
| Dock primary action opens `showAdminCreateHubSheet`, `admin_dock.dart:70` | `src/admin/AdminBottomBar.android.tsx`, `src/admin/AdminCreateHubProvider.tsx` | Outside this fix | Open | Android Home's dock still filters the primary action. |
| Create Hub root overlay and close/navigation path, `admin_create_hub_sheet_widgets_part_01.dart:4` | `src/admin/AdminCreateHubProvider.tsx` | Outside this fix | Open | The Android Home route still lacks the Create Hub overlay integration. |

## Gates and open items

- 101 focused tests passed. The compiled regression test fails against the previous provider, after screen reader detection resolves.
- Expo lint passed with the existing `AdminClosedHistoryOwner.tsx` warning. Android TypeScript still reports the existing two TS2590 errors in `appRoutes.ts`. Four existing drawer routing tests lack the `useAdminDrawerPresentation` mock.
- The Android page text gate reported 33 V2 and 333 V4 unmatched entries across 930 scanned V4 files. No exceptions were added. The full page text and surface audit remains open.
