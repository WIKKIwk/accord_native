# apparatus-maps

Status: shared canonical map lookups prepared; Admin options wiring remains open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Admin apparatus options | `_adminApparatusFamilyForOperation`, `_adminApparatusKindForTechnology` | Admin must apply V2-compatible trimming/lowercasing before calling the new normalized-key helpers and separately implement V2's technology-to-operation rule. Arbitrary capability strings have broader Dart/JS Unicode lowercase differences and are not resolved here. |
| Existing projection edge | `apparatusFromJson` | Existing Worker/Preparation callers keep their old JavaScript bracket lookup, including inherited-property behavior for unusual keys such as `constructor` and `__proto__`. The new helpers use own-property checks and return V2's `other` for those keys. This checkpoint does not silently change the old projection behavior. |
| Native verification | apparatus catalog | The checkpoint changes no role routing or UI. The new helpers use `Object.hasOwn`; real Hermes/device behavior remains unverified. |

## Checkpoint

The two map literals formerly local to `apparatusFromJson` are now private module-level constants, still used by the existing projection with the same trim, lowercase and bracket lookup. The new exported helpers share those constants but require caller-normalized keys and use safe own-property fallback. No Worker or Preparation source or call site was changed.

Three mocked cases cover every mapping, unknown and inherited-property keys, the original projection's normalization/fallback and its legacy edge behavior. Five existing apparatus API tests also pass. No backend or phone was used.

## Verification

- Three standalone map/projection regression cases and five existing apparatus API cases passed.
- The full Node suite had 1,193 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
