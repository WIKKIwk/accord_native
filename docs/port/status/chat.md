# chat

Status: in progress
Stopped at: unread state primitives and conversation cache; the service is not yet connected to any screen or role.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Shared unread runtime | `ChatRuntime`, `ChatStore.startForCurrentSession` | Connect the per-profile conversation cache to startup, manage foreground lifecycle and clear old-session state; connect a single shared service without changing worker or preparation files. |
| Chat synchronization | `ChatStore._synchronizeChat`, `_fillMessageGap`, `_acceptRealtimeMessage` | Port cursor sync, gap recovery, message persistence/deduplication and realtime message payload handling. A list-only GET or poll is not an equivalent unread service. |
| Read and delivery receipts | `ChatStore.markRead`, `_queueReceipt`, `_flushPendingReceipts` | Persist and retry receipts, including active-conversation clearing and recovery after interruption. |
| Chat hook integration | `ChatDetailScreen`, `ChatConversationsScreen` | Connect existing shared Chat list and thread hooks to the same state and lifecycle without replacing their platform screens. |
| App entry and logout | `ChatRuntime`, `AppRuntimeReset` | The integrator must connect the eventual session-scoped runtime at an authorized common entry point and ensure logout/account switches reset it. |
| Chat role surfaces | `ChatDetailScreen`, `ChatParticipantProfileScreen` and Chat widgets | Audit and complete the full role on both platforms, including voice, participant profile, request cards and all text, sheets and actions. |
| Device checks | Chat role | No simulator, emulator or physical device has been used. |

## Source and drift notes

- This checkpoint follows V2 commit `f11910bb2c8c7081ce26770e69811b03fd0739ed`; the repository baseline pin is still an integrator task. No historical replay fixture was used.
- The unread runtime/store/sync/model/local-store/realtime, Chat API part, session/reset, push handler and role dock paths checked are byte-identical between `7c87a54` and `f11910bb`. In the directly relevant changed files, `chat_detail_screen.dart` adds a `setState` forwarding helper without changing active-conversation entry or cleanup; its part uses that helper only for voice state, and `mobile_api.dart` removes an unused math import. This is a behavior-specific comparison, not a proof that all transitively imported library files are identical.
- `ChatUnreadState` is only the synchronous unread-rule primitive. The new conversation cache follows V2's upsert and 100-item restore order, isolated by server and account as in the existing V4 Chat outbox. Neither is connected yet: the service does not fetch, sync, deliver receipts or drive a badge.

## Verification

- `node --test tests/chatUnreadState.test.cjs`: 6 passed. These source-derived tests cover the total, active-thread clearing, sender/known-message rules, unknown conversations and closed-session late work.
- iOS TypeScript and `npx expo lint` passed. Android TypeScript reported the nine pre-existing worker errors identified by the integrator; none was in this checkpoint.
- Conversation-cache, Chat model/API and unread-state tests: 28 passed. SQLite statements were exercised against Node's in-memory SQLite with a mocked Expo adapter; native SQLite remains untested on a device.
- The worktree's incomplete copied dependencies were restored with `npm ci --ignore-scripts --no-audit --no-fund`. An offline Expo server was started briefly to refresh route types and stopped without using a device.
- Full role gates, text/surface audit and device checks remain open.
