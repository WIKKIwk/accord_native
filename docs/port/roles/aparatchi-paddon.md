# Worker Paddon management

Specification: immutable V2 baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`,
`lib/src/features/aparatchi/presentation/aparatchi_paddons_screen.dart`,
`aparatchi_paddon_detail_screen.dart` and its parts, `aparatchi_paddon_qr_addition.dart`,
`aparatchi_paddon_print_workflow.dart`, `aparatchi_paddon_transfer_screen.dart` and actions.

## Domain and authority

- `WorkerPaddonList`, `WorkerPaddonDetail`, `WorkerPaddonTransfer` and `WorkerPaddonPrint` own the shared state transitions.
  `workerPaddonOwner` binds transport to the original session witness, complete read scope, assigned apparatus and route lifetime.
  Each read/write checks the same owner before dispatch, after refresh/retry and after decoding. An old confirmation cannot authorize a new route.
- Only active, assigned `cut` apparatus appear. Catalog limit is 10000. List limit is 100; transfer reads each assigned cut separately with limit 200 and `selectable_only=true`.
- Detail editability comes from the server snapshot (`can_manage_items`, locked state); unlock uses `can_unlock`.
  Transfer additionally requires admin/brigader, the creator, or `free_movement_enabled`. Only waiting WIP without received-warehouse/finished-stock evidence is movable.
- Mutations send once. An uncertain add/remove/unlock reads one fresh snapshot and checks the exact resulting membership/lock state before reporting success.
  Transfer reloads both sides and clears selection after either result. No automatic mutation retry is introduced.

## List

- Entry points: one drawer item per assigned cut (`worker.paddon.apparatus`, apparatus name) and the existing Paddon FAB destination.
- Title `worker.paddons`, or `worker.paddon.apparatus` when scoped. Subtitle `worker.paddon.subtitle`.
  Apparatus summary uses `worker.paddon.location.title`, `worker.paddon.location.subtitle`, Paddon and WIP counts.
- Initial/pull loading; `worker.paddon.load_failed` plus retry on failure; unselected apparatus chooser; `worker.paddon.empty.title/body` when empty.
  Rows retain server order, code, peremotka indication and WIP count; tap opens detail and returning refreshes.
- Create (`worker.paddon.create`) requires a valid selected assigned cut. POST create then detail. Failure `worker.paddon.create_failed`.
- Long press opens a bottom sheet with Delete only when the V2 management capabilities permit it.
  Delete then opens the native confirmation dialog with `worker.action.cancel` before `action.delete`; successful deletion reloads and shows `worker.paddon.deleted`.
- Transfer precedes Create in the dock and is present only with the matching V2 capability and selected cut.

## Detail and edits

- Header: code, peremotka, resolved apparatus/location, creator (`worker.paddon.creator.unspecified` fallback), gross/net totals,
  locked state and unlock action, WIP count, pending-QR count, bobina summary, note.
- Bobina groups come from assigned WIP, use integer microkilogram grouping, positive ascending values then unknown.
  Selecting/unselecting a bobina or changing edit mode clears selection.
- Normal list shows assigned items; Add shows available items. Preserve V2 order summary and WIP detail rows, counts and empty states.
  Free-movement hint only when enabled and manageable. Mixed normal/peremotka additions are rejected with the V2 production error.
- Long press opens the WIP detail bottom sheet with QR preview and explicit reprint; a missing QR shows the existing V2 message.
- Assigned row swipe removal is enabled only outside selection/scanning/busy/printing and only when manageable. Native Yes/No confirmation precedes the single-item endpoint.
- Dock: scan-add, Add, Remove; active mode shows its selected count, disables the opposite mode and shows Cancel.
  Bulk Add asks Yes/No; bulk Remove asks Cancel/Remove. Cancelling a nonempty selection asks Yes/No.
- Unlock asks Yes/No; success exits selection, broadcasts the scoped active-Paddon revision and shows the V2 success message.

## QR scan surfaces and back

- Inline camera and ordered staged-WIP preview; serial lookup queue, case-insensitive pending/staged deduplication,
  at most 500 including outstanding lookups; accepted/rejected feedback and haptics. Lookups accept only valid, waiting, unreceived WIP.
- Pending chip opens the review dialog (height 45%, clamped 160–400): removable WIP cards, Close then Confirm(count).
  Review blocks camera detections; confirmation is disabled while empty, resolving, saving or no longer manageable.
- Closing scan or backing out with staged/outstanding items asks the V2 Yes/No discard dialog. Rejecting keeps the scan.
  Confirming invalidates the queue before leaving. Back during a mutation is blocked. Old camera callbacks never write into a restarted scan.

## Printing

- Pick the existing native printer selector, prepare the same offline Paddon label request, physically print locally, then confirm server lock.
  Never confirm on cancellation/failure before local printing. USB and Wi-Fi choices are temporarily hidden by the user's explicit request; Bluetooth remains.
- If close-after-print is false or already locked, show `worker.paddon.printed`.
  On a new confirmed lock: broadcast scoped revision, refresh, then ask the separate native next-Paddon Yes/No dialog.
  Resolve apparatus in V2 priority: durable Paddon apparatus, route apparatus, completion apparatus, then its returned-options dialog.
  Create successor only on explicit acceptance; show `worker.paddon.next.created`.
- Failure keys distinguish preparation/local print, confirmation, and successor creation. No automatic hardware-print retry.

## Transfer

- Source above target, preserving selection if still available; initial source prefers route apparatus, target is first different unlocked Paddon.
  Each picker is a bottom sheet, excludes the other side and rereads the selected snapshot before accepting editability.
- Rows preserve V2 order/WIP details and show unavailable/received items as nonmovable.
  Selection belongs to one side; choosing on the opposite side clears it. Move(count) and long-press drag between zones share one guarded confirmation.
- Confirmation uses `worker.paddon.transfer.title/body` with count/source/target, Cancel before Move(count).
  Saving blocks back/refresh/actions. Success uses `worker.paddon.transfer.success`; forbidden and other failures retain V2 messages.

Native controls/layout differ by platform; content, surface kinds, action order, defaults, validations and state transitions do not.
Device camera, swipe/drag, modal lifecycle and physical Bluetooth printing require phone verification; source comparison and tests do not prove them.
