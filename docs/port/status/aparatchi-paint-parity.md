# Aparatchi paint and order-sheet presentation

Status: implemented and served on Metro; physical layout/hardware acceptance remains with the user.
Stopped at: latest requested large-button and small-status-indicator corrections are implemented and checked.

Worktree: `accord_mobile_v4-aparatchi-paint-parity`, branch `port/aparatchi-paint-parity`, based on the tested worker parity changes at45b77f1a. The separate audit commit is retained here too. Metro now serves this worktree at the existing LAN URL/port8081; `/status` returns running. Neither main nor V2 source was changed.

## Implemented

- The user's screenshot request authorizes the native visual refinement: one16pt card grid,20pt radii,12pt section spacing,8pt row spacing,44pt icon/disclosure targets and48pt action minimums. The identity header, intrinsic disclosure rows, aligned tabular counters, outcome buttons and summary cards share the same presentation tokens. Preflight no longer waits for a width callback or puts an extra34pt label inside a large control. Materials, molds and actions have clear boundaries; QR progress is subordinate to its section. Error/success colors adapt to iOS appearance. Existing texts, actions and backend gates remain authoritative.
- Latest user correction: native actions and header controls use standard `large` sizing again, with headline/title3 labels. Worker iOS queue rows use their existing small status dot and localized label on a neutral background; effective tone/state, customer, temporary-pause and completed-date details remain current. Shared defaults for other roles, Android card presentation and row gestures are unchanged. This visual choice is explicitly requested by the user.
- Automatic mold readiness follows `admin_production_map_orders_automatic_qolips.dart:96–119,178–205`: loaded empty requirements show `worker.mold.requirements.empty` and0/0; loading/read failures retain their distinct text. Counts come from actual ready members of the selected set, including shared extensions. Manual empty requirements keep their source header/count behavior. Retained presentation stores display-only reason/status/selection data, never a new action authority. Production-error/rework translations and count suffixes follow the source, including its plural suffix quirk.
- Returned paint reuses the existing shared named-field dialog, numeric field formatter, enabled image preview with download disabled, and shared image upload/delete API. A new named field needs both a valid nonnegative value and a name; duplicates retain the exact source notice. Indexed local values preserve the source's independent base/dynamic fields even when their labels match, while legacy saved drafts remain readable.
- Paint collection preserves finite nonnegative strings, normalization and source order. Raw-invalid values, missing image-only report and per-usage minimum counts have separate source validation. Closing-report raw return ink is distinct from ordinary completion's positive-only amount. The native camera/gallery selection uses quality84 and an1800px bound; empty/6MB errors are exact. New image metadata persists with the draft; a failed old-image cleanup does not roll back its replacement, and retired selections cannot update the next scope.
- iOS paint categories now include all three source headings. The iOS inventory filter explicitly shows disabled `Tanlanmagan` when no assigned warehouse exists, without adding a selectable empty warehouse.

## Verification

- Focused order/presentation/mold/paint/native inventory/palette suite175/175 passed. Handoff and resume integration9/9 passed after updating their extracted-function fixture for the new paint-helper dependency.
- Shared paint/photo/API/draft follow-up17/17 passed; earlier expanded photo/preview/shared-form checks27/27 and pure paint checks27/27 passed. Native component grid tests66/66 passed.
- Both iOS/Android TypeScript projects pass. Lint has0 errors and only the pre-existing AdminClosedHistoryOwner ticket-dependency warning. Source ledger resolves1236 `@v2`/115 `@v2-test` tags with the same11 endpoint-literal warnings.
- Full-suite snapshot:6148 total,6121 passed,15 failed,12 TODO (`/tmp/accord-order-final-all-tests.log`). Eleven failure names match the untouched main baseline; four were missing new-helper references in the extracted handoff test fixture. That fixture was corrected and the whole handoff suite9/9 then passed. No application change was made to satisfy that fixture failure.
- No simulator, backend mutation, printer operation or device installation was performed. Native component tests render symbolic platform components; they do not establish measured pixels on the user's phone.
- Final iOS/Android Hermes exports passed under `.expo/aparatchi-order-final-export`. The later standard-button correction passed111/111 focused order tests; queue indicator correction passed34/34 and both platform typechecks. A refreshed iOS bundle is under `.expo/aparatchi-order-corrected-ios`. Metro remains running for the user's real testing.

## Open items

| Where | Evidence / remaining requirement |
|---|---|
| Physical UI and hardware | The user is real-testing. Final sheet spacing/Dynamic Type, camera permissions and physical Bluetooth delivery are not claimed device-verified by this session. |
| Paddon auto-scroll native integration | The earlier optional List bridge still requires a rebuilt development binary/full ExpoUI CocoaPods build; old binaries retain manual scrolling. |
| Whole-role text scope gate | Both platforms have0 missing/0 extra lexical rows and0 ambiguous tags, but the unmodified gate still exits1 for442/445 global scope rows. The per-row audits identify other-role paths, source-exact shared labels and fixes above; unusual material/Rezka capability/deep-link eligibility remains an existing separate integration restriction. No blanket acceptance or routing redesign was added. |

## Deviation candidates

None silently introduced. Native styling follows the user's explicit request; source behavior/text remains the contract.

## Test mode pending

D3 demo coverage remains deferred under the existing project decision. USB/Wi-Fi printer choices and GoDEX remain excluded by the user's existing instruction.

## Needs from the integrator

No main merge or push was performed. The native bridge build/device checks above remain open.
