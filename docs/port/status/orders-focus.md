# orders-focus

Status: optional shared search-focus controls prepared; role wiring and phone checks remain open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Qolip block search | `qolip_blocks_screen.dart:225-229` | The Qolip screen must connect `onSearchFocus`, `onSearchBlur` and `showProfile` to its own focus state. Compare focus, blur and profile visibility on real iOS and Android phones. No device was used. |

## Checkpoint

`OrdersHeader` keeps its existing default: the profile button is visible and no focus callbacks are supplied. An opt-in caller can supply search focus/blur callbacks and control profile visibility without rebuilding the existing native search field. Existing Worker and Preparation call sites and code are unchanged. This shared capability alone does not complete the Qolip screen.

Expo SDK 58 documents the universal TextInput focus/blur callbacks at https://docs.expo.dev/versions/v58.0.0/sdk/ui/universal/textinput/. The installed SDK's iOS and Android implementations forward these callbacks. This is a source/API check, not a device test.

## Verification

- Four focused mocked-render cases cover iOS and Android default behavior and opt-in focus/blur. The existing Preparation header test also passed.
- The aggregate Node suite had 1,171 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. These are not native builds or device tests.
