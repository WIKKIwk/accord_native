// Reads declared Flutter 3.47.8 generated Material source data, without
// executing Flutter, sqlite, the app or a device. Set FLUTTER_ROOT to the
// read-only SDK checkout at the revision below before regenerating.
import 'dart:convert';
import 'dart:io';

void main() {
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root == null || root.isEmpty) throw StateError('FLUTTER_ROOT is required');
  final source = File('$root/packages/flutter_localizations/lib/src/l10n/generated_material_localizations.dart').readAsStringSync();
  final values = <String, String>{};
  for (final entry in {'uz': 'Uz', 'en': 'En', 'ru': 'Ru', 'ur-PK': 'Ur'}.entries) {
    final start = source.indexOf('class MaterialLocalization${entry.value} extends GlobalMaterialLocalizations');
    if (start < 0) throw StateError('Missing Material locale ${entry.value}');
    final next = source.indexOf('\nclass MaterialLocalization', start + 1);
    final block = source.substring(start, next < 0 ? source.length : next);
    final match = RegExp(r"String get deleteButtonTooltip => '([^']*)';").firstMatch(block);
    if (match == null) throw StateError('Missing delete tooltip ${entry.value}');
    values[entry.key] = match.group(1)!;
  }
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'flutterRevision': '737ba8f885dc774b53b442759999a312c9461e4e', 'flutterVersion': '3.47.8',
    'materialStringsSha256': 'dfe987456b1757657ce10123f1c7488eabcf43495983ea5b6241e62f168522a6',
    'kind': 'declared SDK generated source data, not Flutter or device', 'values': values}));
}
