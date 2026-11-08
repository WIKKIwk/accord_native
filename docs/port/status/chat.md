# chat

Status: in progress
Stopped at: unread state primitives and local conversation, message, cursor and pending-receipt storage; the service is not yet connected to any screen or role.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Shared unread runtime | `ChatRuntime`, `ChatStore.startForCurrentSession` | Connect the per-profile conversation cache to startup, manage foreground lifecycle and clear old-session state; connect a single shared service without changing worker or preparation files. |
| Chat synchronization | `ChatStore._synchronizeChat`, `_fillMessageGap`, `_acceptRealtimeMessage` | Connect the local message/cursor storage to cursor sync, gap recovery, message deduplication and realtime message payload handling. A list-only GET or poll is not an equivalent unread service. The existing native message model omits some V2 fields, which remain open for the full Chat role. |
| Malformed recovery payloads | `ChatSyncPage.fromJson`, `ChatMessage.fromJson` | V4 currently rejects a message map that its existing parser cannot preserve rather than advancing past it; V2 supplies defaults for some missing fields. Compare malformed backend responses and resolve this explicit difference in the full Chat audit. |
| Read and delivery receipts | `ChatStore.markRead`, `_queueReceipt`, `_flushPendingReceipts` | Connect the durable pending-receipt queue to read/delivery APIs and retry it, including active-conversation clearing and recovery after interruption. |
| Chat hook integration | `ChatDetailScreen`, `ChatConversationsScreen` | Connect existing shared Chat list and thread hooks to the same state and lifecycle without replacing their platform screens. |
| App entry and logout | `ChatRuntime`, `AppRuntimeReset` | The integrator must connect the eventual session-scoped runtime at an authorized common entry point and ensure logout/account switches reset it. |
| Chat role surfaces | `ChatDetailScreen`, `ChatParticipantProfileScreen` and Chat widgets | Audit and complete the full role on both platforms, including voice, participant profile, request cards and all text, sheets and actions. |
| Device checks | Chat role | No simulator, emulator or physical device has been used. |

## Source and drift notes

- This checkpoint follows V2 commit `f11910bb2c8c7081ce26770e69811b03fd0739ed`; the repository baseline pin is still an integrator task. No historical replay fixture was used.
- The unread runtime/store/sync/model/local-store/realtime, Chat API part, session/reset, push handler and role dock paths checked are byte-identical between `7c87a54` and `f11910bb`. In the directly relevant changed files, `chat_detail_screen.dart` adds a `setState` forwarding helper without changing active-conversation entry or cleanup; its part uses that helper only for voice state, and `mobile_api.dart` removes an unused math import. This is a behavior-specific comparison, not a proof that all transitively imported library files are identical.
- `ChatUnreadState` is only the synchronous unread-rule primitive. The local store follows V2 conversation and message upserts, 100-item restore order, cursor persistence and pending-receipt sequence coalescing/acknowledgment. V2 keys by role/ref; V4 deliberately includes server origin as well, matching its existing Chat outbox and preventing cross-server cache bleed. Neither is connected yet: the service does not fetch, sync, deliver receipts or drive a badge.
- Expo SDK 58 documentation and the installed `expo-sqlite` types/source specify that exclusive transactions use their callback connection, commit or roll back, support iOS and Android, and may cause overlapping writes to fail with a database lock. This store serializes its own operations and uses a separate local database from the existing outbox. Native concurrency and persistence still need real-device verification.
- The existing Chat socket keeps its invalidation callback and now optionally exposes each recognized raw event to a future shared runtime. Sync, after-sequence history and delivery APIs follow the `f11910bb` source; malformed message-map handling remains an open difference above.

## Verification

- `node --test tests/chatUnreadState.test.cjs`: 6 passed. These source-derived tests cover the total, active-thread clearing, sender/known-message rules, unknown conversations and closed-session late work.
- iOS TypeScript and `npx expo lint` passed. Android TypeScript reported the nine pre-existing worker errors identified by the integrator; none was in this checkpoint.
- Conversation-cache, Chat model/API and unread-state tests: 28 passed. SQLite statements were exercised against Node's in-memory SQLite with a mocked Expo adapter; native SQLite remains untested on a device.
- After adding serialized local message/cursor storage, 36 focused Chat store, model, API, outbox and unread tests passed. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- With pending-receipt storage, 40 focused tests passed, including sequence coalescing and the race where an old acknowledgment must not erase a newer receipt. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- After the sync/delivery API and optional socket event changes, 46 focused Chat tests passed. iOS TypeScript and lint passed; Android retained the same nine worker errors.
- The worktree's incomplete copied dependencies were restored with `npm ci --ignore-scripts --no-audit --no-fund`. An offline Expo server was started briefly to refresh route types and stopped without using a device.
- Full role gates, text/surface audit and device checks remain open.
