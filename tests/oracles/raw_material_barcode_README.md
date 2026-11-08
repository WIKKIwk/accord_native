# f119 raw-material barcode oracle

`rawMaterialBarcodeFromQr` is sourced from
`lib/src/features/admin/presentation/raw_material_scan_dialog_widgets_part_01.dart:24-47`
at `f11910bb2c8c7081ce26770e69811b03fd0739ed`. The corpus generator names each seed
and produces 88,664 cases. The small f119 JSON fixture records source-output digests,
counts, and human-readable samples; the old Homashyo fixture is not overwritten.

From the native worktree, with Node LTS on PATH and the matching Dart SDK installed:

```sh
tests/oracles/reproduceRawMaterialBarcode.sh
node --test tests/sharedRawMaterialBarcode.test.cjs
```

The first command verifies that the original V2 checkout is clean and pinned, exports
only the source file to a fresh worktree-local temporary folder, and executes the
source-equivalent standalone Dart program with a temporary HOME. It does not run
Flutter, pub, or a network operation. Set `ACCORD_V2`, `DART_BIN` or `NODE_BIN` if
needed. Raw JSONL source outputs remain in the printed temporary directory for a
case-by-case comparison if a digest fails.

This is a finite Node-versus-Dart corpus, not a claim of exhaustive URI/Unicode or
Hermes/device parity. Scanner, lookup, stock-write and role routes remain held until
those and the other documented safety checks are resolved.
