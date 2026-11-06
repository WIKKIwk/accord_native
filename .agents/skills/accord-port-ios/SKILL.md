---
name: accord-port-ios
description: Build a role's iOS screens for the Accord V2 to V4 port, as *.ios.tsx with native SwiftUI through @expo/ui/swift-ui, native tabs and native stack. Use for iOS screens, sheets, dialogs and navigation in V4. Not for API, models or business rules (accord-port) or for Android (accord-port-android).
---

# iOS screens for the Accord port

Behaviour comes from V2 through the shared V4 logic. The look and the navigation come from iOS. Match V2's
content and states, not its Material appearance. iOS owns its whole screen and route tree, so nothing here
has to fit Android.

## Inputs

1. `docs/port/roles/<id>.md`, the UI contract written by the logic session.
2. `.port/role-<id>.md`, from `port_ledger.mjs role <id>`, for the surface list and its iOS checkboxes.
3. The V2 widget named in the contract, only for anything the contract leaves unclear. Read it by line range.

V2 is read-only. If there is no contract yet, stop and say that the logic session must run first. If
`git branch --show-current` says `main`, stop and tell the user to run
`.agents/skills/accord-port/scripts/port_worktree.sh <id>-ios` and open that folder.

## Scope fence

Write only `*.ios.tsx`, `*.ios.ts`, route files under `src/app/ios-<role>/`, and your status file
`docs/port/status/<id>-ios.md`. Its shape is in "Parallel sessions" of `$accord-port`. An Android session may be
running at the same time. Shared files (`*Logic.ts`, `*Api.ts`, `*Model.ts`, `use*.ts`) belong to the logic
session. If one needs a change, add a row under "Needs from the integrator" and carry on with the
rest. Do the same for the `src/app/index.tsx` entry that opens your routes; do not edit that file.

Do not use simulators or emulators, and never add stubs or fake behaviour for them (D15). The user tests on a real phone. Finish the code and
report it as not run on a device.

No `fetch`, parsing, validation or business rule goes in a view. A condition such as "this button is enabled
when..." must come from the hook.

## File pattern for new screens

```text
src/<domain>/
  useRezkaQueue.ts         shared hook, from the logic session
  rezkaTypes.ts            shared types
  RezkaQueue.ios.tsx       this skill
  RezkaQueue.android.tsx   accord-port-android
```

- There is **no `.tsx` fallback for new screens**. A missing platform file then fails that platform's bundle
  loudly, instead of quietly shipping a stub.
- Existing worker and chat screens still use `X.tsx` fallbacks and some shared views (`OrderScreen.tsx`,
  `WorkerScreen.tsx`). When one does not fit iOS, give iOS its own `.ios.tsx` screen on top of the hook rather
  than adding platform branches to the shared file.
- Tag the V2 surface once in the file: `// @v2 WerkaHomeScreen`. The ledger reads this as iOS coverage. Only add
  a tag when the view is real. A stub never carries a tag.

## Native building blocks already in V4

| Need | Use | Example |
|---|---|---|
| Layout and controls | `@expo/ui/swift-ui`, wrapped in `Host` | `WorkerAlert.ios.tsx` |
| Modifiers | `@expo/ui/swift-ui/modifiers` | `WorkerQueueList.ios.tsx` |
| Long lists with pull to refresh | `List` with `listStyle`, `refreshable` | `WorkerQueueList.ios.tsx` |
| Alerts | `Alert` with `Alert.Trigger`, `Alert.Message`, `Alert.Actions` | `WorkerAlert.ios.tsx` |
| Menus | `MenuView` from `@expo/ui/community/menu` | `WorkerFab.ios.tsx` |
| Bottom sheets | `useNativeSheet` from `src/nativeSheet.tsx`. It opens `src/app/sheet/[id].tsx`, which renders `BottomSheet` from `@expo/ui/community/bottom-sheet` | `WorkerOrderSheet.ios.tsx` |
| Tabs | `NativeTabs` from `expo-router/native-tabs` | `src/app/ios-worker/_layout.tsx` |
| Navigation and titles | expo-router `Stack` options, never a drawn header | `src/app/ios-worker/(home)/_layout.tsx` |
| Icons | `SymbolView` from `expo-symbols` with SF Symbol names | `WorkerFab.ios.tsx` |
| Colours | `useWorkerColors.ios.ts`, `PlatformColor` | |
| React Native inside SwiftUI | `RNHostView`. Add a new `Host` for any Expo UI below it | `@expo/ui` docs |
| Haptics | `expo-haptics`, wherever the contract lists one | |

## Rules

- Every Expo UI component sits inside a `Host`. Flexbox applies to the `Host` itself, and inside it you lay out
  with `HStack` and `VStack`.
- Use SwiftUI names here. `Row`, `Column` and `Switch` are not in `@expo/ui/swift-ui`.
- **Never guess an API.** The installed types are the truth, and they also work when the network is off:
  `node_modules/@expo/ui/build/swift-ui/` and its `modifiers/`. Docs are at
  `https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/`.
- A missing component is resolved in this order: another Expo UI component, then a React Native view with
  `PlatformColor`, then a custom SwiftUI view from the extending guide at
  `https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/extending.md`. Custom native views need a development
  build, so add an open item to your status file first.
- `glassEffect` needs iOS 26 and Xcode 26. Provide what older iOS shows if V2 supports it.
- Support light and dark mode, Dynamic Type and VoiceOver labels on icon-only controls.
- All texts come from the contract's keys. Check Urdu right-to-left once localization lands.
- Copy V2's words letter for letter and add none. The native look is yours; the words, the kind of surface and the order are V2's. `port_ledger.mjs text <id> ios` lists the differences.

## Commits

Commit after each finished surface group (one screen with its sheets and states), not once at the end. Run
`npx tsc --noEmit -p tsconfig.ios.json` first, stage explicit paths only (`git status --short`, then `git add <paths>`,
never `-A`), and use `port(<role>/ios): <screens>`. Commit before you stop if the session ends early. Never push,
amend, rebase or reset. The full rules are in "Commits" of `$accord-port`.

## Done means

- Every surface in the contract has an iOS view with **every** state listed, and every action has its V2 enable
  condition.
- `npx tsc --noEmit -p tsconfig.ios.json` passes, and `npx expo lint` adds no new errors.
- `port_ledger.mjs role <id>` shows the iOS box checked for each surface.
- Your report says "not run on a device", and lists what the user should check on the phone, including light and
  dark mode. Do not call it verified.
