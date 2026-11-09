void main() {
  var scalars = 0, mismatches = 0, surrogateMismatches = 0;
  final examples = <String>[];
  final contexts = <(String, String)>[('', ''), ('A', 'Σ'), ('Σ', 'A'), ('I', '\u0307'), (' ', ' ')];
  for (var cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    final c = String.fromCharCode(cp);
    for (final (prefix, suffix) in contexts) {
      final actual = '$prefix$c$suffix'.toLowerCase();
      final perScalar = '${prefix.toLowerCase()}${c.toLowerCase()}${suffix.toLowerCase()}';
      if (actual != perScalar) { mismatches++; if (examples.length < 5) examples.add(cp.toRadixString(16)); }
    }
    scalars++;
  }
  for (var cp = 0xd800; cp <= 0xdfff; cp++) {
    final c = String.fromCharCode(cp);
    if (c.toLowerCase().codeUnits.single != cp || 'A${c}Σ'.toLowerCase().codeUnits.join(',') != 'a${c}σ'.codeUnits.join(',')) surrogateMismatches++;
  }
  print('scalars=$scalars contexts=${contexts.length} mismatches=$mismatches examples=$examples unmatched_surrogate_mismatches=$surrogateMismatches');
}
