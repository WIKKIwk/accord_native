// Standalone source-equivalent response projection from f119 batch review.
// It performs no mutation, activity write, refresh, navigation, Flutter,
// backend, sqlite or device operation.
import 'dart:convert';

typedef Record = Map<String, Object?>;
Record issue(String id, String code, double quantity) => {
  'entryID': id, 'customerRef': 'C$id', 'customerName': 'Customer $id', 'itemCode': code,
  'itemName': 'Item $id', 'uom': 'kg', 'qty': quantity, 'createdLabel': 'time $id',
};
Record dispatch(Record record) => {
  'id': record['entryID'], 'record_type': '', 'supplier_ref': record['customerRef'], 'supplier_name': record['customerName'],
  'item_code': record['itemCode'], 'item_name': record['itemName'], 'uom': record['uom'], 'sent_qty': record['qty'],
  'accepted_qty': 0, 'amount': 0, 'currency': '', 'note': '', 'event_type': 'customer_issue_pending',
  'highlight': '', 'status': 'pending', 'created_label': record['createdLabel'],
};
Map<String, Object?> describe(int lineCount, List<Record?> created, List<int> failed) {
  final failureSet = failed.toSet();
  final indices = <int>[for (var i = 0; i < lineCount; i++) if (failureSet.contains(i)) i];
  final activity = created.map((record) => record?['itemCode'] as String? ?? '').where((item) => item.trim().isNotEmpty).toList();
  return {'sourceCreatedCount': created.length, 'sourceFailedIndices': indices, 'sourceActivityCodes': activity,
    'sourcePendingRecords': [for (final record in created) if (record != null) dispatch(record)],
    'sourceBranch': indices.isEmpty ? 'success' : 'partial'};
}
void main() {
  final definitions = <Map<String, Object?>>[
    {'name': 'empty', 'lineCount': 0, 'created': <Record?>[], 'failed': <int>[]},
    {'name': 'mixed duplicates', 'lineCount': 4, 'created': <Record?>[issue('1', ' A ', 2.5), null, issue('2', '\u0085', 1), issue('3', 'B', 4)],
      'failed': <int>[3, 1, 3, -1, 99]},
    {'name': 'out of range failures', 'lineCount': 2, 'created': <Record?>[null], 'failed': <int>[2, -1, 99]},
    {'name': 'all failed in input order', 'lineCount': 3, 'created': <Record?>[], 'failed': <int>[2, 0, 1]},
    {'name': 'duplicate activity codes', 'lineCount': 2, 'created': <Record?>[issue('4', 'X', 1), issue('5', 'X', 2)], 'failed': <int>[]},
  ];
  final cases = <Map<String, Object?>>[];
  for (final entry in definitions) {
    final count = entry['lineCount'] as int, created = entry['created'] as List<Record?>, failed = entry['failed'] as List<int>;
    cases.add({...entry, 'expected': describe(count, created, failed)});
  }
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'sourceSha256': 'b3a9ba63836be0a119cb0d01c969b8d0e07ca72565c175bd5072c15064898d3d',
    'kind': 'standalone source-equivalent batch result projection; not Flutter or device', 'cases': cases}));
}
