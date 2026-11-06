# Reusable orders and Chat pages

## Orders

The public UI lives in `src/shared/orders/`:

- `OrdersWorkspace`: the existing worker home shell, with its native iOS search/title/machine picker and Android animated machine tabs/pager. Pass `session`, `tabs: [{id, name}]`, `selected`, `onSelect`, search callbacks, menu/profile callbacks and a child render function. Optional `title` and `searchPlaceholder` adapt the labels. The shell adds no completed tab or role action.
- `OrdersList`: the existing native list, refresh, scrolling and Android deferred image-loading behavior. The child render function receives the pager gesture and native machine picker. Optional `onEndReached` supports the role's own pagination; `passthrough` marks accessories already containing their own native host.
- `OrderListItem`: the same thumbnail, text and status presentation as worker orders. A role passes its own text and tap/long-press callbacks; no production command is built into a row.
- `OrdersHeader`: the existing Android menu/search/profile header.

`components/WorkerTabs`, `WorkerQueueList`, `WorkerOrderListItem` and `WorkerHeader` retain compatibility exports/adapters. Both existing workers and preparation now render the shared implementations. Worker-only completed tabs are still assembled by `getWorkerTabs`; preparation supplies only apparatus returned by its own reader. Preparation keeps its paged/live controller and formula detail actions.

## Chat

`src/shared/chat/` separates page state from role navigation:

- `ChatRouteProvider` accepts `session`, `basePath`, optional menu/back callbacks and an optional native-tab closing callback. Its metadata cache is keyed by `session.imageCacheScope`.
- `ChatRouteStack`, `ChatListPage`, `ChatDirectoryPage` and `ChatThreadPage` are platform views imported from `ChatPages` without a suffix. A role's route files only re-export these pages. They never read `WorkerSession`.
- `createChatNavigation` builds list/directory/conversation navigation from the supplied base path; conversation IDs remain route parameters.
- `useChatConversations` and `useChatDirectory` share the existing requests, aborts, focus/background guards, live updates, debounce and directory paging across platforms. The existing `useChatThread` continues to own messages, read receipts, text outbox/retries and media upload.
- Native conversation/directory/thread views receive the session and navigation callbacks as props. The existing iOS thread animations and recent-photo composer are retained. Android now has real list/directory/thread views, text sending, retries, older messages and image/video/file selection using the same domain functions.

Existing consumers:

- Worker native iOS Chat remains at `/ios-worker/chat` and uses the shared pages through thin role adapters.
- Preparation native iOS Chat is at `/ios-preparation/chat` with its own native tab and enabled drawer destination.
- `/ios-chat` and `/android-chat` are session-guarded routes any signed-in role can open directly, without a worker or preparation context. Android worker and preparation entry points open `/android-chat`.

No backend or V2 files changed. This is the requested reusable presentation change, not completion of every role's V2 Chat port. Native device checks are recorded in `docs/port/status/role-pages.md`.
