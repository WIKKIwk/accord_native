# dispatch-parser

Status: shared parser extraction in progress; role and notification routes remain separate.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Dispatch status edge cases | `parseDispatchStatus`, `DispatchRecord.fromJson` | This extraction deliberately retains the existing native notification parser's JavaScript trim/lowercase behavior. Dart handles U+0085 at string edges and U+0130 lowercase differently; for example, the native parser maps `\u0085ACCEPTED\u0085` to pending while V2 maps it to accepted. Resolve the difference without silently changing existing notification behavior. |
| Malformed record validation order | `DispatchRecord.fromJson` | The extracted function keeps the old native detail parser's status-first validation, while V2 reads the record fields in declaration order. Compare malformed payload/error behavior before claiming full parser parity. |
| Account changes and notification routes | Supplier and Customer role status files | This extraction does not connect or clear any notification store, action or screen. Separate account-switch and Chat transport holds remain open. |

## Checkpoint

`dispatchRecordFromJson` is the byte-identical `src/shared/notificationApi.ts` extraction in Supplier checkpoint `a947a1a` and Customer checkpoint `e95aed7`. It exports the existing parser for reuse rather than adding a second implementation. Existing notification HTTP request and response behavior is preserved for ordinary JSON inputs; no protected Worker or Preparation file or role routing was changed. The Unicode and malformed-input differences above are not claimed complete.

`tests/dispatchRecordParser.test.cjs` derives from Supplier checkpoint `898706e`, with an additional regression for the existing status-trim and error-precedence behavior. The tests use mocked JSON, not a backend or a device.

## Verification

- Four standalone parser/detail tests and eight existing notification API/runtime/store tests passed. The new tests cover all record fields, defaults, types, status values, ordinary detail parsing and legacy validation order.
- The full Node suite had 1,175 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
