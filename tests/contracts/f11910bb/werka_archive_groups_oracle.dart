// Standalone source-equivalent grouping and metric probe for f119. The exact
// V2 quantity formatter is imported from a read-only sibling checkout; this
// does not launch Flutter, sqlite, a backend or a device. Regenerate only
// with that checkout at f11910bb and Dart 3.13.7.
import 'dart:convert';
import 'dart:math';
import '../../../../accord_mobile_v2/lib/src/core/formatters/quantity_formatters.dart';

typedef Row = Map<String, String>;

double qty(String value) => switch (value) {
  'nan' => double.nan,
  'inf' => double.infinity,
  '-inf' => double.negativeInfinity,
  _ => double.parse(value),
};

// Mirrors _archivePaddonCode and _archivePaddonWarehouse in the source.
String code(Row item) {
  final ref = item['supplier_ref']!.trim();
  if (ref.toLowerCase().startsWith('paddon:')) {
    final result = ref.substring('paddon:'.length).trim();
    if (result.isNotEmpty) return result;
  }
  final id = item['id']!.trim();
  if (id.toLowerCase().startsWith('paddon:')) {
    final rest = id.substring('paddon:'.length), sep = rest.indexOf(':');
    final result = (sep < 0 ? rest : rest.substring(0, sep)).trim();
    if (result.isNotEmpty) return result;
  }
  final name = item['supplier_name']!.trim();
  if (name.toLowerCase().startsWith('paddon')) {
    final tail = name.substring(6).trim(), sep = tail.indexOf('•');
    final result = (sep < 0 ? tail : tail.substring(0, sep)).trim();
    if (result.isNotEmpty) return result;
  }
  return '';
}

String warehouse(Row item) {
  if (item['highlight']!.trim().isNotEmpty) return item['highlight']!.trim();
  final name = item['supplier_name']!.trim(), sep = name.indexOf('•');
  if (sep >= 0) {
    final result = name.substring(sep + 1).trim();
    if (result.isNotEmpty) return result;
  }
  return '';
}

String metric(Row item, String kind) {
  final sent = qty(item['sent_qty']!), accepted = qty(item['accepted_qty']!);
  final result = switch (kind) {
    'received' => accepted > 0 ? accepted : sent,
    'returned' => (sent - accepted).clamp(0, double.infinity).toDouble(),
    _ => sent,
  };
  return '${formatQuantity(result)} ${item['uom']}';
}

List<Map<String, String>> groups(List<Row> items, String kind) {
  final grouped = <String, List<Row>>{}, order = <String>[];
  for (final item in items) {
    final value = code(item), key = value.isEmpty ? 'single:${item['id']}' : 'paddon:$value';
    if (!grouped.containsKey(key)) { grouped[key] = []; order.add(key); }
    grouped[key]!.add(item);
  }
  return [for (final key in order) () {
    final lines = grouped[key]!, first = lines.first, value = code(first), isPaddon = value.isNotEmpty;
    final name = first['supplier_name']!.trim(), itemName = first['item_name']!.trim();
    return {'key': key, 'code': value, 'title': isPaddon ? 'Paddon $value'
      : name.isNotEmpty ? name : itemName.isNotEmpty ? itemName : first['item_code']!.trim(),
      'subtitle': isPaddon ? warehouse(first) : '${first['item_code']} • ${first['item_name']}',
      'trailing': isPaddon ? '${lines.length} ta rulon' : metric(first, kind)};
  }()];
}

Row row(String id, String ref, String name, String highlight, String itemCode,
    String itemName, String sent, String accepted, [String uom = 'kg']) => {
  'id': id, 'supplier_ref': ref, 'supplier_name': name, 'highlight': highlight,
  'item_code': itemCode, 'item_name': itemName, 'sent_qty': sent, 'accepted_qty': accepted, 'uom': uom,
};

void main() {
  final explicit = <Row>[
    row('raw', ' \u0085PADDON: \u0085A\u0085 ', 'Paddon ignored • warehouse', '\u0085', 'I', 'Item', '5', '2'),
    row('\u0085paddon:A:line\u0085', '', 'Paddon A • \u0085WH\u0085', '', 'I2', 'Other', '9', '4'),
    row('fallback', 'paddon:\u0085', '\u0085Paddon \u0085B\u0085 • \u0085STORE\u0085', '\u0085', 'SKU', 'Item', '1', '0'),
    row('single', '', '\u0085', '', '\u0085CODE\u0085', '\u0085', 'inf', 'inf'),
    row('single', '', 'later', '', 'later', 'later', '2', '0'),
    row('negzero', '', '', '', 'NEG', 'Negative zero', '-0', '0'),
    row('nan', '', '', '', 'NAN', 'NaN', 'nan', '0'),
    row('decimals', '', '', '', 'F', 'Fraction', '1.005', '-3'),
  ];
  final refs = ['', 'paddon:A', ' \u0085PADDON: X\u0085 ', 'paddon:\u0085', 'plain', 'paddon:ß'];
  final ids = ['same', 'paddon:Y:one', '\u0085paddon:Z:two\u0085', 'plain', 'other'];
  final names = ['', '\u0085Paddon \u0085B\u0085 • \u0085STORE\u0085', 'Supplier', '\u0085', 'Paddon C', 'Item supplier • Dock'];
  final highlights = ['', '\u0085', ' \u0085H\u0085 ', 'Dock'];
  final itemCodes = ['SKU', '\u0085CODE\u0085', ' ', 'SKU2'];
  final itemNames = ['Item', '\u0085', ' Film ', 'Bo‘yoq'];
  final quantities = ['0', '-0', '1', '2.675', '1.005', '-3', '1e-7', '1e21', 'nan', 'inf', '-inf'];
  final random = Random(0x11910bb);
  int next(int count) => random.nextInt(count);
  final generated = <Row>[for (var i = 0; i < 160; i++) row(ids[next(ids.length)], refs[next(refs.length)],
    names[next(names.length)], highlights[next(highlights.length)], itemCodes[next(itemCodes.length)],
    itemNames[next(itemNames.length)], quantities[next(quantities.length)], quantities[next(quantities.length)],
    ['kg', 'm', ''][next(3)])];
  final cases = <Map<String, Object?>>[];
  for (final entry in {'explicit': explicit, 'generated': generated}.entries) {
    cases.add({'name': entry.key, 'rows': entry.value, 'expected': {
      for (final kind in ['received', 'sent', 'returned']) kind: groups(entry.value, kind),
    }, 'singles': {
      for (final kind in ['received', 'sent', 'returned']) kind: [for (final item in entry.value) groups([item], kind).single],
    }});
  }
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'sourceSha256': '33615563dc327610920e2f79ca1fab4a2f9a91d0bdbbf3995d36b655468d55cb',
    'formatterSha256': '229273e36cf447bfbe75b6ddfb9bb140c65dfee252223ce3a7aee4cddd55c27c',
    'kind': 'standalone source-equivalent grouping and exact V2 formatter; not Flutter or device', 'cases': cases}));
}
