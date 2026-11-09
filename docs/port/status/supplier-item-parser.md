# supplier-item-parser

Status: shared SupplierItem decoder export prepared; Werka/Supplier wiring remains open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Werka/Supplier catalog | `SupplierItem.fromJson` | New role APIs still need to call this existing decoder, wire their own routes and compare responses. This export alone does not complete those roles. |
| Unicode and string conversion | `SupplierItem.fromJson` | Existing native `String(value)` and JavaScript `trim()` differ from Dart for some list/map values and U+0085 at string edges. Preserve existing GScale behavior until a separately reviewed parity change is possible. |
| Malformed input order | `SupplierItem.fromJson` | The native decoder checks option maps and fields in a different order from V2's constructor for multiply-invalid input. Compare error behavior before claiming full parity. |
| Native verification | GScale catalog | This is an export-only change and has not been exercised on a phone. |

## Checkpoint

`src/shared/catalogApi.ts` is byte-identical to Supplier checkpoint `a947a1a` for this extraction. The existing private `supplierItem` parser is exported as `supplierItemFromJson`, and the existing GScale reader calls that same function; field expressions, search ordering, request and response behavior are unchanged for ordinary JSON. No Worker or Preparation source or role route was changed.

Three standalone mocked cases cover all fields, null/default values, legacy conversions, inherited-property-safe option creation, bad types, validation order and the existing reader. Three existing catalog API cases also pass. No backend or phone was used.

## Verification

- Three standalone SupplierItem/GScale regression cases and three existing catalog API cases passed.
- The full Node suite had 1,196 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
