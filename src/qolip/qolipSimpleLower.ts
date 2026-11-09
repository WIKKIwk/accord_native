/** Dart simple lowercase for the locally compared examples; Unicode-table parity still needs phone verification. */
export function qolipSimpleLower(value: string): string {
  return [...value].map(character => character === '\u0130' ? 'i' : character.toLowerCase()).join('');
}
