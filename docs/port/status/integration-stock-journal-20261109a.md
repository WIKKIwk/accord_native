# Homashyo and Boyoqchi integration checkpoint

Base: main `eae7e24`. The source branches remain intact and clean: `port/homashyo` at `dd716b6`, `port/boyoqchi` at `cad8dfc`, and `port/homashyo-journal-20261109a` at `ec40a3c`. The first two branch tips are not ancestors of main. Their role cores were integrated through `639aec4` and `38b03a6`, followed by `c5d1f22`, later Boyoqchi palette/RTL work, and the Homashyo feedback and hard-hold checkpoint ending at `21aa4a1`. Compare the source branches themselves when resuming; they were not deleted or merged wholesale.

This candidate merges the journal branch only. Its application-facing prototype is unconnected and refuses all state operations before storage access. Its other model is test-only. There is no new route, adapter, transport, printer or production import. See `homashyo-journal-20261109a.md` for the unresolved recovery, migration, authority, acknowledgment, device, and print boundaries.

## Deliberate exclusions

- The older Homashyo branch's executable stock and issue saves, retries, printer selection, print, and reprint paths are not reinstated. They lack the current hard hold and pending-state/lease checks. Durable reconciliation, independent recovery and authoritative outcome/acknowledgment remain unproven, so the current hold stays in force.
- The older Homashyo session/logout, picker lifecycle, pending checks and screens differ from the later guarded and feedback versions on main. Main's later role-specific implementations are retained rather than overwritten.
- The older Boyoqchi logout clears app-lock and switch-PIN state in parallel with logout and lacks main's transition check. Its apparatus read also lacks main's pre-send guard. The older palette and layout versions predate main's role-owned indicators, swipe and RTL refinements. Those older behaviors were not reapplied.
- Changes in shared GScale, printer, routing, authentication, profile and notification dependencies were not imported from either older branch. Those dependencies are used by protected roles and need a separate, scoped review before any change. This checkpoint changes no such files.

## Verification

The combined Homashyo and Boyoqchi test selection passed 557/557. iOS typecheck and Expo lint passed. Android typecheck reported nine existing Worker component diagnostics; these do not occur in the five journal files. All tests use mocks and no backend, native storage, phone, simulator, or printer was exercised. The hard hold and test-only nature of the journal remain in effect regardless of test results.
