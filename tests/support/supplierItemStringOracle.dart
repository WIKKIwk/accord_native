// Standalone Dart VM oracle for SupplierItem.fromJson's text conversions.
// Run directly outside the read-only V2 checkout; no backend or app dependencies.
import 'dart:convert';

void main() {
  final row = jsonDecode(r'''
    {"code":"A", "customer_names": [" \u0085Alpha\u0085 ", "\u0085", " \ufeff\n", "", null, true, false,
      [], ["x", " y ", [false, null, []]], ["\u0085", ""]],
     "order_apparatus_options": {"empty": [], "nested": ["one", true, null, ["two", []]],
       "spaces": " \u0085 ", "nil": null, "bool": false}}
  ''') as Map<String, dynamic>;
  final names = (row['customer_names'] as List<dynamic>? ?? const [])
      .map((item) => item.toString().trim()).where((item) => item.isNotEmpty).toList();
  final options = (row['order_apparatus_options'] as Map?)
      ?.map((key, value) => MapEntry(key.toString(), value.toString())) ?? const {};
  print(jsonEncode({'input': row, 'customer_names': names, 'order_apparatus_options': options}));
}
