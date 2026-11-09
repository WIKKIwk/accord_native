// Standalone source-equivalent f119 parseCreatedLabelTimestamp probe. It
// launches only this Dart script in four TZ environments, never Flutter,
// sqlite, the app, a backend or a device. Regenerate from the project root
// with Dart 3.13.7 on the documented macOS timezone database.
import 'dart:convert';
import 'dart:io';

DateTime? parseSource(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  final dateOnly = RegExp(r'^\d{4}-\d{2}-\d{2}$');
  final dateTimeWithSpace = RegExp(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}');
  var normalized = trimmed;
  if (dateOnly.hasMatch(trimmed)) {
    normalized = '${trimmed}T00:00:00';
  } else if (dateTimeWithSpace.hasMatch(trimmed)) {
    normalized = trimmed.replaceFirst(' ', 'T');
  }
  return DateTime.tryParse(normalized);
}

List<String> labels() {
  final result = <String>{};
  final years = ['0000', '0001', '0050', '0099', '1582', '1900', '1969', '1999', '2020', '2024', '2026', '9999', '+010000', '-000001'];
  final months = ['00', '01', '02', '03', '04', '11', '12', '13'], days = ['00', '01', '02', '28', '29', '30', '31', '32'];
  final times = ['', 'T00:00:00', 'T23:59:59.999999Z', ' 01:30:00-05:00', 'T02:30:00', 'T23:59:59+14:00'];
  for (final year in years) for (final month in months) for (final day in days) for (final time in times) {
    if ((int.parse(month) * 37 + int.parse(day) * 13 + year.length * 7 + time.length) % 11 == 0) {
      result.add('$year-$month-$day$time');
    }
  }
  result.addAll(['2024-03-10T02:30:00', '2024-11-03T01:30:00', '2011-12-30T00:00:00', '2027-04-30T00:30:00',
    '2026-01-01T00:00:00Z', '2026-01-01T00:30:00+05:00', '2026-02-30', '20200101', '20200101T123456.123456Z',
    '2020-01-01T01Z', '2020-01-01T01+05', '2020-01-01T01+0530', '2020-01-01T01+05:30', '2020-01-01T24:00:00',
    '2020-01-01 00:00:00.999999-00:30', 'not date', '', '\u00852026-03-02\u0085',
    '\u0085 2026-01-01T00:30:00+05:00 \u0085']);
  return result.toList();
}

// WerkaArchiveResponse.fromJson calls DateTime.tryParse on its raw string,
// unlike parseCreatedLabelTimestamp above, which first trims.
List<String> rawLabels() => [
  '2026-05-01', ' 2026-05-01', '2026-05-01 ', ' 2026-05-01 ',
  '\u00852026-05-01\u0085', '\ufeff2026-05-01\ufeff', '\t2026-05-01\n',
  '2026-01-01T01:00:00 Z', '2026-01-01T01:00:00 ',
  '2026-01-01T00:30:00+05:00', '2026-01-01T00:30:00-05:00',
  '2026-02-30', '20200101', '20200101T123456.123456Z',
  '1969-12-31T23:59:59.999999Z', '2024-03-10T02:30:00',
  '2024-11-03T01:30:00', '2011-12-30T00:00:00',
  '2027-04-30T00:30:00', '', 'not date',
];

void main(List<String> arguments) {
  final input = labels();
  if (arguments.contains('--child')) {
    print(jsonEncode({
      'markers': [for (final label in input) () {
        final date = parseSource(label);
        return date == null ? null : {'year': date.year, 'month': date.month, 'day': date.day};
      }()],
      'raw': [for (final label in rawLabels()) DateTime.tryParse(label)?.millisecondsSinceEpoch],
    }));
    return;
  }
  final zones = <String, Object?>{};
  final rawZones = <String, Object?>{};
  for (final zone in ['Asia/Tashkent', 'America/New_York', 'Africa/Cairo', 'Pacific/Apia']) {
    final child = Process.runSync(Platform.resolvedExecutable, [Platform.script.toFilePath(), '--child'],
      environment: {'TZ': zone}, includeParentEnvironment: true);
    if (child.exitCode != 0) throw StateError('Dart timezone probe failed: $zone ${child.stderr}');
    final result = jsonDecode(child.stdout as String) as Map<String, dynamic>;
    zones[zone] = result['markers'];
    rawZones[zone] = result['raw'];
  }
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'sourceSha256': 'ba80d655c165502b4d5a63952346d68494fbd83f52c0657b745433e95696319e',
    'responseSourceSha256': '82d03b403c4f6757c32b43d6ffe297545b1f6ffd6e73b4ab1d7ab2974183a8ef',
    'kind': 'standalone Dart 3.13.7 source-equivalent calendar fields on macOS timezone data; not Flutter or device',
    'labels': input, 'zones': zones, 'rawLabels': rawLabels(), 'rawZones': rawZones}));
}
