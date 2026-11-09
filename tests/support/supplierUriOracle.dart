// Standalone Dart VM oracle for Supplier's V2 Uri.replace(queryParameters: ...).
// Run directly with a Dart SDK, outside the read-only V2 checkout; no backend.
import 'dart:convert';

void main() {
  final samples = <String>[
    '',
    "~*!'()",
    ' \u0085X+/%&= ',
    'café 世界 🙂',
    String.fromCharCodes(List.generate(128, (index) => index)),
    String.fromCharCodes([0xd800, 0xdc00, 0xd800, 0x41, 0xdc00]),
  ];
  print(jsonEncode([
    for (final sample in samples)
      {
        'utf16': sample.codeUnits,
        'items': Uri.parse('https://example.test/v1/mobile/supplier/items')
            .replace(queryParameters: {'q': sample}).query,
        'details': Uri.parse('https://example.test/v1/mobile/supplier/status-details')
            .replace(queryParameters: {'kind': 'returned', 'item_code': sample}).query,
      },
  ]));
}
