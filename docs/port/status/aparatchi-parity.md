# Aparatchi remaining parity audit

Status: in progress; local source fixes implemented, final history-action integration and full gates pending.
Worktree: `accord_mobile_v4-aparatchi-parity`, branch `port/aparatchi-parity`, based on the verified recovery/sheet fixes at `4da01457`. Metro continues serving the original recovery worktree while this batch is being checked. Main and the original V2 checkout are unchanged.
Source: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`, read-only clone in the recovery worktree. Its `lib/` and `test/` match the original V2 checkout at `44396752`.

## Implemented groups

| Group | V2 source | Result |
|---|---|---|
| Worker errors and optional controls | `_adminProductionMapException`, unknown-operation mapper, `AdminApparatusQueueOrderActionControl` | 179 fixed messages, dynamic diagnostic branches, 53 operation fallbacks, structured exception fields and header-first request IDs; preflight uses the normalized shared control decoder without a circular import |
| Legacy scoped authority | `scan_bootstrap.dart:4-8`, `read_only_sheet.dart:1460-1530` | Only the real scoped legacy reader can grant nullable-cursor authority; JSON/copies cannot forge it, modified controls lose proof, sections retain unchanged proof; modern contracts stay strict |
| Read/write ordering | `detail_sync.dart:29-48`, `read_only_sheet.dart:1824-1852` | A versioned write receipt fences unversioned/older/wrong-epoch action controls until matching scoped authority acknowledges it; no fabricated epoch/revision or write retry |
| Queue, drawer and FAB | `module_pages.dart:946-1133`, `aparatchi_navigation_drawer.dart:99-160`, `aparatchi_dock.dart:62-154` | Actual customer/temporary-pause subtitle, assigned heading, distinct empty labels, locale-aware tab/filter/drawer/dock/FAB labels, canonical-assignment Daily work guard; fresh scoped long-press read does not wait for the global list cursor |
| Daily work | `daily_work_screen_models_part_04.dart:28`, date-picker and quantity-formatters | Inline expansion, edit visible only when expanded and eligible, source precision/date/status metadata, date draft and explicit confirm/cancel, serial QR presentation and guarded edit handoff |
| WIP/scanned history | `worker_wip_details_sheet.dart`, `wip_history_sheet.dart`, `_ScannedWipHistorySheet` | Native close waits for dismissal, scoped sheet generations, exact localized details/summary/list metadata and QR actions; freeze details use apparatus display names |
| General inventory | `InventoryMovementsScreen` and its method parts | Capability-guarded worker inventory with all asset kinds, profile-owned assigned warehouse filter, lazy incoming/outgoing lists, search, QR lookup, single/batch relocation and transfer request; iOS route and Android section replace the placeholder |

## Surface audit

| V2 surface and reference | V4 owner | iOS | Android | Evidence or limit |
|---|---|---|---|---|
| `_AparatchiWatchSequencePage`, `module_pages.dart:946` | WorkerScreen, queue models/presentation | compared | compared | Source row subtitle/heading/empty/limit labels; rendered queue callbacks and lifecycle regressions |
| `_AparatchiCompletedOrdersPage`, `module_pages.dart:1536` | WorkerScreen/WorkerWipHistory | compared | compared | Completed state, frozen issue detail and actual apparatus names |
| `_BosmaWorkerFinishSheet`, `_LaminatsiyaWorkerFinishSheet`, `_LaminatsiyaWorkerHandoffSheet` | WorkerLongPressActions | integration ongoing | integration ongoing | Fresh scoped controls; existing action-specific guards and report/handoff tests retained |
| `_ProgressQtyDialog`, `_ReadOnlyOrderDetailSheet` | OrderScreen and native dialog components | compared | compared | Existing detailed contract retained; nullable legacy control plus pending-write receipt fence added |
| `_ScannedWipHistorySheet`, `scanned_wip.dart:67` | WorkerScannedWipHistory | compared | compared | iOS header now closes through the native-sheet context rather than unmounting mid-animation |
| `_WorkerFrozenOrderDetailsSheet`, `wip_history_sheet.dart:3` | WorkerOrderDetails/WorkerWipHistory | compared | compared | Source localized messages and resolved apparatus display names |
| `_WorkerWipHistorySheet`, `wip_history_sheet.dart:106` | WorkerWipHistory | action integration ongoing | action integration ongoing | Source-exact rows/summary/details; batch reactivation being connected |
| `WorkerWipDetailsSheet`, shared widget | WorkerWipBatchDetails/new presentation helper | compared | compared | Correct default versus daily metadata, producer filtering, measurements, date/EPC and print-time close guard |
| Daily work/date/edit/reason surfaces | DailyWorkScreen/Dialogs/actions and existing edit/reason controllers | compared | compared | Inline details, 2-decimal cards versus 3-decimal detail units, localized source formats and explicit date commit/cancel |
| Paddon list/detail/transfer/scanned additions | Existing Paddon contract | compared | compared | Existing flow retained; iOS inline-camera auto-scroll remains open below |
| Aparatchi instructions | Existing shared instructions owner | compared | compared | Existing 4-language guide, assigned apparatus scope and real back-navigation retained |
| `_OrdersModulePage`, `_WorkflowAuditModulePage` | Not worker destinations | unreachable | unreachable | `screen_state.dart:640-680`: workerMode chooses WorkerWatchBody; admin module body is the other branch |
| `_ApparatusTransferReasonDialog` | Admin move pane | unreachable | unreachable | Only AdminModulesBody move pane; no worker reorder/transfer-order UI is invented |
| `_EarlyCloseOrderDialog` and admin freeze/edit menu | Admin order actions | unreachable | unreachable | `_showOrderActions` returns for workerMode, `screen_state.dart:2506` |
| `_OrderHomashyoPickerSheet` | Tayyorlov formula branch | unreachable | unreachable | `detail_widgets.dart:644,915,964`: summaryOnlyMode formula button, not aparatchi |
| General inventory movement destination | WorkerInventoryScreen and shared movement owner | compared | compared | Worker-only reachable branches; no preparation assignment controls or transfer lifecycle buttons (source passes actionsFor=>[]) |

## Open items

| Where | Evidence / remaining requirement |
|---|---|
| Paddon inline camera auto-scroll on iOS | V2 `aparatchi_paddon_qr_addition.dart:24` calls ensureVisible at alignment .08. Installed SwiftUI List exposes no ScrollViewReader/scrollTo bridge; scrollPosition's target-layout API is for ScrollView/Lazy stacks, while native swipeActions requires List. No speculative replacement or stub is added. A verified List bridge/native alternative is still required. |
| Native device/hardware | This isolated batch has not been run on a real phone; no simulator was used. Camera permission/background/resume, actual print delivery and native WebSocket module build/heartbeat remain physical checks from the previous contracts. |
| Text gate | The lexical report still includes admin-only widgets, diagnostic strings and shared-role text. Current snapshot:272 missing/106 extra on iOS,272/114 on Android;0 ambiguous tags. No text exceptions, exclusions or baseline changes were added to hide these diagnostics. Full word-for-word role completion is not claimed. |

## Verification

- Inventory checkpoint: expanded agent suite37/37 passed; parent inventory API/controller/render and reused inventory/transfer/reprint sweep29/29 passed. Both platform typechecks passed before the checkpoint. This feature's routes and shell wiring remain in the later integration checkpoint.
- Scoped-control/error checkpoint:261/261 focused error, legacy, WIP reactivation, preflight, transport, scoped-detail and Rezka report tests passed. The stale-detail exhaustion now retains V2's `order_page_changed` code and `Buyurtma yangilandi. Qayta oching.` message. Both native typechecks passed. Whole-role integration remains pending.
- Intermediate combined worker/daily/shell suite:1135/1135 passed. Later parent receipt/scoped-menu integration:138/138 passed. Inventory expanded focused suite:32/32 passed. Final consolidated totals are pending.
- Both platform TypeScript projects and lint have passed at intermediate checkpoints; final consolidated runs pending. Lint retains the pre-existing AdminClosedHistoryOwner ticket-dependency warning.
- No backend mutation, account login, printer operation, simulator, device installation, main merge or push was performed.
