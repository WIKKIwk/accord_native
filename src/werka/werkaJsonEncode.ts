/**
 * Only for Werka's plain request objects. Dart jsonEncode rejects non-finite
 * numbers; JSON.stringify would otherwise silently replace them with null.
 * This does not claim parity for arbitrary Dart and JavaScript object graphs.
 */
export class WerkaJsonUnsupportedNumber extends Error {
  constructor(value: number) {
    super(`Converting object to an encodable object failed: ${String(value)}`);
    this.name = 'JsonUnsupportedObjectError';
  }

  // Dart's JsonUnsupportedObjectError.toString() does not prefix its type.
  toString(): string {
    return this.message;
  }
}

export function werkaJsonEncode(value: Record<string, unknown>): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === 'number' && !Number.isFinite(item)) {
      throw new WerkaJsonUnsupportedNumber(item);
    }
    return item;
  });
}
