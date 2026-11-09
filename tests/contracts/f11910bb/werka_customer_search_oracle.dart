// Standalone Dart 3.13.7 probe. Imports the exact read-only f119 search source;
// no Flutter runner, app, sqlite, network, simulator or device is used.
import 'dart:convert';
import 'dart:math';
import '../../../../accord_mobile_v2/lib/src/core/search/search_normalizer.dart' as source;

List<int> order(String query, List<Map<String, String>> items) {
  final trimmed = query.trim();
  final indices = List<int>.generate(items.length, (index) => index);
  if (trimmed.isEmpty || items.length < 2) return indices;
  indices.sort((left, right) {
    int score(int index) => source.searchRelevanceScore(
      query: trimmed, primary: items[index]['name']!, secondary: [items[index]['phone']!]);
    final byRelevance = score(right).compareTo(score(left));
    return byRelevance != 0 ? byRelevance : left.compareTo(right);
  });
  return indices;
}

void main() {
  final lower = <String, String>{}, normalizedScalars = <String, String>{};
  for (var code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    final value = String.fromCharCode(code), result = value.toLowerCase();
    if (value != result) lower['$code'] = result;
    final normalized = source.normalizeForSearch(value);
    if (value != normalized) normalizedScalars['$code'] = normalized;
  }
  final random = Random(0x11910bb);
  final alphabet = ['a', 'b', 'c', 'x', 'I', 'İ', 'X', '0', '1', '9', ' ', '-', '.', "'", 'ʻ',
    '\u0085', '\u00a0', '\u2003', '\n', 'а', 'б', 'я', 'Ё', 'Ў', 'қ', 'Ғ', 'ҳ',
    'Σ', 'Ο', 'ا', 'ی', 'é', 'É', '\u0307', 'Ꭰ', '\u{10400}'];
  String randomText() => List<String>.generate(random.nextInt(13), (_) => alphabet[random.nextInt(alphabet.length)]).join();
  final texts = <String>['', ' ', '\u0085', '\u0085İ\u0085', 'ΟΣ', 'I\u0307', 'МОЛОКО', 'OʻGʻIL', 'zzİabc',
    'Haridor', 'Sut mahsulotlari', '+998 90 123 45 67', '  ABC  ', 'یاسین',
    String.fromCharCode(0xd800), String.fromCharCode(0xdc00), ...List.generate(700, (_) => randomText())];
  final normalized = [for (final value in texts) {'input': value, 'lower': value.toLowerCase(), 'normalized': source.normalizeForSearch(value)}];
  final scores = <Map<String, Object>>[];
  void addScore(String query, String primary, List<String> secondary) => scores.add({
    'query': query, 'primary': primary, 'secondary': secondary,
    'score': source.searchRelevanceScore(query: query, primary: primary, secondary: secondary),
  });
  for (final item in [
    ['abc', 'abc', ''], ['abc', 'abcdef', ''], ['abc', 'abdzzz', ''], ['abc', 'zz abc', ''],
    ['abc', 'zz abcd', ''], ['abc', 'zz abxq', ''], ['abc', 'zzİabc', ''],
    ['abc', 'zzzzabxzz', ''], ['abc', 'none', 'abc'], ['\u0085ABC\u0085', 'abc', ''],
    ['ای', 'ای', ''], ['123', 'Yasin', '+998 123 45'],
  ]) { addScore(item[0], item[1], [item[2]]); }
  for (var i = 0; i < 1800; i++) {
    addScore(texts[random.nextInt(texts.length)], texts[random.nextInt(texts.length)],
      [texts[random.nextInt(texts.length)], texts[random.nextInt(texts.length)]]);
  }
  const ascii = 'abcdefgijklmnpqrstuvwxyz0123456789';
  for (var i = 0; i < 200; i++) {
    final query = List.generate(2 + random.nextInt(6), (_) => ascii[random.nextInt(ascii.length)]).join();
    final changed = '${query.substring(0, query.length - 1)}${query.endsWith('z') ? 'a' : 'z'}';
    for (final value in [query, '${query}suffix', '${changed}suffix', 'zz $query', 'zz ${query}suffix',
      'zz ${changed}suffix', 'zzİ$query', 'zzzz${changed}zz']) {
      addScore(query, value, []);
      addScore(query, 'other', [value]);
    }
  }
  final orders = <Map<String, Object>>[];
  void addOrder(String query, List<Map<String, String>> items) => orders.add({'query': query, 'items': items, 'indices': order(query, items)});
  addOrder('abc', [
    {'ref': 'same', 'name': 'zzİabc', 'phone': ''}, {'ref': 'same', 'name': 'zz abc', 'phone': ''},
    {'ref': '3', 'name': 'unrelated', 'phone': 'abc'}, {'ref': '4', 'name': 'abc', 'phone': ''},
  ]);
  addOrder('\u0085', [{'ref': '1', 'name': 'B', 'phone': ''}, {'ref': '1', 'name': 'A', 'phone': ''}]);
  for (var i = 0; i < 160; i++) {
    final items = List<Map<String, String>>.generate(random.nextInt(12), (index) => {
      'ref': '${index % 3}', 'name': texts[random.nextInt(texts.length)], 'phone': texts[random.nextInt(texts.length)],
    });
    addOrder(texts[random.nextInt(texts.length)], items);
  }
  print(const JsonEncoder.withIndent('  ').convert({
    'baseline': 'f11910bb2c8c7081ce26770e69811b03fd0739ed',
    'searchSourceSha256': '163df711b09d2d126ac690f5ddff906e0a8b80e0d18329d637e6a39ed33fefd5',
    'pickerSortSourceSha256': '856e6fe98bef7436832e8780542bfb6d91897f5d4896ebee4c8ee183c2bc4ad1',
    'kind': 'standalone Dart 3.13.7: scalar lowercase, exact imported f119 normalizer and score, single-query source-equivalent ordering',
    'lowercase': lower, 'normalizedScalars': normalizedScalars, 'normalized': normalized, 'scores': scores, 'orders': orders,
  }));
}
