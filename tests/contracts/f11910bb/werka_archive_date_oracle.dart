// Standalone source-equivalent probe, not a Flutter/widget/device test.
// Run with an isolated --packages config containing only intl 0.20.3 and
// flutter_localizations from clean Flutter 737ba8f885dc774b53b442759999a312c9461e4e.
// It imports only the SDK's pure date-data loader, never Flutter's runner,
// the V2 app, sqlite3, native assets or a backend. No pub resolution is needed.
// V2 app.dart uses GlobalMaterialLocalizations; its delegate creates yMMMM and
// MMMEd formatters from this data, then formatMonthYear/formatMediumDate call
// .format(date). The archive month cells then use .split(' ').first.
import 'dart:convert';
import 'package:intl/intl.dart' as intl;
import 'package:flutter_localizations/src/utils/date_localizations.dart' as dates;

void main() {
  dates.loadDateIntlDataIfNotLoaded();
  final cases = <Map<String, Object?>>[];
  for (final entry in {'uz': 'uz', 'en': 'en', 'ru': 'ru', 'ur-PK': 'ur_PK'}.entries) {
    // This is the selected branch of GlobalMaterialLocalizations.load.
    final locale = intl.DateFormat.localeExists(entry.value)
        ? entry.value : entry.value.split('_').first;
    final monthYear = intl.DateFormat.yMMMM(locale);
    final medium = intl.DateFormat.MMMEd(locale);
    void add(DateTime date) {
      final label = monthYear.format(date);
      cases.add({'locale': entry.key, 'year': date.year, 'month': date.month,
        'day': date.day, 'monthYear': label, 'monthCell': label.split(' ').first,
        'mediumDate': medium.format(date)});
    }
    for (final year in [-5, 0, 1, 50, 99, 100, 1900, 2024, 2026, 9999, 10000]) {
      for (var month = 1; month <= 12; month++) {
        add(DateTime(year, month, 1));
      }
    }
    // All weekdays in every month, leap day, and year boundaries.
    for (var month = 1; month <= 12; month++) {
      for (var day = 22; day <= 28; day++) {
        add(DateTime(2024, month, day));
      }
    }
    for (final date in [DateTime(2024, 2, 29), DateTime(2025, 12, 31),
      DateTime(2026, 1, 1), DateTime(2026, 11, 8)]) {
      add(date);
    }
  }
  print(const JsonEncoder.withIndent('  ').convert({
    'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'kind': 'standalone source-equivalent date data, not Flutter or device',
    'flutterRevision': '737ba8f885dc774b53b442759999a312c9461e4e',
    'flutterVersion': '3.47.8', 'intlVersion': '0.20.3',
    'dateDataSha256': '6dbcf772b367b3c993008b3267d63c38eccd4039b476dadf33753fe888401526',
    'materialSha256': '3971b1b90d5d047261a57d547f9f0ff072282ab3f53a1d76fecf671decf59e8b',
    'intlDateFieldSha256': 'f7e78fb9c84f355d9560aa1f7dcb8b35d489a6ef25e60f18641ece1f4857ba61',
    'cases': cases,
  }));
}
