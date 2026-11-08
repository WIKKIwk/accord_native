# raw-stock-parser

Status: reusable stock decoder extraction prepared; Admin wiring and real-printer checks remain open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Admin raw-material stock | `AdminRawMaterialStockEntry.fromJson` and Admin stock APIs | The Admin role still needs to connect its own list/update requests and compare malformed and boundary payloads. The decoder preserves the existing native reprint semantics; it does not by itself complete those APIs. |
| JSON string conversion | `AdminRawMaterialStockEntry.fromJson` | Existing native code uses JavaScript `String(value)` for text fields; Dart `toString()` differs for lists and maps. This extraction intentionally preserves the old reprint behavior and does not claim parity for such values. |
| Extreme JSON numbers | `AdminRawMaterialStockEntry.fromJson` | JavaScript and Dart decoding and conversion at very large numeric boundaries have not been compared; mocked cases do not prove parity there. |
| Reprint and hardware | `adminPrepareRawMaterialStockReprint` | Existing Preparation/GScale reprint calls and Worker print-job parser remain in use. Printer and phone behavior remain unverified by this parser-only checkpoint. |

## Checkpoint

`rawMaterialStockFromJson` extracts the existing stock object literal from `adminPrepareRawMaterialStockReprint`. The old null-stock fallback, validation order (stock object, print object, then record fields), field expressions, request, and print-job parsing remain unchanged for ordinary JSON. No Worker or Preparation source or role route was changed. Admin can reuse the exported decoder without creating a second copy.

Four focused mocked cases cover all fields/defaults, legacy JS coercion, numeric validation, null fallback and validation order; three existing print API tests also pass. No backend, printer or phone was used.

## Verification

- Four standalone stock/reprint regression cases and three existing print API cases passed.
- The full Node suite had 1,190 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
