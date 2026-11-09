# chat-secure

Status: done for the shared transport scope
Stopped at: implementation and review complete for the requested local main merge. The full Chat role remains in progress in `chat.md`; phone QA is not claimed.

## Scope and source

This branch completes the shared Chat connection transport. It does not claim completion of the full Chat role, its media features or other roles' held routes. The selected V2 source is `f11910bb2c8c7081ce26770e69811b03fd0739ed`; the original V2 checkout was clean and at that SHA before work.

The previous branch was a prototype with an independent secure/legacy UI policy and a permanent authentication hold. Those extra route blockers and messages are absent in V2 and have been removed. Shared Chat routes and hooks keep their current main implementation; their existing `subscribeChatLive` now uses the local native transport. There is no RN WebSocket fallback and no second authentication state machine.

## V2 comparison

| Behavior | V2 source | V4 implementation |
|---|---|---|
| Empty-body bearer POST for a fresh socket ticket | `lib/src/core/api/chat/mobile_api_chat.dart:400`, `chatLiveUri` | `src/chatLive.ts` calls the existing `authorizedFetch` with POST `/v1/mobile/chat/socket-ticket` |
| One shared stored-account login after 401, then one retry | `lib/src/core/api/mobile_api.dart:494-637`, `_sendAuthorized`, `_reauthenticateFromStorage` | Existing `refreshSession` and saved-account transaction remain authoritative; ticket and ordinary requests share them |
| No POST redirect or ambient cookies | `lib/src/core/network/mobile_http_client.dart:42-91`, `SecureMobileApiClient`; `_loginAt` | `authenticateAccount.ts` and `authorizedFetch.ts` explicitly import SDK 58 `expo/fetch`; login supplies `credentials: omit`, `redirect: manual`; authorized requests retain their existing manual redirect rules |
| Ten seconds per HTTP phase, rather than one combined ticket/login/retry deadline | `lib/src/core/api/mobile_api.dart:292,392-418`, `_requestTimeout`, `_post` | Removed the outer ticket timer; existing individual request/login deadlines are retained |
| Fresh ticket on reconnect, 1/2/4/8/15 second delays, any decoded map resets backoff | `lib/src/features/chat/realtime/chat_realtime_service.dart:38-76` | `src/chatLive.ts` |
| Ten-second socket handshake, 25-second protocol ping/pong; binary frames ignored | `lib/src/core/realtime/warehouse_live_client_io.dart:59-86` | Native OkHttp and URLSession WebSocket adapters; JS handshake deadline ends on open and no JSON heartbeat is injected |
| Pause and account reset cancel the old subscription | `lib/src/features/chat/state/chat_store_ChatStore_methods_01.dart:90-141`, Chat runtime | Existing app lifecycle plus session reset hooks cancel ticket work, native socket and late events |

SDK evidence: [Expo SDK 58 named fetch](https://docs.expo.dev/versions/v58.0.0/sdk/expo/#expofetch-api). The installed Android `expo/modules/fetch/NativeRequest.kt` disables cookies and redirects for these flags; iOS `Expo/Fetch/ExpoURLSessionTask.swift` applies the matching request properties. Native TLS uses normal platform validation, with no custom production trust or cleartext exception.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Existing Chat routes, list and thread; connection failure does not replace the whole page | `src/shared/chat/ChatRouteContext.tsx`, `useChatConversations.ts`, `src/useChatThread.ts` | unchanged from main | unchanged from main | Removed the prototype's additional secure-only blocker page and messages; no new surface, field, label or action |
| `ChatRealtimeService` connection lifecycle | `src/chatLive.ts`, `modules/accord-chat-secure` | source compared | source compared | Native adapters replace Dart I/O; physical-device behavior still needs user smoke testing |

Two source-backed text exceptions in `docs/port/text/chat.tsv` identify internal, caught transport errors that are never rendered. They were already present in main but became visible to the ledger after this transport received V2 tags. No UI string or surface was added. The full Chat role's separate text/surface audit remains tracked in `status/chat.md`.

## Verification

- Focused Chat/auth/affected-caller suite: 296 passed; final transport-only run: 21 passed after additional binary-frame coverage.
- Full Node suite: 4,327 tests, 4,309 passed, six failed and 12 existing TODOs. The same six failures were reproduced on untouched main: two Preparation Android test files fail to resolve the installed Expo UI `createModifier` ESM import in their host mocks. No new test failure remains. Existing auth/transport test harnesses now mock the explicit Expo fetch import; their assertions were retained.
- iOS TypeScript passed. Android TypeScript reports the same nine existing Worker prop/import errors; those source files are byte-identical to main.
- Expo lint passed with zero errors and one existing Admin hook-dependency warning.
- Expo prebuild and offline Hermes exports succeeded for both platforms. Incidental prebuild package-script edits were restored; generated projects and local module build products are ignored.
- Native iOS: `xcodebuild -project ios/Pods/Pods.xcodeproj -scheme AccordChatSecure -configuration Debug -sdk iphoneos -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO build` succeeded with Xcode 27/iPhoneOS 27, compiling the actual Expo module bindings and Swift core for arm64/iOS 16.4.
- Native Android: `:accord-chat-secure:compileDebugKotlin` succeeded against actual Expo Modules Core with the already installed SDK 36/Build Tools 36/NDK 28.2 command-line overrides. Project configuration was not downgraded or committed. The default build initially failed on the Mac's incomplete NDK 27.1 installation; sdkmanager does not currently offer `platforms;android-37` in this environment. This is a toolchain limit, not a default full-app build pass.
- Gradle dependency insight resolves exactly OkHttp 4.9.2, matching the host-contract version. The real Kotlin core host tests passed with synthetic loopback TLS: fixed origin/path, cookie/authorization absence, redirect rejection, send/cancel, module isolation and the production 25-second ping configuration.
- The actual Swift core passed macOS Foundation host checks for request/configuration, redirect rejection, socket IDs and cancellation. Host checks are not an iOS device run.
- V2 drift: zero commits/files, source checkout remains clean at the selected full SHA. Ledger check resolves all 928 source tags and 76 test tags; its 11 existing literal-endpoint warnings include V2's dynamically constructed Chat conversation/media paths.
- The full Chat role text gate remains incomplete, as on main: iOS 151 missing/82 extra and Android 152 missing/93 extra after the two internal-error exceptions. All nine listed surfaces belong to the larger Chat UI audit, not this transport change. This branch does not mark the full Chat role complete.

## Open items in this branch

None in the shared transport implementation. The broader Chat role's remaining model/media/UI work is recorded in `chat.md`.

## Verification limits and user phone checks

No simulator, emulator, physical device, real account credentials or live backend was used. Install a new development build containing `AccordChatSecure`; Expo Go and older binaries cannot supply this native realtime module. Check the existing Chat list/thread after network loss, background/resume, an expired-session re-login and an account switch on both platforms. Confirm a quiet connection remains alive and old-account events do not appear in the next account. Full native app SDK 37 setup and phone QA remain outside the automated evidence above.

## Deviations candidates

The branch preserves the existing V4 request/session lifecycle checks and V2 operational flow; it adds no retry, cache or product policy. Only the shared HTTP transport selection and login POST flags changed outside the Chat domain, because the V2 ticket retry reuses the same stored-account login path. Full Chat model/UI parity remains open separately.

## Test mode pending

Shared test mode remains a separate final port step under D3. No test-mode network behavior is introduced here.
