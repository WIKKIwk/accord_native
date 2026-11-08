// Source-equivalent, copied from f119 raw_material_scan_dialog_widgets_part_01.dart:24-47.
// Run only in an isolated/native worktree; never run Dart in the original V2 checkout.
import 'dart:convert';
import 'dart:io';

String rawMaterialBarcodeFromQr(String raw) {
  final value = raw.trim();
  if (value.isEmpty) {
    return '';
  }
  final uri = Uri.tryParse(value);
  // A mold/material code is opaque text, not a relative URL path. In
  // particular, keep codes such as "Milano Premium 30/40" intact.
  if (uri != null && uri.hasScheme && uri.hasAuthority && uri.host.isNotEmpty) {
    for (final key in const ['barcode', 'epc', 'qr']) {
      final candidate = uri.queryParameters[key]?.trim();
      if (candidate != null && candidate.isNotEmpty) {
        return candidate;
      }
    }
    if (uri.pathSegments.isNotEmpty) {
      final last = uri.pathSegments.last.trim();
      if (last.isNotEmpty) {
        return last;
      }
    }
  }
  return value;
}

void main(List<String> args) {
  final values = jsonDecode(File(args.single).readAsStringSync()) as List;
  for (final raw in values) {
    try { print(jsonEncode({'raw': raw, 'value': rawMaterialBarcodeFromQr(raw as String)})); }
    catch (e) { print(jsonEncode({'raw': raw, 'error': e.runtimeType.toString()})); }
  }
}
