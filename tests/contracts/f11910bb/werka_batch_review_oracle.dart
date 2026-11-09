// Standalone source-equivalent probe of batch-review display and deletion
// from f119. No Flutter, network, mutation, sqlite or device is used.
import 'dart:convert';
import 'dart:math';

typedef Row = Map<String, String>;
double qty(String value) => switch (value) {
  'nan' => double.nan, 'inf' => double.infinity, '-inf' => double.negativeInfinity, _ => double.parse(value),
};
Row row(String localID, String ref, String customer, String code, String item, String uom, String quantity) => {
  'localID': localID, 'ref': ref, 'customer': customer, 'code': code, 'item': item, 'uom': uom, 'qty': quantity,
};
Map<String, Object?> describe(List<Row> lines, bool submitting, String removedID) => {
  // _customerCount uses raw customer refs, including empty or differently cased strings.
  'customerCount': lines.map((item) => item['ref']).toSet().length,
  'count': lines.length,
  'details': [for (final item in lines) '${qty(item['qty']!).toStringAsFixed(0)} ${item['uom']} • ${item['code']}'],
  'needAtLeastTwo': lines.length < 2,
  'sourceCanConfirm': !submitting && lines.length >= 2,
  'canRemove': !submitting,
  'afterRemoveIDs': [for (final item in lines) if (submitting || item['localID'] != removedID) item['localID']],
};

void main() {
  final edge = <Row>[
    row('same', 'A', 'Alice', 'A1', 'Film', 'kg', '0.5'),
    row('same', 'A', 'Alice', 'A2', 'Other', 'm', '1.5'),
    row('third', ' A ', 'Spaced', 'A3', 'Other', '', '-0'),
    row('fourth', '', 'Empty', 'A4', 'Other', 'kg', 'inf'),
    row('fifth', 'a', 'Lower', 'A5', 'Other', 'kg', 'nan'),
  ];
  final random = Random(0x11910bb), quantities = ['0', '-0', '0.5', '1.5', '2.5', '-0.5', '1.005', '1e21', '1e-7', 'nan', 'inf', '-inf'];
  final refs = ['A', 'a', ' A ', '', '\u0085', 'B'], ids = ['same', 'different', '', 'third'];
  final generated = <Row>[for (var i = 0; i < 120; i++) row(ids[random.nextInt(ids.length)], refs[random.nextInt(refs.length)],
    'Customer $i', 'CODE-$i', 'Item $i', ['kg', 'm', ''][random.nextInt(3)], quantities[random.nextInt(quantities.length)])];
  final cases = <Map<String, Object?>>[];
  for (final entry in <String, List<Row>>{'empty': [], 'one': [edge.first], 'edges': edge, 'generated': generated}.entries) {
    cases.add({'name': entry.key, 'rows': entry.value, 'removedID': 'same', 'expected': {
      'idle': describe(entry.value, false, 'same'), 'submitting': describe(entry.value, true, 'same'),
    }});
  }
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'reviewSourceSha256': 'b3a9ba63836be0a119cb0d01c969b8d0e07ca72565c175bd5072c15064898d3d',
    'kind': 'standalone source-equivalent batch-review probe; not Flutter or device', 'cases': cases}));
}
