# Aparatchi queue long press

This supplement covers the reported empty-sheet flash, delayed action loading and intermittent inline read error.
V2 baseline: `f11910bb2c8c7081ce26770e69811b03fd0739ed`.

## Source and implementation

| V2 source | V4 |
|---|---|
| `_SequenceOrderRow._buildVisual`, `admin_production_map_orders_sequence_widgets.dart`; Flutter `InkWell.handleLongPress` / `Feedback.forLongPress` | `workerLongPressFeedback.ts`, called by `WorkerScreen.openOrderActions` |
| `_hydrateWorkerActions` / `_readWorkerListDetail`, `admin_production_map_orders_worker_list.dart` | `workerLongPressPreparation.ts`, existing `workerDetailApi.ts` |
| `_showWatchOrderLongPress`, `admin_production_map_orders_screen_state.dart` | `prepareWorkerLongPress`, existing `workerLongPressMenu` |
| `_BosmaWorkerFinishSheet`, `admin_production_map_orders_module_pages.dart` | `components/WorkerLongPressActions.tsx` on iOS and Android |

## Entry and read lifetime

- Recognizing a long press gives native feedback immediately. iOS uses heavy impact; Android uses its long-press haptic.
- Read the selected order through V2's `workerProductionOrderDetail`: GET `sequence` with `worker_scope=true`,
  `detail=true`, `apparatus` and `order_id`. QR scan bootstrap is not the menu's read path.
- One opening owns the pending read. Additional holds or row taps cannot create overlapping presentations.
- Use one five-second deadline and at most two reads when the response epoch/revision trails the latest queue.
  Completed responses are not cached for subsequent gestures. Network errors do not cause extra retries.
- A changed account, query, apparatus, route or queue section retires pending presentation work. Its delayed response
  cannot open a sheet on the new page or release a replacement presenter.

## Presentation and actions

- Resolve the result before mounting a modal. An ordinary pending print order with no eligible action opens nothing.
- Preserve direct astatka entry, including pending orders whose current `stage_work.astatka_available` allows it.
- Show a ready print menu in source order: eligible temporary pause, re-pause, reclose, astatka, then eligible finish.
  Preserve the existing localization keys, confirmation steps and write-time revalidation.
- Resolve a paused lamination/glue handoff before presentation. The source's direct-astatka branch runs first.
- Prepare completed-history reactivation from the full scoped map, then its preview. Keep that review across native
  dismissal and explicit confirmation; rendering the menu does not request it again.
- A failed opening produces the source short error notice (`MobileApiException.message` or `worker.error.sync`),
  without mounting a loading/error sheet. Failed handoff lookup uses `worker.error.machine_roll` and the source
  ordinary report menu. The next explicit gesture can try again.
- Existing swipe, outside-tap and close-button dismissal remains owned by `WorkerOrderSheet` / `useNativeSheet`.

No new user-visible text or localization exceptions are required.
