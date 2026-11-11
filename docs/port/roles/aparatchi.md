# Aparatchi behavioural contract index

Specification: read-only V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`. Native iOS and Android presentation may differ; visible content, conditions, actions and request semantics follow V2. The original V2 checkout's `lib/` and `test/` are identical to this baseline. Historical instructions in earlier reports to edit main are not part of this session: current work is isolated on `port/aparatchi-parity`.

This index joins the existing detailed contracts; it does not declare unchecked ledger entries complete.

- [Order detail, materials, actions, reports, QR, daily work and instructions](aparatchi-order-sheet.md).
- [Paddon list, detail, transfer and scanned WIP](aparatchi-paddon.md).
- [Queue warm ownership, network recovery, retained detail and sheet lifetime](aparatchi-recovery.md).

## Queue and navigation

V2 references: `admin_production_map_orders_module_pages.dart:760-1133`, `admin_production_map_orders_worker_helpers.dart:89-166`, `widgets/worker_queue_limit_filter.dart:27-78`, `aparatchi_navigation_drawer.dart:99-160`, `aparatchi_dock.dart:62-154`.

- Order apparatus tabs exactly as V2: first assigned visible apparatus, completed, remaining apparatuses. The completed tab and all shell labels use the current locale. Server apparatus names are not translated.
- Assigned apparatus lists show `worker.queue.your.apparatus`. Empty apparatus, apparatus orders and completed lists use their distinct production keys. Keep the same queue limit choices and language-specific Show/All/count labels, including V2's Uzbek fallback for Urdu's Show/All labels.
- The ordinary row subtitle contains the customer; only a temporarily paused apparatus adds `worker.temporary_pause.status` before it. The row state/tone is retained through transient reloads. Do not append invented pending/running status text. Single tap opens detail, long press opens authorized actions; frozen orders keep the existing notice/guard.
- A single synchronous native presentation owner covers queue detail, actions and completed history. Each opening has a new identity. A close request retains ownership until native dismissal, and retired close/choice callbacks cannot alter a later presentation. Menu-to-detail continuations wait for actual dismissal. Scope changes retire the old tree.
- The drawer's Daily work destination requires an apparatus operator and at least one canonical assigned apparatus. Paddon destinations use the actual assigned apparatus catalog. Transfer visibility follows `AppRouter.canOpenRoute(inventoryMovements)`.
- The FAB menu contains scan, daily work and paddons in that order, with `worker.action.scan`, `worker.daily` and `worker.paddons` labels. Keep QR handoff and scanner dismissal contracts from the detail/recovery contracts.
- General inventory movements is a capability-guarded destination, separate from preparation's restricted inventory. It has its own back navigation and must not expose preparation-only assignment/state mutation controls to a worker.

## Audit boundary

The role ledger includes shared admin widgets and diagnostic strings through lexical references. Reachability must be established before adding a worker action or declaring an absent admin surface a worker defect. Source text exceptions require actual branch evidence; no exception is justified merely by making the text gate pass. Hardware camera, Bluetooth printing and native WebSocket heartbeat still require a real device/development binary where their detailed contracts say so.
