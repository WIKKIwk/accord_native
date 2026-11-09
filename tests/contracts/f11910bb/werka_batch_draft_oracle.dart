// Standalone source-equivalent batch draft validation/visibility probe for
// f119. Run from the V4 project root with Dart 3.13.7. No Flutter, backend,
// sqlite, picker, draft mutation, route or device is used.
import 'dart:convert';
import 'dart:io';

void main() {
  final input = jsonDecode(File('tests/contracts/f11910bb/werka_unannounced_input_oracle.json').readAsStringSync()) as Map<String, dynamic>;
  final values = <Map<String, Object?>>[];
  for (final sample in input['cases'] as List<dynamic>) {
    final raw = (sample as Map<String, dynamic>)['input'] as String;
    final parsed = double.tryParse(raw.trim()) ?? 0;
    values.add({'input': raw, 'positive': parsed > 0});
  }
  final matrix = <Map<String, Object?>>[];
  for (final customer in [false, true]) for (final item in [false, true]) for (final drafts in [0, 1, 2]) {
    for (final raw in ['0', '1.5', 'NaN', 'Infinity', '\u0085 2 \u0085']) for (final phone in ['\u0085', ' +998 ']) {
      final quantity = double.tryParse(raw.trim()) ?? 0;
      final current = customer && item && quantity > 0, saved = drafts > 0;
      matrix.add({'customer': customer, 'item': item, 'drafts': drafts, 'quantityText': raw, 'phone': phone,
        'valid': current, 'showPhone': customer && !item && phone.trim().isNotEmpty, 'showQuantity': item,
        'showList': saved, 'canSave': current, 'canConfirmReview': saved && (current || drafts >= 2)});
    }
  }
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'screenSha256': 'c93935e4e76914ad393ec76398b5ea3407d4058d358a107d04d45ce65d6d116f',
    'methodsSha256': '4ea0b28f1beb735786e5873133624edfb7ca5cea9f05299c5d84462dd38cbc56',
    'kind': 'standalone source-equivalent batch draft probe; not Flutter or device', 'values': values, 'matrix': matrix}));
}
