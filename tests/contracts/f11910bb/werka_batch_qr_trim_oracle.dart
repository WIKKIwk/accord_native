// Standalone Dart probe of the exact f119 parser in a read-only sibling V2
// checkout. It does not launch Flutter, sqlite, a backend or a device.
// Regenerate only with that sibling at f11910bb and Dart 3.13.7.
import 'dart:convert';
import '../../../../accord_mobile_v2/lib/src/features/werka/presentation/werka_archive_batch_qr.dart';

String encoded(List<String> lines) => base64Url.encode(utf8.encode(lines.join('\n'))).replaceAll('=', '');

void main() {
  final basic = encoded(['ARCHIVE', 's', 'Item', '2.5', 'time']);
  final padded = encoded(['\u0085ARCHIVE\u0085', '\u0085s\u0085', '\u0085Item\u0085',
    '\u00852.5 kg\u0085', '\u0085time\u0085']);
  final internal = encoded(['ARCHIVE', 's', 'left\u0085right', '2.5', 'time']);
  final inputs = <String, String>{
    'basic': 'https://scan.example/A/$basic',
    'raw edge U+0085': '\u0085https://scan.example/A/$basic\u0085',
    'decoded edges U+0085': 'https://scan.example/A/$padded',
    'decoded blank leading segment': 'https://scan.example/%C2%85/A/$basic',
    'fallback edge U+0085': '\u0085prefix/A/$basic\u0085',
    'internal U+0085 preserved': 'https://scan.example/A/$internal',
    'mixed whitespace': '\u0085 \u00a0https://scan.example/A/$basic\u0085 \u00a0',
  };
  final cases = inputs.entries.map((entry) {
    final value = WerkaArchiveBatchQrPayload.tryParse(entry.value);
    return {'name': entry.key, 'input': entry.value, 'output': value == null ? null : {
      'sessionID': value.sessionID, 'itemName': value.itemName, 'qtyText': value.qtyText,
      'qty': value.qty, 'bruttoText': value.bruttoText, 'bruttoQty': value.bruttoQty,
      'nettoText': value.nettoText, 'nettoQty': value.nettoQty, 'batchTime': value.batchTime,
      'rawValue': value.rawValue,
    }};
  }).toList();
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'sourceSha256': 'c79c733497e09403c1ef6244df4754d626ab154d562a9ba44040887c3d88aad7',
    'kind': 'exact V2 parser, standalone Dart 3.13.7; not Flutter or device', 'cases': cases}));
}
