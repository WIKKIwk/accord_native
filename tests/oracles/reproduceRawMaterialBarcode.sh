#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
SOURCE=${ACCORD_V2:-"$ROOT/../accord_mobile_v2"}
SHA=f11910bb2c8c7081ce26770e69811b03fd0739ed
SOURCE_FILE=lib/src/features/admin/presentation/raw_material_scan_dialog_widgets_part_01.dart
DART_BIN=${DART_BIN:-"$HOME/develop/flutter/bin/cache/dart-sdk/bin/dart"}
NODE_BIN=${NODE_BIN:-node}

[ "$(git --no-optional-locks -C "$SOURCE" rev-parse HEAD)" = "$SHA" ] || { echo 'V2 checkout is not at f119.' >&2; exit 1; }
[ -z "$(git --no-optional-locks -C "$SOURCE" status --porcelain=v1)" ] || { echo 'V2 checkout is not clean.' >&2; exit 1; }
mkdir -p "$ROOT/.expo"
WORK=$(mktemp -d "$ROOT/.expo/raw-material-barcode-oracle.XXXXXX")
mkdir -p "$WORK/export" "$WORK/home"
git --no-optional-locks -C "$SOURCE" archive "$SHA" "$SOURCE_FILE" | tar -x -C "$WORK/export"
python3 - "$WORK/export/$SOURCE_FILE" "$WORK/export/oracle.dart" <<'PY'
from pathlib import Path
import sys
lines = Path(sys.argv[1]).read_text().splitlines()
source = '\n'.join(lines[23:47])
assert source.startswith('String rawMaterialBarcodeFromQr(String raw) {') and source.endswith('}')
Path(sys.argv[2]).write_text("import 'dart:convert';\nimport 'dart:io';\n\n" + source + "\n\nvoid main(List<String> args) { final values = jsonDecode(File(args.single).readAsStringSync()) as List; for (final raw in values) { try { print(jsonEncode({'raw': raw, 'value': rawMaterialBarcodeFromQr(raw as String)})); } catch (e) { print(jsonEncode({'raw': raw, 'error': e.runtimeType.toString()})); } } }\n")
PY

for name in expanded deep ipv6 ascii unicode schemes dotPort; do
  "$NODE_BIN" "$ROOT/tests/oracles/generateRawMaterialBarcodeCorpus.cjs" "$name" > "$WORK/export/$name-inputs.json"
  (cd "$WORK/export" && HOME="$WORK/home" CI=1 DART_SUPPRESS_ANALYTICS=true FLUTTER_SUPPRESS_ANALYTICS=true \
    "$DART_BIN" oracle.dart "$name-inputs.json" > "$name-results.jsonl")
done
"$NODE_BIN" - "$ROOT/tests/contracts/f11910bb/raw_material_barcode_shared_oracle.json" "$WORK/export" <<'NODE'
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const fixture = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), dir = process.argv[3];
for (const [name, expected] of Object.entries(fixture.datasets)) {
  const rows = fs.readFileSync(path.join(dir, `${name}-results.jsonl`), 'utf8').trim().split('\n').map(JSON.parse);
  const digest = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  assert.equal(rows.length, expected.count); assert.equal(digest, expected.sha256, `${name}: source oracle changed`);
  console.log(`${name}: ${rows.length} source cases reproduced`);
}
NODE
printf 'Oracle files: %s\n' "$WORK/export"
