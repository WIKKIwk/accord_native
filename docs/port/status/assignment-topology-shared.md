# assignment-topology-shared

Status: an unconnected, conservative apparatus topology helper is prepared. No role route or authorization decision uses it yet.

## Open items

| Where | What is needed |
|---|---|
| Unicode canonical IDs | Non-ASCII canonical IDs are deliberately rejected until Dart and Hermes lowercase behavior is verified. V2 accepts some such IDs, including the documented U+037F case, so this helper can omit valid choices. Do not report full parity or silently treat an empty result as proof that no apparatus exists. |
| Upstream map/profile parsing | The helper's own trim and ASCII cases are tested, but the native map and account decoders may normalize values differently from Dart. Audit the complete input path before a role consumes it. |
| Authorization and session | This pure candidate filter is not a backend authorization boundary. A future caller must use current account assignments and enforce role, capability, session and scope at reads and mutations. No caller is connected here. |
| Native verification | The tests run in Node against synthetic graphs and a Dart VM oracle. Hermes, native rendering and a real device remain unverified. |

## Checkpoint

The helper follows the f119 reachable-node, condition and alternative-group traversal needed by raw-material assignment, intersects it with assigned canonical IDs, and returns a frozen result. The shared trim utility reproduces the 26 Dart whitespace scalars recorded by the isolated Dart 3.13.7 oracle. It reuses the existing Worker canonical-ID validator only after conservative ASCII filtering; that Worker file and all Worker/Preparation callers remain unchanged.

An independent review identified and verified the U+0085 group/branch discrepancy in an earlier candidate. The current version matches those oracle cases and 3,500 seeded ASCII topology cases; it intentionally rejects unverified non-ASCII canonical IDs. The fixtures are synthetic Dart outputs, not network recordings.

## Verification

- Seventeen focused Node cases passed, including U+0085, immutable output, conservative Unicode rejection and hash-verified replay of 3,500 synthetic graphs. The isolated f119 V2 `production_map_chain_test.dart` had 22/22 passing tests.
- The full Node suite had 1,234 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker TypeScript errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
