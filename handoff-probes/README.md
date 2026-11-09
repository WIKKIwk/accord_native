# Synthetic port handoff probes

These probes were originally copied byte for byte from three local port-review probes. The Qolip CJS harness now uses the existing Expo fetch host adapter and labels its historical-auth cases explicitly; the original hash below records provenance, not the adapted file checksum. This is an archival branch based on original Qolipchi commit `1b0385e5f4cf5359fccf03658fbeb1810ad7f896`; it is not a request to merge the incomplete Qolipchi work into main. The probes use synthetic inputs and mocked transports. They are not device, backend, security, or production-readiness certification.

## Contents and provenance

- `qolip-settled-main-current-probe.cjs`: copied from the Qolipchi worktree's `.port/qolip-settled-main-current-probe.cjs` (SHA-256 `3bbbbf45dd67cd4899b703b28cf62457c41b065f3fb69ef089d3c39cf3fe8931`). Six mocked integration tests exercise the original Qolipchi implementation against historical `src/auth.ts` from commit `21aa4a10963580c6c7ed1cb80f8536bbe6f1f711`, covering transition invalidation and delayed reads. That auth commit must exist in the local Git object store. The harness depends on the checked-out Qolipchi source at this branch's base; it does not test newer main code or a real backend.
- `stale-transfer-response.cjs`: copied from the admin worktree's `.port/transfer-review/stale-response.cjs` (SHA-256 `ea69078fd1e83c4f510680c7c07f30d2b5333ad028c8c15d6ea953bfb455f7c0`). A mocked transfer response and acknowledgement complete after a simulated account switch. This is a diagnostic observation, not proof of a live exploit or that one account's command can affect another. At the main snapshot reviewed, no production source caller of the API was found.
- `dart-lower-context.dart`: copied from the admin worktree's `.port/dart-lower-context.dart` (SHA-256 `d68253153ffd646a786f219c603aabf3ca0025eeec5d1173aafeeab253b7d981`). Exhaustively compares contextual and per-scalar Dart lowercase behavior, including unpaired surrogates. Unicode behavior can vary with the Dart SDK version.

## Reproduce

Run from the root of this branch with Node.js 24 and the project's TypeScript dependency installed. If dependencies are shared from another checkout, set `NODE_PATH` to that checkout's `node_modules` directory.

    node --test handoff-probes/qolip-settled-main-current-probe.cjs
    node handoff-probes/stale-transfer-response.cjs
    dart handoff-probes/dart-lower-context.dart

In the original local check, the Qolipchi probe passed 6 of 6 tests, the transfer probe printed its mocked completion observation, and Dart reported 1,112,064 scalars with zero contextual or surrogate mismatches. No network, real credentials, or device was used.

## Integration check (2026-11-09)

Reconciled the archival branch with main `112bf8a`; the app, normal tests, tooling and configuration tree matches main. The three probe payloads remain outside the app and normal test glob. Both CJS files pass `node --check`. With the one-line Expo fetch host adaptation, all six historical-auth Qolip probes pass against the restored full-role modules. The transfer probe still prints its synthetic post-switch result/acknowledgment observation; that is a limitation to review, not a production exploit claim or a successful live transfer. No Dart process, phone, backend or real credential was used. The original incomplete Qolip merge was reconciled separately; these probes do not certify full role parity.
