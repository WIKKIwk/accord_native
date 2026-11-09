# chat

Status: in progress
Stopped at: finish the full Chat model, media, text and surface audit and each new role's Chat wiring. The shared connection transport is completed in `chat-secure.md`; it uses the V2 ticket/reauthentication flow and cookie-free native WebSockets. A development build containing the new module is required for realtime connections.

## Completed shared transport

`subscribeChatLive` now uses the local `AccordChatSecure` module on both platforms, retaining the existing Chat routes and hooks. Ticket requests and saved-account reauthentication use the existing shared auth state with explicit SDK 58 Expo fetch. Native redirect/cookie rejection, cancellation, retry deadlines and protocol pings have source comparisons and automated checks in `status/chat-secure.md`. Its iOS module build and Android module build (available SDK 36) passed; physical-device QA and the default SDK 37 app build remain verification limits.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Shared unread runtime | `ChatRuntime`, `ChatStore.startForCurrentSession` | `useChatUnreadCount(session)` is implemented and now shares the completed native connection transport. It is not installed in common app entry and does not start for worker or preparation by itself. Finish each role's wiring and validate lifecycle and badge behavior on real devices and against the backend. |
| Chat synchronization | `ChatStore._synchronizeChat`, `_fillMessageGap`, `_acceptRealtimeMessage` | The native adapter composes the tested runtime with existing network/socket and local storage, but needs device and backend validation. The existing native message model omits some V2 fields, which remain open for the full Chat role. |
| Live conversation display | `ChatStore._acceptMessage` | Unread state updates the latest sequence and cache ordering time, but does not yet replace the displayed last-message preview or re-sort a live list. Complete that behavior in the Chat role audit before claiming full screen parity. |
| Malformed recovery payloads | `ChatSyncPage.fromJson`, `ChatMessage.fromJson` | V4 currently rejects a message map that its existing parser cannot preserve rather than advancing past it; V2 supplies defaults for some missing fields. Compare malformed backend responses and resolve this explicit difference in the full Chat audit. |
| Read and delivery receipts | `ChatStore.markRead`, `_queueReceipt`, `_flushPendingReceipts` | The existing thread now supplies its active conversation and loaded messages to the opt-in runtime; verify receipt retries and account-switch behavior on devices and against the backend. |
| Outgoing retry recovery | `ChatStore._recoverChatState` | Global recovery of pending text and media is still separate from the unread runtime; preserve the existing thread outbox and complete V2's background retry behavior in the full Chat role. |
| Chat hook integration | `ChatDetailScreen`, `ChatConversationsScreen` | In an opted-in role, the existing focused list and thread now reuse the session runtime's one live connection; without it, their previous live and direct-read paths remain. The list still has its own focused state. Compare full list/thread state without replacing platform screens and validate connection behavior on devices. |
| App entry and logout | `ChatRuntime`, `AppRuntimeReset` | The opt-in runtime registers the existing session-reset hook and closes on logout/account switch. Common app-entry wiring is intentionally not changed; coordinate with the integrator before making it global. |
| Chat role surfaces | `ChatDetailScreen`, `ChatParticipantProfileScreen` and Chat widgets | Audit and complete the full role on both platforms, including voice, participant profile, request cards and all text, sheets and actions. |
| Device checks | Chat role | No simulator, emulator or physical device has been used. |

## Deviations candidates

These are inherited from the selected V2 source and are preserved for the 1:1 port. They are candidates for a separate fix, not completed changes.

| Risk | V2 source | Concrete behavior |
|---|---|---|
| Read after navigation blur | `chat_detail_screen.dart:81-96,105-109`; `chat_store_ChatStore_methods_01.dart:501-533` | A mounted detail owns the active conversation until disposal, not until it loses route focus. A retained blurred detail can therefore suppress unread or mark later messages read; disposal of an older detail can clear a newer active conversation. |
| Read after backgrounding | `chat_runtime.dart:42-49`; `chat_store_ChatStore_methods_01.dart:135-142`; `chat_store_sync.dart:77-85,125-131,406-443` | Pausing stops the socket and timer but does not cancel a sync or receipt flush already underway. A delayed sync can mark an active conversation read and send the receipt after the app backgrounds. |
| Gap recovery after a failed write | `chat_store_sync.dart:160-173,184-208` | Gap messages enter memory before their SQLite write. If that write fails, a retry can use the advanced in-memory sequence, skip fetching intermediate messages, and later save the event cursor despite those messages being absent from local storage. |

## Source and drift notes

- This checkpoint follows V2 commit `f11910bb2c8c7081ce26770e69811b03fd0739ed`, now pinned in merged main `dad5041`; an isolated clean source snapshot was verified at that SHA. No historical replay fixture was used.
- The unread runtime/store/sync/model/local-store/realtime, Chat API part, session/reset, push handler and role dock paths checked are byte-identical between `7c87a54` and `f11910bb`. In the directly relevant changed files, `chat_detail_screen.dart` adds a `setState` forwarding helper without changing active-conversation entry or cleanup; its part uses that helper only for voice state, and `mobile_api.dart` removes an unused math import. This is a behavior-specific comparison, not a proof that all transitively imported library files are identical.
- The local store follows V2 conversation and message upserts, 100-item restore order, cursor persistence and pending-receipt sequence coalescing/acknowledgment. V2 keys by role/ref; V4 deliberately includes server origin as well, matching its existing Chat outbox and preventing cross-server cache bleed. The opt-in runtime is wired to native adapters and the existing Chat thread, but not yet to any role badge.
- Fetched [Expo SDK 58 SQLite documentation](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) and inspected the installed `node_modules/expo-sqlite/build/SQLiteDatabase.d.ts` and `node_modules/expo-sqlite/src/SQLiteDatabase.ts`. Exclusive transactions use their callback connection, commit or roll back, support iOS and Android, and may cause overlapping writes to fail with a database lock. This store serializes its own operations and uses a separate local database from the existing outbox. Native concurrency and persistence still need real-device verification.
- The existing Chat socket keeps its invalidation callback and now optionally exposes each recognized raw event to a future shared runtime. Sync, after-sequence history and delivery APIs follow the `f11910bb` source; malformed message-map handling remains an open difference above.

## Verification

- `node --test tests/chatUnreadState.test.cjs`: 6 passed. These source-derived tests cover the total, active-thread clearing, sender/known-message rules, unknown conversations and closed-session late work.
- iOS TypeScript and `npx expo lint` passed. Android TypeScript reported the nine pre-existing worker errors identified by the integrator; none was in this checkpoint.
- Conversation-cache, Chat model/API and unread-state tests: 28 passed. SQLite statements were exercised against Node's in-memory SQLite with a mocked Expo adapter; native SQLite remains untested on a device.
- After adding serialized local message/cursor storage, 36 focused Chat store, model, API, outbox and unread tests passed. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- With pending-receipt storage, 40 focused tests passed, including sequence coalescing and the race where an old acknowledgment must not erase a newer receipt. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- After the sync/delivery API and optional socket event changes, 46 focused Chat tests passed. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- The receipt flusher and related storage/transport/state tests: 44 passed. It preserves pending reads after a failed request and does not acknowledge an old account after a switch. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- The dependency-injected sync engine tests cover paginated cursor progress, 100-page bounds, gap recovery, persistence failures, concurrent calls, active-thread reads, realtime events and session switches. Sixteen sync/unread tests passed; the broader related run passed 46 before two additional focused tests. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- The session runtime and related transport/storage/sync tests passed 61 cases with mocked platform/network adapters. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- With the native adapter and runtime registry, 65 related tests passed, including same-session reuse, account switch, logout abort and background/resume. The hook's real React Native rendering and backend/device behavior have not been tested. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- With the existing thread bridge, 150 Chat and preparation-Chat tests passed. The new regression test exercises both the opted-in path and the unchanged direct-read path for aparatchi and tayyorlov sessions. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- After consolidating opted-in live subscriptions, 153 Chat and preparation-Chat tests passed. Focus/blur, invalidation fan-out, background/resume and stale-session callbacks have focused tests; no device or backend was used. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- After independent review, the attempted stricter lifecycle edits were undone; 32 focused sync, receipt, runtime, thread/list and preparation-Chat tests passed. The three V2-inherited risks above remain unchanged and open.
- A full-suite run exposed an outdated mock in the existing stale-account Chat test after adding the optional runtime import. The mock was updated without changing the assertion; 13 focused shared-page and Chat-bridge tests passed. Full-suite recheck remains pending.
- Pinned ledger reports 25 public API methods and 8 screens/sheets. The text gate fails with 157 unmatched V2 texts per platform and 41 iOS / 52 Android unmatched V4 texts; these scanner findings need a surface-by-surface audit. Ledger `check` passed with 8 endpoint warnings; it does not prove parity.
- The worktree's incomplete copied dependencies were restored with `npm ci --ignore-scripts --no-audit --no-fund`. An offline Expo server was started briefly to refresh route types and stopped without using a device.
- Full role gates, text/surface audit and device checks remain open.
