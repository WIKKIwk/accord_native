// Standalone source-equivalent data probe, not a Flutter/widget/device test.
// Uses only the declared Flutter date-data loader and locked intl 0.20.3.
// It does not launch Flutter, V2, sqlite3, native asset hooks or a backend.
import 'dart:convert';
import 'package:intl/intl.dart' as intl;
import 'package:flutter_localizations/src/utils/date_localizations.dart' as dates;

void main() {
  dates.loadDateIntlDataIfNotLoaded();
  final locales = <String, Object?>{};
  for (final entry in {'uz': 'uz', 'en': 'en', 'ru': 'ru', 'ur-PK': 'ur_PK'}.entries) {
    final dateLocale = intl.DateFormat.localeExists(entry.value)
        ? entry.value : entry.value.split('_').first;
    final numberLocale = intl.NumberFormat.localeExists(entry.value)
        ? entry.value : entry.value.split('_').first;
    final long = intl.DateFormat.yMMMMEEEEd(dateLocale);
    final year = intl.DateFormat.y(dateLocale);
    final decimal = intl.NumberFormat.decimalPattern(numberLocale);
    final samples = <Map<String, Object?>>[];
    void add(DateTime date) {
      samples.add({'year': date.year, 'month': date.month, 'day': date.day,
        'fullDate': long.format(date), 'yearLabel': year.format(date)});
    }
    for (var month = 1; month <= 12; month++) {
      for (var day = 22; day <= 28; day++) {
        add(DateTime(2024, month, day));
      }
    }
    for (final year in [-5, 0, 1, 50, 99, 100, 1900, 2024, 2026, 9999, 10000]) {
      for (final month in [1, 2, 12]) {
        add(DateTime(year, month, month == 2 ? 28 : 1));
      }
    }
    add(DateTime(2024, 2, 29));
    locales[entry.key] = {
      'dateLocale': dateLocale, 'numberLocale': numberLocale,
      'firstDayOfWeekIndex': (long.dateSymbols.FIRSTDAYOFWEEK + 1) % 7,
      'narrowWeekdays': long.dateSymbols.NARROWWEEKDAYS,
      'weekdays': long.dateSymbols.WEEKDAYS, 'months': long.dateSymbols.MONTHS,
      'fullDatePattern': long.pattern,
      'decimals': [for (var number = 0; number <= 31; number++) decimal.format(number)],
      'decimalSamples': [for (final number in [-1000000, -1000, -31, -1, 0, 1, 9, 10, 31, 999, 1000, 10000, 1000000, 123456789])
        {'number': number, 'formatted': decimal.format(number)}],
      'samples': samples,
    };
  }
  print(const JsonEncoder.withIndent('  ').convert({
    'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'kind': 'standalone source-equivalent locale data, not Flutter or device',
    'flutterRevision': '737ba8f885dc774b53b442759999a312c9461e4e',
    'flutterVersion': '3.47.8', 'intlVersion': '0.20.3',
    'dateDataSha256': '6dbcf772b367b3c993008b3267d63c38eccd4039b476dadf33753fe888401526',
    'materialLocalizationsSha256': '3971b1b90d5d047261a57d547f9f0ff072282ab3f53a1d76fecf671decf59e8b',
    'materialStringsSha256': 'dfe987456b1757657ce10123f1c7488eabcf43495983ea5b6241e62f168522a6',
    'intlDateFormatSha256': 'dbd8281cf20bec610323692e637cf81716275231effe993c82d7a01a89ebc1b3',
    'intlNumberFormatSha256': 'afcbde1a551503bdc9edda251a865eb9bada8c9367823c38596b28d4c2c92040',
    'locales': locales,
  }));
}
