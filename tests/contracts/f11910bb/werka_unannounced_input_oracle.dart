// Network-free, standalone source-equivalent samples of f119's trimmed
// double.tryParse, qty <= 0 and confirmation toStringAsFixed(0). This is not a
// Flutter widget test. Run this script in a clean f119 temporary export.
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

String bits(double value) {
  if (value.isNaN) return 'NaN';
  final bytes = ByteData(8)..setFloat64(0, value, Endian.big);
  return List.generate(8, (i) => bytes.getUint8(i).toRadixString(16).padLeft(2, '0')).join();
}

void main() {
  final inputs = <String>[
    '', ' ', '0', '-0', '+0', '1', '1.', '.5', '-.5', '+.5', '1e3', '1E-3',
    '1e+3', '1e', '1e+', '.', '+', '--1', '1.2.3', '1,2', '0x10', '1_000',
    'NaN', '+NaN', '-NaN', 'nan', 'Infinity', '+Infinity', '-Infinity', 'infinity',
    '  1.25  ', '\u00851\u0085', '\ufeff1\ufeff', '\u200b1\u200b', '∞', '١',
    '1e-9999', '-1e-9999', '1e9999', '-1e9999', '5e-324', '2.4703282292062327e-324',
    '1e21', '999999999999999999999', '1.5', '2.5', '0.49999999999999994',
  ];
  final random = Random(0x11910bb);
  for (var i = 0; i < 256; i++) {
    final sign = ['', '+', '-'][random.nextInt(3)];
    final before = random.nextInt(1000000000).toString();
    final after = random.nextInt(1000000000).toString().padLeft(9, '0');
    final exponent = random.nextInt(700) - 350;
    inputs.add('$sign$before.${after}e$exponent');
  }
  final cases = inputs.map((input) {
    final trimmed = input.trim();
    final parsed = double.tryParse(trimmed);
    final qty = parsed ?? 0.0;
    final valid = !(qty <= 0);
    return {'input': input, 'trimmed': trimmed, 'parsedBits': parsed == null ? null : bits(parsed),
      'validationPassed': valid, 'confirmationQuantity': valid ? '${qty.toStringAsFixed(0)} kg' : null};
  }).toList();
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'kind': 'standalone source-equivalent, not Flutter or device', 'seed': 0x11910bb, 'cases': cases}));
}
