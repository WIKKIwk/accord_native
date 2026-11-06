# preparation-ios

Status: in progress
Stopped at: implement order variants, production journal and preparation sequence; finish shared navigation wiring.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Scale entry | `preparation_screen.dart`, `preparation_order_formula_screen.dart` | The GScale receipt screen/route is not present; connect warehouse scale actions and production start after the shared route is supplied. |
| Navigation | `preparation_navigation.dart` | Complete the drawer destinations and shared inventory/chat routes when their platform entry points are available. |

## Deviations candidates

## Test mode pending

## Needs from the integrator

- Add the iOS preparation home target to `src/shared/appRoutes.ts` and connect the platform route from app startup.
- Connect the preparation scale receipt, shared inventory-movements route, printer selection and transport, and the shared order-detail presentation; these are outside this session's scope.
- Provide the shared apparatus selection store, warm-store startup, and `searchMatches` matcher recorded in `docs/port/status/preparation.md`.
