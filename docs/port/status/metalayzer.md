# Metalayzer

Status: partial
Stopped at: verify scanner camera behavior on real devices and implement the outstanding camera controls.

Source: V2 `052655a427e059f5c74c63aeb0fbaaeecbb273d6`; this explicitly requested new role was added after the older `V2_BASELINE`, so that baseline does not contain its screen or tests. Other-role drift is outside this change.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| iOS and Android scanner | `raw_material_scan_dialog_declarations_part_03.dart`, `ReliableMobileScanner` | V2 restricts detection to a scan window and supports tap-to-focus and auto zoom. The existing V4 CameraSurface does not expose these controls; detection currently covers the camera view. |
| iOS and Android | Metalayzer screen and scanner | Test login, account switching, scanner and completion on real phones; no device or simulator was used. |
| V2 contract recording | `test/metalayzer_test.dart` | The configured recorder exports the older `V2_BASELINE`, which predates this test. V4 source-derived request/parser tests pass; no V2 recording is claimed. |

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Home and material result, `metalayzer_screen.dart` | `src/metalayzer/MetalayzerHome.*.tsx`, `useMetalayzerLogic.ts` | ok | ok | Native controls; device verification outstanding. |
| Drawer, dock and profile, `metalayzer_navigation.dart` | `MetalayzerIosShell.ios.tsx`, `MetalayzerDrawer.android.tsx`, `MetalayzerFrame.android.tsx`, profile routes | ok | ok | Shared V4 profile and chat are reused. |
| Full-screen scan dialog, `raw_material_scan_dialog_declarations_part_03.dart` | `src/metalayzer/MetalayzerScanner.*.tsx` | partial | partial | Scan window, tap-to-focus and auto zoom are open above. QR/Data Matrix and manual entry use the shared camera. |

## Verification

- Focused Metalayzer API and role-route tests passed; source-derived, not a recorded V2 contract.
- Both platform TypeScript checks passed; Expo lint passed with one pre-existing admin warning.
- Full Node test suite: 6470 passed, 12 todo, 0 failed.
- Test server login and material lookup succeeded; no completion mutation was sent.
- Text gate `text page:Metalayzer both` passed with 10 evidenced accepted rows, including tool scope false positives, color literals and native back/logout labels.

## Deviations candidates

None beyond the open scanner differences above.

## Test mode pending

V2 rejects test-mode Metalayzer sessions; no demo data path is added.
