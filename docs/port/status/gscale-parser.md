# gscale-parser

Status: shared warehouse decoder extraction prepared; Admin create wiring and device verification remain open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Admin warehouse creation | `adminCreateWarehouse`, `AdminWarehouse.fromJson` | The Admin role still needs to connect its create request to this decoder and test its own flow. This extraction does not add or expose that action. |
| Native GScale | `adminWarehouses`, GScale role | This is a parser-only change. Real-device, scale and printer behavior remains as recorded in the existing GScale status. |

## Checkpoint

`adminWarehouseFromJson` extracts the existing inline callback from `adminWarehouses` without changing its field expressions, fallback order, boolean test or surrounding request. The existing list reader calls the exported function; Admin can reuse it for a single warehouse instead of duplicating a decoder. No Worker or Preparation source or role routing was changed.

The standalone mocked tests cover every field, empty and null defaults, parent precedence, non-boolean group values, invalid shapes and invalid field types. Existing GScale API tests also pass. These are source-derived cases, not device or backend tests.

## Verification

- Three standalone warehouse-decoder tests and the three existing GScale API tests passed.
- The full Node suite had 1,178 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
