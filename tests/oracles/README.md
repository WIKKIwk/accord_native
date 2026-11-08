# Homashyo f119 barcode oracle

`homashyoBarcodeOracle.dart` contains the source-equivalent `rawMaterialBarcodeFromQr`
from the pinned f119 Flutter source. The input generator includes 500 cases with seed
`0xabcdef`, fixed URI cases and whitespace cases. The recorded output lives in
`tests/contracts/f11910bb/homashyo_barcode_oracle.json`; no historical fixture is replaced.

From the native worktree only, with the matching Dart SDK on PATH:

```sh
node tests/oracles/generateHomashyoBarcodeInputs.cjs > .expo/homashyo-barcode-inputs.json
dart tests/oracles/homashyoBarcodeOracle.dart .expo/homashyo-barcode-inputs.json > .expo/homashyo-barcode-results.jsonl
node -e "const f=require('./tests/contracts/f11910bb/homashyo_barcode_oracle.json'); const r=require('fs').readFileSync('.expo/homashyo-barcode-results.jsonl','utf8').trim().split('\\n').map(JSON.parse); require('assert').deepStrictEqual(r,f.cases); console.log(r.length+' source cases reproduced')"
node --test tests/homashyoBarcode.test.cjs
```

Do not run this in the original V2 checkout. The adapter currently has one recorded
mismatch for an invalid percent-encoded host and does not claim full URI, Unicode or
Hermes/device equivalence. Homashyo input and write routes remain closed.
