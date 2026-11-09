# chat-secure

Status: in progress
Stopped at: finish native build checks and complete the integration gates, then merge this branch as explicitly requested by the user.

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

No text exceptions were added for this transport scope. The full Chat role's separate text/surface audit remains tracked in `status/chat.md`.

## Checks so far

- 296 focused Chat, authentication, redirect, timeout, guarded-read and affected caller tests passed.
- iOS TypeScript passed.
- Android TypeScript reports the same nine existing Worker prop/import errors; none is in this scope.
- macOS Foundation host tests passed for the actual Swift core: origin validation, cookie-free configuration, redirect rejection, socket IDs and cancellation.
- Expo prebuild completed for iOS and Android; its incidental package-script edits were restored.
- V2 drift: zero commits/files. Ledger check resolves all 928 source tags and 76 test tags. Its 11 literal-endpoint warnings include existing dynamic Chat conversation/media paths.

## Open items

| Item | Required work |
|---|---|
| Native build integration | Compile the module bindings against the actual Expo iOS/Android dependencies and run the Android core host contracts |
| Final gates | Full Node suite, lint, export checks and merge review |
| User phone smoke test | Reconnect after network loss, background/resume, expired-session re-login and account switching on iOS and Android; no simulator or physical device has been used |

## Deviations candidates

The branch preserves the existing V4 request/session lifecycle checks; it adds no retry, cache, product policy or user flow. Full Chat model/UI parity is outside this transport branch and remains open in `status/chat.md`.

## Test mode pending

Shared test mode remains a separate final port step under D3. No test-mode network behavior is introduced here.
