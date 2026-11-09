import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('report Dart whitespace and non-ASCII lowercase to ASCII', () {
    final trimmed = <int>[],
        whitespace = <int>[],
        asciiLower = <List<Object>>[];
    final pattern = RegExp(r'\s'), ascii = RegExp(r'^[a-z0-9]+$');
    for (var i = 0; i <= 0x10ffff; i++) {
      if (i >= 0xd800 && i <= 0xdfff) continue;
      final value = String.fromCharCode(i);
      if (value.trim().isEmpty) trimmed.add(i);
      if (pattern.hasMatch(value)) whitespace.add(i);
      final lower = value.toLowerCase();
      if (i > 127 && ascii.hasMatch(lower)) asciiLower.add([i, lower]);
    }
    print(
      'MATERIAL_UNICODE_ORACLE=${jsonEncode({'trim': trimmed, 'regexWhitespace': whitespace, 'nonAsciiToAscii': asciiLower})}',
    );
  });
}
