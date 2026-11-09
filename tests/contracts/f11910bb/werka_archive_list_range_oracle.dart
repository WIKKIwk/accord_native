// Standalone source-equivalent DateTime probe, not Flutter, V2 app, sqlite3 or device.
// Run once per TZ; this matches _lastDayOfMonth in the selected V2 source.
import 'dart:convert';
import 'dart:io';

List<int> fields(DateTime value) => [value.year, value.month, value.day, value.hour, value.minute];

void main() {
  final cases = <Map<String, Object>>[];
  for (final entry in [(2024, 2), (2024, 10), (2026, 11), (2027, 4), (2027, 12), (5, 2)]) {
    final first = DateTime(entry.$1, entry.$2, 1);
    final last = DateTime(entry.$1, entry.$2 + 1, 1).subtract(const Duration(days: 1));
    cases.add({'year': entry.$1, 'month': entry.$2, 'from': fields(first), 'to': fields(last)});
  }
  print(const JsonEncoder.withIndent('  ').convert({
    'timezone': Platform.environment['TZ'] ?? '', 'cases': cases,
  }));
}
