// Dart 3.13.7 String.trim behavior, all Unicode scalar values. No Flutter,
// app, network, sqlite or device is used.
import 'dart:convert';

void main() {
  final trimmed = <int>[];
  var count = 0;
  for (var i = 0; i <= 0x10ffff; i++) {
    if (i >= 0xd800 && i <= 0xdfff) continue;
    count++;
    final char = String.fromCharCode(i);
    if ('$char\u0078$char'.trim() == 'x') trimmed.add(i);
  }
  print(const JsonEncoder.withIndent('  ').convert({'kind': 'standalone Dart 3.13.7 scalar trim probe',
    'scalarCount': count, 'trimmed': trimmed}));
}
