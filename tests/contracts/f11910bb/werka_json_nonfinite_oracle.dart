// Standalone, source-equivalent probe for f119 WerkaUnannouncedSupplierScreen
// and createWerkaUnannouncedDraft. It makes no network requests. This does not
// run the Flutter screen or prove device behavior.
import 'dart:convert';

void main() {
  final cases = <Map<String, Object?>>[];
  for (final input in ['NaN', '+NaN', '-NaN', 'Infinity', '+Infinity', '-Infinity', '0', '3.5']) {
    final qty = double.tryParse(input.trim()) ?? 0;
    final valid = !(qty <= 0);
    final label = valid ? '${qty.toStringAsFixed(0)} kg' : null;
    var submitting = false;
    var postCalls = 0;
    String? errorType;
    String? errorText;
    if (valid) {
      // Assume the user confirms, as the source does before setting this flag.
      submitting = true;
      try {
        // The real source evaluates jsonEncode before invoking _post.
        jsonEncode({'supplier_ref': 's', 'item_code': 'i', 'qty': qty});
        postCalls++;
      } catch (error) {
        errorType = error.runtimeType.toString();
        errorText = error.toString();
      } finally {
        // The source does this only while mounted.
        submitting = false;
      }
    }
    cases.add({'input': input, 'validationPassed': valid, 'confirmationQuantity': label,
      'postCalls': postCalls, 'errorType': errorType, 'errorText': errorText,
      'submittingAfter': submitting});
  }
  print(const JsonEncoder.withIndent('  ').convert({'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'kind': 'standalone source-equivalent, not Flutter or device', 'cases': cases}));
}
