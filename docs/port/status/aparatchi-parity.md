# Aparatchi remaining parity audit

Status: in progress; implementation groups and platform typechecks passed; final text scope diagnostics and refreshed native bundles are being checked. Native integration/device validation remains open.
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
| Paddon inline-camera scroll | `aparatchi_paddon_qr_addition.dart:24-31` | Apple-only local `AccordListScroll` module wraps the existing List in ScrollViewReader; source alignment .08, 280ms and ease-out-cubic curve; native swipe actions and Expo Go/manual-scroll fallback retained |
| General inventory | `InventoryMovementsScreen` and its method parts | Capability-guarded worker inventory with all asset kinds, profile-owned assigned warehouse filter, lazy incoming/outgoing lists, search, QR lookup, single/batch relocation and transfer request; iOS route and Android section replace the placeholder |

## Surface audit

| V2 surface and reference | V4 owner | iOS | Android | Evidence or limit |
|---|---|---|---|---|
| `_AparatchiWatchSequencePage`, `module_pages.dart:946` | WorkerScreen, queue models/presentation | compared | compared | Source row subtitle/heading/empty/limit labels; rendered queue callbacks and lifecycle regressions |
| `_AparatchiCompletedOrdersPage`, `module_pages.dart:1536` | WorkerScreen/WorkerWipHistory | compared | compared | Completed state, frozen issue detail and actual apparatus names |
| `_BosmaWorkerFinishSheet`, `_LaminatsiyaWorkerFinishSheet`, `_LaminatsiyaWorkerHandoffSheet` | WorkerLongPressActions | compared | compared | Fresh scoped controls; source action labels; completed work uses one preview and one confirmed token submission |
| `_ProgressQtyDialog`, `_ReadOnlyOrderDetailSheet` | OrderScreen and native dialog components | compared | compared | Existing detailed contract retained; nullable legacy control plus pending-write receipt fence added |
| `_ScannedWipHistorySheet`, `scanned_wip.dart:67` | WorkerScannedWipHistory | compared | compared | iOS header now closes through the native-sheet context rather than unmounting mid-animation |
| `_WorkerFrozenOrderDetailsSheet`, `wip_history_sheet.dart:3` | WorkerOrderDetails/WorkerWipHistory | compared | compared | Source localized messages and resolved apparatus display names |
| `_WorkerWipHistorySheet`, `wip_history_sheet.dart:106` | WorkerWipHistory | compared | compared | Source-exact rows/summary/details; batch-specific reactivation after native menu dismissal and explicit confirmation; write-pending lease follows the actual POST |
| `WorkerWipDetailsSheet`, shared widget | WorkerWipBatchDetails/new presentation helper | compared | compared | Correct default versus daily metadata, producer filtering, measurements, date/EPC and print-time close guard |
| Daily work/date/edit/reason surfaces | DailyWorkScreen/Dialogs/actions and existing edit/reason controllers | compared | compared | Inline details, 2-decimal cards versus 3-decimal detail units, localized source formats and explicit date commit/cancel |
| Paddon list/detail/transfer/scanned additions | Existing Paddon contract, AccordListScroll bridge | build/device pending | compared | Existing List/swipe flow retained; iOS camera target is wired to the native reader; complete wrapper build and real scroll/swipe timing remain open below |
| Aparatchi instructions | Existing shared instructions owner | compared | compared | Existing 4-language guide, assigned apparatus scope and real back-navigation retained |
| `_OrdersModulePage`, `_WorkflowAuditModulePage` | Not worker destinations | unreachable | unreachable | `screen_state.dart:640-680`: workerMode chooses WorkerWatchBody; admin module body is the other branch |
| `_ApparatusTransferReasonDialog` | Admin move pane | unreachable | unreachable | Only AdminModulesBody move pane; no worker reorder/transfer-order UI is invented |
| `_EarlyCloseOrderDialog` and admin freeze/edit menu | Admin order actions | unreachable | unreachable | `_showOrderActions` returns for workerMode, `screen_state.dart:2506` |
| `_OrderHomashyoPickerSheet` | Tayyorlov formula branch | unreachable | unreachable | `detail_widgets.dart:644,915,964`: summaryOnlyMode formula button, not aparatchi |
| General inventory movement destination | WorkerInventoryScreen and shared movement owner | compared | compared | Worker-only reachable branches; no preparation assignment controls or transfer lifecycle buttons (source passes actionsFor=>[]) |

## Open items

| Where | Evidence / remaining requirement |
|---|---|
| Paddon inline camera auto-scroll native integration on iOS | Implemented in `modules/accord-list-scroll/ios/AccordListScrollContent.swift` and the documented Expo UI wrapper `AccordListScrollModule.swift`; `WorkerPaddonDetail.ios.tsx` supplies the stable camera-row ID only during scanning. Real iPhoneOS SwiftUI typechecking passes, including List/swipeActions; the Expo wrapper has a syntax check and Apple autolinking resolves it. A full ExpoUI/ExpoModulesCore wrapper/app compile requires generated iOS/CocoaPods dependencies, absent from this worktree, then a rebuilt development binary and real camera/scroll/swipe validation. Expo Go/older binaries intentionally retain manual scrolling; native auto-scroll is not claimed there. |
| Native device/hardware | This isolated batch has not been run on a real phone; no simulator was used. Camera permission/background/resume, actual print delivery and native WebSocket module build/heartbeat remain physical checks from the previous contracts. |
| Text gate | Source-backed reachability/composition/mapped-error exceptions are recorded individually in `docs/port/text/aparatchi.tsv`, with the audit in `aparatchi-text-audit.md`. Both platforms now have0 missing/0 extra lexical rows and0 ambiguous tags. The real gate still exits1 for442 iOS/445 Android global-only scope diagnostics; these remain separately under applicability review. No baseline or ledger changes were made. |

## Verification

- Inventory checkpoint: expanded agent suite37/37 passed; parent inventory API/controller/render and reused inventory/transfer/reprint sweep29/29 passed. Both platform typechecks passed before the checkpoint. This feature's routes and shell wiring remain in the later integration checkpoint.
- Scoped-control/error checkpoint:261/261 focused error, legacy, WIP reactivation, preflight, transport, scoped-detail and Rezka report tests passed. The stale-detail exhaustion now retains V2's `order_page_changed` code and `Buyurtma yangilandi. Qayta oching.` message. Both native typechecks passed. Whole-role integration remains pending.
- UI checkpoint: agent source-surface suite50/50 and parent final daily/WIP/QR/native-printer/translator sweep41/41 passed. Both native typechecks passed and lint has no new warnings. The reused preparation printer picker received only an optional empty-label override; its default is unchanged. Worker uses the source Bluetooth-specific label and waits for native dismissal before continuing a report. Translator callbacks retain identity until locale changes, preventing repeated effect reads on ordinary re-render.
- Paddon camera-scroll bridge checkpoint:41/41 focused Paddon domain/hook/native-render/fallback tests passed (`/tmp/accord-paddon-camera-scroll-tests.log`), including scan activation/close/reopen, stable feedback target, preserved native List swipe removal and unavailable-module fallback. Both platform TypeScript projects, scoped ESLint, podspec Ruby syntax and `git diff --check` pass. `AccordListScrollContent.swift` plus `tests/native/AccordListScrollTypecheck.swift` typecheck against the real iPhoneOS27 SDK targeting iOS16.4; both bridge Swift files parse, and Expo Apple autolinking resolves `AccordListScrollModule`/`AccordListScroll`. These checks do not claim a full Expo wrapper/app build or device execution; no npm dependency or generated native folder was added.
- Full consolidated snapshot:6079 total,6056 passed,11 failed,12 TODO (`/tmp/accord-parity-all-tests.log`). The eleven failed names exactly match the unmodified main baseline; no new failure. Both iOS/Android Hermes bundles exported under `.expo/aparatchi-parity-export`. Subsequent diagnostic-only source fixes have their focused checks recorded separately.
- Intermediate combined worker/daily/shell suite:1135/1135 passed. Later parent receipt/scoped-menu integration:138/138 passed. Inventory expanded focused suite:32/32 passed. Final consolidated totals are pending.
- Both platform TypeScript projects and lint have passed at intermediate checkpoints; final consolidated runs pending. Lint retains the pre-existing AdminClosedHistoryOwner ticket-dependency warning.
- Final shell integration:49/49 queue/controller/navigation/drawer/native-control tests passed; focused boundary/WIP follow-up:237/237 passed. Both platform TypeScript projects passed and lint has0 errors, retaining only the existing warning. Paddon final sweep:66/66 passed, including optional-module fallback and actual native-screen target wiring.
- No backend mutation, account login, printer operation, simulator, device installation, main merge or push was performed.
