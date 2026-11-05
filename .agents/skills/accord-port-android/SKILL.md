---
name: accord-port-android
description: Build a role's Android screens for the Accord V2 to V4 port, as *.android.tsx with native Jetpack Compose through @expo/ui/jetpack-compose and Material 3. Use for Android screens, sheets, dialogs and navigation in V4. Not for API, models or business rules (accord-port) or for iOS (accord-port-ios).
---

# Android screens for the Accord port

Behaviour comes from V2 through the shared V4 logic. The look comes from Material 3. V2 is itself Material, so
stay closer to its layout here than on iOS, but use real Compose components. Android owns its whole screen and
route tree, so nothing here has to fit iOS.

## Inputs

1. `docs/port/roles/<id>.md`, the UI contract written by the logic session.
2. `.port/role-<id>.md`, from `port_ledger.mjs role <id>`, for the surface list and its Android checkboxes.
3. The V2 widget named in the contract, only for anything the contract leaves unclear. Read it by line range.

V2 is read-only. If there is no contract yet, stop and say that the logic session must run first. If
`git branch --show-current` says `main`, stop and tell the user to run
`.agents/skills/accord-port/scripts/port_worktree.sh <id>-android` and open that folder.

## Scope fence

Write only `*.android.tsx`, `*.android.ts`, route files under `src/app/android-<role>/`, and your status file
`docs/port/status/<id>-android.md`. Its shape is in "Parallel sessions" of `$accord-port`. An iOS session may
be running at the same time. Shared files (`*Logic.ts`, `*Api.ts`, `*Model.ts`, `use*.ts`) belong to the logic
session. If one needs a change, add a row under "Needs from the integrator" and carry on with the
rest. Do the same for the `src/app/index.tsx` entry that opens your routes; do not edit that file.

Simulators and emulators are shared. Start Metro on your own port (`npx expo start --port <free port>`). If the
device is in use, finish the code and report that it was not run.

No `fetch`, parsing, validation or business rule goes in a view. A condition such as "this button is enabled
when..." must come from the hook.

## File pattern for new screens

```text
src/<domain>/
  useRezkaQueue.ts         shared hook, from the logic session
  rezkaTypes.ts            shared types
  RezkaQueue.ios.tsx       accord-port-ios
  RezkaQueue.android.tsx   this skill
```

- There is **no `.tsx` fallback for new screens**. A missing platform file then fails that platform's bundle
  loudly, instead of quietly shipping a stub.
- **Existing screens can still silently fall back.** `ChatThreadScreen.tsx`, a stub reading "Chat hozircha iOS
  uchun tayyorlanmoqda", reaches Android users today because no `.android.tsx` exists. Look for this on every
  surface you take over.
- Existing worker and chat screens also use shared views (`OrderScreen.tsx`, `WorkerScreen.tsx`). When one does
  not fit Android, give Android its own `.android.tsx` screen on top of the hook rather than adding platform
  branches to the shared file.
- Tag the V2 surface once in the file: `// @v2 WerkaHomeScreen`. The ledger reads this as Android coverage. Only
  add a tag when the view is real. A stub never carries a tag.

## Native building blocks already in V4

| Need | Use | Example |
|---|---|---|
| Layout and controls | `@expo/ui/jetpack-compose`, wrapped in `Host` | `WorkerFab.android.tsx` |
| Modifiers and motion | `@expo/ui/jetpack-compose/modifiers`, `animated`, `spring` | `WorkerFab.android.tsx` |
| Dialogs | `AlertDialog` with its slots | `WorkerAlert.android.tsx` |
| Bottom sheets | `useNativeSheet` from `src/nativeSheet.tsx`, which renders `ModalBottomSheet` plus `RNHostView` | `WorkerOrderSheet.android.tsx` |
| FAB and FAB menu | `FloatingActionButton`, with the AndroidX motion constants | `WorkerFab.android.tsx` |
| Tabs, drawer, bottom bar | Existing worker components | `WorkerTabs.android.tsx`, `WorkerDrawer.android.tsx`, `WorkerBottomBar.android.tsx` |
| Long, scroll-linked lists | Reanimated `FlatList` with `RefreshControl` | `WorkerQueueList.android.tsx` |
| Colours | `useMaterialColors`, through `useWorkerColors.android.ts` | |
| Icons | `Icon` with a drawable, or `SymbolView` with `{ android: 'name' }` from `expo-symbols` | `WorkerFab.android.tsx` |
| React Native inside Compose | `RNHostView` | `WorkerOrderSheet.android.tsx` |
| Back button | `BackHandler` | `WorkerFab.android.tsx` |
| Haptics | `expo-haptics`, wherever the contract lists one | |

Why `FlatList` for the queue: V4's git history shows several rounds of Android list performance work, and that
list coordinates with the header and tab gestures. Follow it for similar lists. `LazyColumn` is fine for simple
lists that do not need this.

## Rules

- Every Expo UI component sits inside a `Host`. Flexbox applies to the `Host` itself, and inside it you lay out
  with `Row` and `Column`.
- Use Compose names here. `VStack`, `HStack` and `Toggle` are not in `@expo/ui/jetpack-compose`.
- **Never guess an API.** The installed types are the truth, and they also work when the network is off:
  `node_modules/@expo/ui/build/jetpack-compose/` and its `modifiers/`. Docs are at
  `https://docs.expo.dev/versions/v58.0.0/sdk/ui/jetpack-compose/`.
- A missing component is resolved in this order: another Expo UI component, then a React Native view with
  Material colours, then a custom composable from the extending guide at
  `https://docs.expo.dev/versions/v58.0.0/sdk/ui/jetpack-compose/extending.md`. Custom native views need a
  development build, so add an open item to your status file first.
- **Back behaviour is parity, not style.** Port each `PopScope` from V2 (32 uses) as `BackHandler` or sheet
  properties: same "are you sure" prompts, same order of closing sheets. `app.json` sets
  `predictiveBackGestureEnabled` to false and `softwareKeyboardLayoutMode` to `pan`, so test keyboards and forms
  with those on.
- Handle edge-to-edge insets with `react-native-safe-area-context`.
- Use V2's brand colours only where the contract calls for them, such as the order status tones from
  `src/workerOrderAppearance.ts`. Otherwise use Material dynamic colours.
- Support light and dark mode, TalkBack descriptions on icon-only controls (`semantics`), and a `testID` on
  primary actions. All texts come from the contract's keys. Check Urdu right-to-left once localization lands.

## Commits

Commit after each finished surface group (one screen with its sheets and states), not once at the end. Run
`npx tsc --noEmit -p tsconfig.android.json` first and check it adds no new errors, stage explicit paths only
(`git status --short`, then `git add <paths>`, never `-A`), and use `port(<role>/android): <screens>`. Commit before
you stop if the session ends early. Never push, amend, rebase or reset. The full rules are in "Commits" of
`$accord-port`.

## Done means

- Every surface in the contract has an Android view with **every** state listed, and every action has its V2
  enable condition.
- `npx tsc --noEmit -p tsconfig.android.json` adds no new errors, and `npx expo lint` adds no new errors.
- `port_ledger.mjs role <id>` shows the Android box checked for each surface.
- It was run on an Android emulator against the test server, in light and dark mode, including the hardware back
  button. If you could not run it or had no test account, say "not run on an emulator" in your report. Do not
  call it verified.
